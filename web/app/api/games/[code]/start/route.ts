import {
  bad, getUserId, loadGameByCode, ok,
} from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";
import { broadcast } from "@/lib/realtime";
import { leaderboardFrom, publicState } from "@/lib/gameLogic";
import { COUNTRIES } from "@/lib/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  if (!userId) return bad("Identifiant utilisateur manquant", 401);

  const got = await loadGameByCode(ctx.params.code);
  if (!got) return bad("Partie introuvable", 404);
  if (got.game.host_user_id !== userId) return bad("Seul l'hôte peut démarrer", 403);
  if (got.players.length < 1) return bad("Pas assez de joueurs");
  // Idempotent: if already playing, just re-emit state and return ok.
  if (got.game.status === "playing") {
    const state = publicState(got.game, got.players, got.conquests);
    const lb = leaderboardFrom(got.players, got.conquests, got.game.mode);
    await broadcast(ctx.params.code, [
      { type: "game_started", payload: state },
      { type: "state", payload: state },
      { type: "leaderboard_updated", payload: lb },
    ]);
    return ok({ ok: true });
  }
  // If finished, reset everything first (treat as host-initiated replay)
  if (got.game.status === "finished") {
    const admin = supabaseAdmin();
    await admin.from("conquests").delete().eq("game_id", got.game.id);
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
    // reload after reset
    const reset = await loadGameByCode(ctx.params.code);
    if (reset) {
      got.game = reset.game;
      got.players = reset.players;
      got.conquests = reset.conquests;
    }
  }

  const now = new Date();
  const admin = supabaseAdmin();

  // Step 1 — atomically claim the start (only succeeds from 'lobby'). The
  // RETURNING row reflects the LATEST committed settings on the primary, so a
  // duration the host just changed can't be lost to read-replica lag (the
  // cause of "I picked 1 min but it ran 5 min" bugs).
  const claim = await admin
    .from("games")
    .update({ status: "playing", started_at: now.toISOString() })
    .eq("id", got.game.id)
    .eq("status", "lobby")
    .select("*");
  if (claim.error) { console.error("[start] claim failed", claim.error); return bad(claim.error.message, 500); }
  if (!claim.data || claim.data.length === 0) {
    // Lost the race (already started/finished) — report the true status so the
    // client routes correctly instead of forcing a stale start.
    const cur = await loadGameByCode(ctx.params.code);
    if (cur && cur.game.status !== "lobby") {
      const state = publicState(cur.game, cur.players, cur.conquests);
      const lb = leaderboardFrom(cur.players, cur.conquests, cur.game.mode);
      await broadcast(ctx.params.code, [
        { type: "game_started", payload: state },
        { type: "state", payload: state },
        { type: "leaderboard_updated", payload: lb },
      ]);
      return ok({ ok: true, state, leaderboard: lb });
    }
    return bad("Impossible de démarrer la partie", 409);
  }

  // Step 2 — compute the time/round fields from the authoritative row.
  const g = claim.data[0] as typeof got.game;
  const endsAt = new Date(now.getTime() + g.duration_sec * 1000).toISOString();
  let updatePayload: Record<string, unknown>;
  if (g.mode === "conquest") {
    updatePayload = { ends_at: endsAt };
  } else {
    // Distinct countries only — a game never asks for the same country twice.
    const isos = [...new Set(COUNTRIES.map((c) => c.isoCode))];
    const total = Math.min(g.total_countries ?? 50, isos.length);
    const deck = shuffle(isos).slice(0, total);
    updatePayload = {
      ends_at: endsAt,
      total_rounds: total,
      mystery_deck: deck,
      mystery_iso: deck[0],
      mystery_round_started_at: now.toISOString(),
      round_index: 0,
      mystery_winner_user_id: null,
      mystery_revealed_name: null,
    };
  }

  const { data, error: uErr } = await admin
    .from("games")
    .update(updatePayload)
    .eq("id", got.game.id)
    .select("*");
  if (uErr) { console.error("[start] update games failed", uErr); return bad(uErr.message, 500); }
  if (!data || data.length === 0) {
    console.error("[start] 0 rows updated");
    return bad("Écriture bloquée par la base", 500);
  }

  // Use the row returned by the UPDATE, NOT a fresh read (avoids replica lag).
  const freshGame = data[0] as typeof got.game;
  const state = publicState(freshGame, got.players, got.conquests);
  const lb = leaderboardFrom(got.players, got.conquests, freshGame.mode);
  await broadcast(ctx.params.code, [
    { type: "game_started", payload: state },
    { type: "state", payload: state },
    { type: "leaderboard_updated", payload: lb },
    ...(freshGame.mode === "mystery" && state.round
      ? [{ type: "mystery_new_round" as const, payload: state.round }]
      : []),
  ]);
  return ok({ ok: true, state, leaderboard: lb });
}
