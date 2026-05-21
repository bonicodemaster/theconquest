import { z } from "zod";
import {
  bad, dynamic, getUserId, loadGameByCode, ok, parseBody, rateLimit, runtime,
} from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";
import { broadcast } from "@/lib/realtime";

export { runtime, dynamic };

const schema = z.object({ text: z.string().trim().min(1).max(280) });

export async function POST(req: Request, ctx: { params: { code: string } }) {
  const userId = getUserId(req);
  if (!userId) return bad("Missing user id", 401);
  if (!rateLimit(userId, "chat", 2)) return bad("Too fast", 429);

  const p = await parseBody(req, schema);
  if (!p.ok) return p.res;

  const got = await loadGameByCode(ctx.params.code);
  if (!got) return bad("Game not found", 404);
  const me = got.players.find((pl) => pl.user_id === userId);
  if (!me) return bad("Not in game", 403);

  const admin = supabaseAdmin();
  const { data: row, error } = await admin.from("chat_messages").insert({
    game_id: got.game.id,
    player_id: me.id,
    username: me.username,
    color: me.color,
    text: p.data.text,
  }).select("id, created_at").single();
  if (error || !row) return bad(error?.message ?? "Failed", 500);

  await broadcast(admin, ctx.params.code, [{
    type: "chat_message",
    payload: {
      id: row.id,
      playerId: userId,
      username: me.username,
      color: me.color,
      text: p.data.text,
      at: new Date(row.created_at).getTime(),
    },
  }]);
  return ok({ ok: true });
}
