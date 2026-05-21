import { bad, emitState, getUserId, loadGameByCode, ok } from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: { code: string } }) {
  const userId = getUserId(req);
  if (!userId) return bad("Identifiant utilisateur manquant", 401);

  const got = await loadGameByCode(ctx.params.code);
  if (!got) return bad("Partie introuvable", 404);
  if (got.game.host_user_id !== userId) return bad("Seul l'hôte peut relancer", 403);

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
