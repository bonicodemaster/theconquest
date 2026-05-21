import {
  bad, loadGameByCode, ok,
} from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";
import { broadcast } from "@/lib/realtime";
import { leaderboardFrom, publicState } from "@/lib/gameLogic";
import { BY_ISO } from "@/lib/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Idempotent transition endpoint. Called by clients when they notice the
 * timer has elapsed. Race-safe via conditional UPDATEs.
 *  - conquest: end game when ends_at < now()
 *  - mystery: end round when ends_at < now() AND no winner yet, then start next or finish.
 */
export async function POST(_req: Request, ctx: { params: { code: string } }) {
  const got = await loadGameByCode(ctx.params.code);
  if (!got) return bad("Partie introuvable", 404);
  if (got.game.status !== "playing") return ok({ ok: true });

  const admin = supabaseAdmin();
  const now = new Date();

  // --- Conquest: simple expiry ---
  if (got.game.mode === "conquest") {
    if (!got.game.ends_at || new Date(got.game.ends_at) > now) return ok({ ok: true });

    const { data: claimed } = await admin
      .from("games")
      .update({ status: "finished" })
      .eq("id", got.game.id)
      .eq("status", "playing")
      .select("id")
      .maybeSingle();
    if (!claimed) return ok({ ok: true });

    const fresh = await loadGameByCode(ctx.params.code);
    if (fresh) {
      const state = publicState(fresh.game, fresh.players, fresh.conquests);
      const lb = leaderboardFrom(fresh.players, fresh.conquests, "conquest");
      await broadcast(admin, ctx.params.code, [
        { type: "state", payload: state },
        { type: "leaderboard_updated", payload: lb },
        { type: "game_finished", payload: { state, leaderboard: lb } },
      ]);
    }
    return ok({ ok: true });
  }

  // --- Mystery: end round, then either start next or finish ---
  const deck = got.game.mystery_deck ?? [];
  const nextIndex = got.game.round_index + 1;
  const finished = nextIndex >= (got.game.total_rounds ?? deck.length);

  // Reveal name if no winner yet & timer up
  const timedOut = got.game.ends_at && new Date(got.game.ends_at) <= now && !got.game.mystery_winner_user_id;
  if (timedOut && got.game.mystery_iso) {
    await admin.from("games")
      .update({ mystery_revealed_name: BY_ISO[got.game.mystery_iso]?.name ?? null })
      .eq("id", got.game.id)
      .is("mystery_winner_user_id", null);
  }

  // Only advance once we're sure the round is over (winner or timer up).
  const roundOver =
    !!got.game.mystery_winner_user_id || timedOut;
  if (!roundOver) return ok({ ok: true });

  if (finished) {
    const { data: claimed } = await admin
      .from("games")
      .update({ status: "finished" })
      .eq("id", got.game.id)
      .eq("status", "playing")
      .select("id")
      .maybeSingle();
    if (!claimed) return ok({ ok: true });
  } else {
    const newIso = deck[nextIndex];
    const newEnds = new Date(now.getTime() + got.game.duration_sec * 1000);
    const { data: claimed } = await admin
      .from("games")
      .update({
        round_index: nextIndex,
        mystery_iso: newIso,
        mystery_round_started_at: now.toISOString(),
        ends_at: newEnds.toISOString(),
        mystery_winner_user_id: null,
        mystery_revealed_name: null,
      })
      .eq("id", got.game.id)
      .eq("round_index", got.game.round_index)   // optimistic check
      .select("id")
      .maybeSingle();
    if (!claimed) return ok({ ok: true });
  }

  const fresh = await loadGameByCode(ctx.params.code);
  if (fresh) {
    const state = publicState(fresh.game, fresh.players, fresh.conquests);
    const lb = leaderboardFrom(fresh.players, fresh.conquests, "mystery");
    const events: any[] = [
      { type: "state", payload: state },
      { type: "leaderboard_updated", payload: lb },
    ];
    if (fresh.game.status === "finished") {
      events.push({ type: "game_finished", payload: { state, leaderboard: lb } });
    } else if (state.round) {
      events.push({ type: "mystery_new_round", payload: state.round });
    }
    await broadcast(admin, ctx.params.code, events);
  }
  return ok({ ok: true });
}
