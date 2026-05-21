import {
  bad, dynamic, emitState, getUserId, loadGameByCode, ok, parseBody, runtime, settingsSchema,
} from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";

export { runtime, dynamic };

export async function PATCH(req: Request, ctx: { params: { code: string } }) {
  const userId = getUserId(req);
  if (!userId) return bad("Missing user id", 401);

  const p = await parseBody(req, settingsSchema.partial());
  if (!p.ok) return p.res;

  const got = await loadGameByCode(ctx.params.code);
  if (!got) return bad("Game not found", 404);
  if (got.game.host_user_id !== userId) return bad("Only the host can change settings", 403);
  if (got.game.status !== "lobby") return bad("Game already started");

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
