import { z } from "zod";
import {
  bad, emitState, getUserId, loadGameByCode, ok, parseBody, usernameSchema,
} from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PLAYER_COLORS } from "@/lib/codeGen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ username: usernameSchema });

export async function POST(req: Request, ctx: { params: { code: string } }) {
  const userId = getUserId(req);
  if (!userId) return bad("Identifiant utilisateur manquant", 401);
  const p = await parseBody(req, schema);
  if (!p.ok) return p.res;

  const got = await loadGameByCode(ctx.params.code);
  if (!got) return bad("Partie introuvable", 404);

  // Idempotent re-join (same userId) — must run BEFORE the status/capacity
  // checks. An already-joined player (e.g. the host bounced here by a transient
  // route) should re-sync and continue, never be rejected with "déjà démarrée".
  const existing = got.players.find((p) => p.user_id === userId);
  if (existing) {
    await emitState(ctx.params.code);
    return ok({ ok: true });
  }

  // New joiner: only allowed while still in the lobby and below capacity.
  if (got.game.status !== "lobby") return bad("Partie déjà démarrée");
  if (got.players.length >= got.game.max_players) return bad("Partie complète");

  const used = new Set(got.players.map((p) => p.color));
  const color = PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[got.players.length % PLAYER_COLORS.length];

  const { error } = await supabaseAdmin().from("players").insert({
    game_id: got.game.id,
    user_id: userId,
    username: p.data.username,
    color,
    is_host: false,
  });
  if (error) {
    if (error.code === "23505") return bad("Pseudo déjà pris dans ce salon");
    return bad(error.message, 500);
  }

  await emitState(ctx.params.code);
  return ok({ ok: true });
}
