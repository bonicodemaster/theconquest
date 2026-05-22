import {
  bad, loadGameByCode, ok,
} from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";
import { broadcast } from "@/lib/realtime";
import { leaderboardFrom, publicState, MYSTERY_REVEAL_MS } from "@/lib/gameLogic";
import { BY_ISO } from "@/lib/countries";
import { nameFr } from "@/lib/countriesFr";
import { capitalFr } from "@/lib/capitals";

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
      await broadcast(ctx.params.code, [
        { type: "state", payload: state },
        { type: "leaderboard_updated", payload: lb },
        { type: "game_finished", payload: { state, leaderboard: lb } },
      ]);
    }
    return ok({ ok: true });
  }

  // --- Mystery: active round → 3s answer reveal → next round / finish ---
  const ended = !!got.game.ends_at && new Date(got.game.ends_at) <= now;
  if (!ended) return ok({ ok: true }); // round (or reveal pause) still running

  const revealed = !!got.game.mystery_revealed_name;

  // Phase 1 — an active round just ran out with nobody winning: reveal the
  // answer for MYSTERY_REVEAL_MS before moving on. (Winners already entered the
  // reveal phase in the guess route, which set revealed + a short ends_at.)
  if (!revealed) {
    const iso = got.game.mystery_iso;
    const name = iso
      ? (got.game.mode === "capitals"
          ? capitalFr(iso) || iso
          : nameFr(iso, BY_ISO[iso]?.name ?? "") || iso)
      : null;
    const revealEnds = new Date(now.getTime() + MYSTERY_REVEAL_MS).toISOString();
    const { data: claimed } = await admin
      .from("games")
      .update({ mystery_revealed_name: name, ends_at: revealEnds })
      .eq("id", got.game.id)
      .eq("round_index", got.game.round_index)
      .is("mystery_revealed_name", null)
      .select("id")
      .maybeSingle();
    if (!claimed) return ok({ ok: true }); // another client opened the reveal

    const fresh = await loadGameByCode(ctx.params.code);
    if (fresh) {
      const state = publicState(fresh.game, fresh.players, fresh.conquests);
      const lb = leaderboardFrom(fresh.players, fresh.conquests, "mystery");
      await broadcast(ctx.params.code, [
        { type: "state", payload: state },
        { type: "leaderboard_updated", payload: lb },
        ...(state.round ? [{ type: "mystery_round_ended" as const, payload: state.round }] : []),
      ]);
    }
    return ok({ ok: true });
  }

  // Phase 2 — the reveal window elapsed: start the next round or finish.
  const deck = got.game.mystery_deck ?? [];
  const nextIndex = got.game.round_index + 1;
  const finished = nextIndex >= (got.game.total_rounds ?? deck.length);

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
      .eq("round_index", got.game.round_index) // advance exactly once from this round
      .not("mystery_revealed_name", "is", null)
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
    await broadcast(ctx.params.code, events);
  }
  return ok({ ok: true });
}
