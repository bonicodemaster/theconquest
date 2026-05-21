import {
  bad, emitState, getUserId, loadGameByCode, ok, parseBody, settingsSchema,
} from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: { code: string } }) {
  const userId = getUserId(req);
  if (!userId) return bad("Identifiant utilisateur manquant", 401);

  const p = await parseBody(req, settingsSchema.partial());
  if (!p.ok) return p.res;

  const got = await loadGameByCode(ctx.params.code);
  if (!got) return bad("Partie introuvable", 404);
  if (got.game.host_user_id !== userId) return bad("Seul l'hôte peut changer les paramètres", 403);
  if (got.game.status !== "lobby") return bad("Partie déjà démarrée");

  const patch: Record<string, unknown> = {};
  if (p.data.mode !== undefined) patch.mode = p.data.mode;
  if (p.data.durationSec !== undefined) patch.duration_sec = p.data.durationSec;
  if (p.data.difficulty !== undefined) patch.difficulty = p.data.difficulty;
  if (p.data.maxPlayers !== undefined) patch.max_players = p.data.maxPlayers;
  if (p.data.isPrivate !== undefined) patch.is_private = p.data.isPrivate;
  if (p.data.totalCountries !== undefined) patch.total_countries = p.data.totalCountries;

  if (Object.keys(patch).length) {
    const { error } = await supabaseAdmin().from("games").update(patch).eq("id", got.game.id);
    if (error) return bad(error.message, 500);
  }
  await emitState(ctx.params.code);
  return ok({ ok: true });
}
