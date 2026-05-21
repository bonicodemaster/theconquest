import { bad, dynamic, emitState, getUserId, loadGameByCode, ok, runtime } from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";

export { runtime, dynamic };

export async function POST(req: Request, ctx: { params: { code: string } }) {
  const userId = getUserId(req);
  if (!userId) return bad("Missing user id", 401);

  const got = await loadGameByCode(ctx.params.code);
  if (!got) return bad("Game not found", 404);
  if (got.game.host_user_id !== userId) return bad("Only host can replay", 403);

  const admin = supabaseAdmin();
  await admin.from("conquests").delete().eq("game_id", got.game.id);
  await admin.from("chat_messages").delete().eq("game_id", got.game.id);
  await admin.from("players").update({ score: 0, ready: false }).eq("game_id", got.game.id);
  await admin.from("games").update({
    status: "lobby",
    started_at: null,
    ends_at: null,
    round_index: 0,
    total_rounds: null,
    mystery_iso: null,
    mystery_deck: null,
    mystery_winner_user_id: null,
    mystery_revealed_name: null,
    mystery_round_started_at: null,
  }).eq("id", got.game.id);

  await emitState(ctx.params.code);
  return ok({ ok: true });
}
