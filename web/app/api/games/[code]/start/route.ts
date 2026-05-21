import {
  bad, dynamic, getUserId, loadGameByCode, ok, runtime,
} from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";
import { broadcast } from "@/lib/realtime";
import { leaderboardFrom, publicState } from "@/lib/gameLogic";
import { COUNTRIES } from "@/lib/countries";

export { runtime, dynamic };

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function POST(req: Request, ctx: { params: { code: string } }) {
  const userId = getUserId(req);
  if (!userId) return bad("Missing user id", 401);

  const got = await loadGameByCode(ctx.params.code);
  if (!got) return bad("Game not found", 404);
  if (got.game.host_user_id !== userId) return bad("Only host can start", 403);
  if (got.game.status !== "lobby") return bad("Already started");
  if (got.players.length < 1) return bad("Not enough players");

  const now = new Date();
  const admin = supabaseAdmin();

  if (got.game.mode === "conquest") {
    const endsAt = new Date(now.getTime() + got.game.duration_sec * 1000);
    await admin.from("games")
      .update({ status: "playing", started_at: now.toISOString(), ends_at: endsAt.toISOString() })
      .eq("id", got.game.id);
  } else {
    const total = Math.min(got.game.total_countries ?? 50, COUNTRIES.length);
    const deck = shuffle(COUNTRIES.map((c) => c.isoCode)).slice(0, total);
    const firstIso = deck[0];
    const endsAt = new Date(now.getTime() + got.game.duration_sec * 1000);
    await admin.from("games").update({
      status: "playing",
      started_at: now.toISOString(),
      total_rounds: total,
      mystery_deck: deck,
      mystery_iso: firstIso,
      mystery_round_started_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      round_index: 0,
      mystery_winner_user_id: null,
      mystery_revealed_name: null,
    }).eq("id", got.game.id);
  }

  // Fresh load + broadcast
  const fresh = await loadGameByCode(ctx.params.code);
  if (!fresh) return ok({ ok: true });
  const state = publicState(fresh.game, fresh.players, fresh.conquests);
  const lb = leaderboardFrom(fresh.players, fresh.conquests, fresh.game.mode);
  await broadcast(admin, ctx.params.code, [
    { type: "game_started", payload: state },
    { type: "state", payload: state },
    { type: "leaderboard_updated", payload: lb },
    ...(fresh.game.mode === "mystery" && state.round
      ? [{ type: "mystery_new_round" as const, payload: state.round }]
      : []),
  ]);
  return ok({ ok: true });
}
