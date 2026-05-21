import { z } from "zod";
import {
  bad, dynamic, emitState, getUserId, loadGameByCode, ok, parseBody, runtime, usernameSchema,
} from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PLAYER_COLORS } from "@/lib/codeGen";

export { runtime, dynamic };

const schema = z.object({ username: usernameSchema });

export async function POST(req: Request, ctx: { params: { code: string } }) {
  const userId = getUserId(req);
  if (!userId) return bad("Missing user id", 401);
  const p = await parseBody(req, schema);
  if (!p.ok) return p.res;

  const got = await loadGameByCode(ctx.params.code);
  if (!got) return bad("Game not found", 404);
  if (got.game.status !== "lobby") return bad("Game already started");
  if (got.players.length >= got.game.max_players) return bad("Game is full");

  // Idempotent re-join (same userId)
  const existing = got.players.find((p) => p.user_id === userId);
  if (existing) {
    await emitState(ctx.params.code);
    return ok({ ok: true });
  }

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
    if (error.code === "23505") return bad("Username taken in this room");
    return bad(error.message, 500);
  }

  await emitState(ctx.params.code);
  return ok({ ok: true });
}
