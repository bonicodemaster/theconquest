import {
  bad, emitState, getUserId, loadGameByCode, ok,
} from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: { code: string } }) {
  const userId = getUserId(req);
  if (!userId) return bad("Identifiant utilisateur manquant", 401);

  const got = await loadGameByCode(ctx.params.code);
  if (!got) return ok({ ok: true });

  const me = got.players.find((p) => p.user_id === userId);
  if (!me) return ok({ ok: true });

  const admin = supabaseAdmin();
  await admin.from("players").delete().eq("id", me.id);

  const remaining = got.players.filter((p) => p.user_id !== userId);
  if (remaining.length === 0) {
    await admin.from("games").delete().eq("id", got.game.id);
    return ok({ ok: true });
  }

  // Promote new host if the host left
  if (got.game.host_user_id === userId) {
    const next = remaining[0];
    await admin.from("players").update({ is_host: true }).eq("id", next.id);
    await admin.from("games").update({ host_user_id: next.user_id }).eq("id", got.game.id);
  }

  await emitState(ctx.params.code, {
    extraEvents: [{ type: "player_left", payload: { playerId: userId } }],
  });
  return ok({ ok: true });
}
