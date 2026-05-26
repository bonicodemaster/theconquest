import { z } from "zod";
import {
  bad, getUserId, loadGameByCode, ok, parseBody, rateLimit,
} from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";
import { broadcast } from "@/lib/realtime";
import { matchCountry } from "@/lib/normalize";
import { leaderboardFrom, publicState, MYSTERY_REVEAL_MS, type GameRow, type PlayerRow } from "@/lib/gameLogic";
import { BY_ISO, COUNTRIES } from "@/lib/countries";
import { basePoints, difficultyOf } from "@/lib/difficulty";
import { nameFr } from "@/lib/countriesFr";
import { matchCapital, capitalFr } from "@/lib/capitals";
import { MAX_WRONG_GUESSES } from "@/lib/roundRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ guess: z.string().trim().min(1).max(60) });

/**
 * Round-based modes only. Records one wrong guess for the active round and, once
 * EVERY present player has used all their tries, reveals the answer early (the
 * same reveal the timer would eventually trigger) so nobody waits out the clock
 * on a country that's already been exhausted.
 *
 * Counts are stored on `games.round_misses` keyed by round index, so they
 * self-reset on the next round — no reset writes needed elsewhere. No-ops until
 * migration 0004 adds the column (so deploying ahead of the migration is safe).
 */
async function recordMissMaybeReveal(
  admin: ReturnType<typeof supabaseAdmin>,
  code: string,
  game: GameRow,
  players: PlayerRow[],
  userId: string
): Promise<void> {
  // Atomic increment via compare-and-swap. PostgREST can't express
  // `m[user] = m[user] + 1` in a single statement, so a naive read-modify-write
  // loses updates when two guesses land at once (the box clears instantly, so a
  // fast solo player — or two players in a room — easily fire concurrently):
  // both read the same tally and the second write clobbers the first. We'd then
  // undercount, `everyoneDone` would never flip, and the round would run out the
  // clock instead of ending early. So: re-read the row's tally + `updated_at`,
  // then write guarded on that `updated_at` (the trigger bumps it on every
  // write). If a concurrent guess changed the row first, the guard no-ops and we
  // retry with the fresh value.
  let counts: Record<string, number> | null = null;
  for (let attempt = 0; attempt < 8 && counts === null; attempt++) {
    const { data: g } = await admin
      .from("games")
      .select("round_index, round_misses, updated_at, mystery_winner_user_id, mystery_revealed_name")
      .eq("id", game.id)
      .maybeSingle();
    if (!g || g.round_misses === undefined) return; // gone, or column not migrated
    if (g.round_index !== game.round_index) return; // round already moved on
    if (g.mystery_winner_user_id || g.mystery_revealed_name) return; // already settled
    const prev = g.round_misses && g.round_misses.r === g.round_index ? g.round_misses.m : {};
    const next: Record<string, number> = { ...prev, [userId]: (prev[userId] ?? 0) + 1 };
    const { data: ok } = await admin
      .from("games")
      .update({ round_misses: { r: g.round_index, m: next } })
      .eq("id", game.id)
      .eq("round_index", g.round_index)
      .eq("updated_at", g.updated_at) // optimistic lock — only if unchanged since the read
      .select("id")
      .maybeSingle();
    if (ok) counts = next; // else: lost the CAS race → retry with fresh state
  }
  if (!counts) return; // couldn't record (heavy contention / round moved) — the timer still ends it

  const everyoneDone =
    players.length > 0 && players.every((pl) => (counts![pl.user_id] ?? 0) >= MAX_WRONG_GUESSES);
  if (!everyoneDone) return;

  const iso = game.mystery_iso;
  const name = iso
    ? game.mode === "capitals"
      ? capitalFr(iso) || iso
      : nameFr(iso, BY_ISO[iso]?.name ?? "") || iso
    : null;
  // Race-safe: only opens the reveal if nobody has won or revealed it first.
  const { data: claimed } = await admin
    .from("games")
    .update({
      mystery_revealed_name: name,
      ends_at: new Date(Date.now() + MYSTERY_REVEAL_MS).toISOString(),
    })
    .eq("id", game.id)
    .eq("round_index", game.round_index)
    .is("mystery_revealed_name", null)
    .is("mystery_winner_user_id", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const fresh = await loadGameByCode(code);
  if (!fresh) return;
  const state = publicState(fresh.game, fresh.players, fresh.conquests);
  const lb = leaderboardFrom(fresh.players, fresh.conquests, fresh.game.mode);
  await broadcast(code, [
    { type: "state", payload: state },
    { type: "leaderboard_updated", payload: lb },
    ...(state.round ? [{ type: "mystery_round_ended" as const, payload: state.round }] : []),
  ]);
}

export async function POST(req: Request, ctx: { params: { code: string } }) {
  const userId = getUserId(req);
  if (!userId) return bad("Identifiant utilisateur manquant", 401);
  if (!rateLimit(userId, "guess", 8)) return bad("Trop rapide", 429);

  const p = await parseBody(req, schema);
  if (!p.ok) return p.res;

  const got = await loadGameByCode(ctx.params.code);
  if (!got) return bad("Partie introuvable", 404);
  if (got.game.status !== "playing") return bad("Partie non démarrée", 409);

  const me = got.players.find((pl) => pl.user_id === userId);
  if (!me) return bad("Vous n'êtes pas dans la partie", 403);

  const admin = supabaseAdmin();

  // ===== Capitales — the country is shown; guess its capital city =====
  if (got.game.mode === "capitals") {
    const targetIso = got.game.mystery_iso;
    if (!targetIso) return ok({ matched: false });
    if (got.game.mystery_winner_user_id) return ok({ matched: false }); // round already won
    if (got.game.mystery_revealed_name) return ok({ matched: false }); // reveal pause — round over
    if (!matchCapital(p.data.guess, targetIso, got.game.difficulty)) {
      await recordMissMaybeReveal(admin, ctx.params.code, got.game, got.players, userId);
      return ok({ matched: false });
    }

    const { data: claimed, error: cErr } = await admin
      .from("games")
      .update({
        mystery_winner_user_id: userId,
        mystery_revealed_name: capitalFr(targetIso),
        ends_at: new Date(Date.now() + MYSTERY_REVEAL_MS).toISOString(),
      })
      .eq("id", got.game.id)
      .is("mystery_winner_user_id", null)
      .select("id")
      .maybeSingle();
    if (cErr) return bad(cErr.message, 500);
    if (!claimed) return ok({ matched: false }); // raced — someone else got it

    await admin.from("players").update({ score: me.score + 1 }).eq("id", me.id);

    const fresh = await loadGameByCode(ctx.params.code);
    if (fresh) {
      const lb = leaderboardFrom(fresh.players, fresh.conquests, "capitals");
      const state = publicState(fresh.game, fresh.players, fresh.conquests);
      await broadcast(ctx.params.code, [
        { type: "leaderboard_updated", payload: lb },
        { type: "state", payload: state },
        ...(state.round ? [{ type: "mystery_round_ended" as const, payload: state.round }] : []),
      ]);
    }
    return ok({ matched: true, isoCode: targetIso });
  }

  // ===== Conquest + Mystère — match the typed country name =====
  const country = matchCountry(p.data.guess, got.game.difficulty);

  if (got.game.mode === "conquest") {
    if (!country) return ok({ matched: false });
    // Points scale with how hard the country is to recall (3 → 50) — conquest only.
    const gained = basePoints(country.isoCode);
    // UNIQUE(game_id, iso_code) makes this race-safe
    const { error } = await admin.from("conquests").insert({
      game_id: got.game.id,
      iso_code: country.isoCode,
      player_id: me.id,
      user_id: userId,
    });
    if (error) {
      if (error.code === "23505") return ok({ matched: false }); // already taken
      return bad(error.message, 500);
    }
    await admin.from("players").update({ score: me.score + gained }).eq("id", me.id);
    // Bump the room version (via the games updated_at trigger) so this conquest
    // produces a strictly newer `state` than the last — the client's stale-read
    // guard then keeps live map fills correctly ordered (conquests insert into a
    // separate table and would otherwise never advance the version).
    await admin.from("games").update({ updated_at: new Date().toISOString() }).eq("id", got.game.id);

    const fresh = await loadGameByCode(ctx.params.code);
    if (!fresh) return ok({ matched: true, isoCode: country.isoCode });

    const lb = leaderboardFrom(fresh.players, fresh.conquests, "conquest");
    const state = publicState(fresh.game, fresh.players, fresh.conquests);
    const allTaken = fresh.conquests.length >= COUNTRIES.length;
    // Broadcast the fresh `state` (not just the conquest event) so every
    // client's map fills in real time — the conquered list lives on `state`.
    const events = [
      {
        type: "country_conquered" as const,
        payload: {
          isoCode: country.isoCode,
          playerId: userId,
          conqueredAt: Date.now(),
          username: me.username,
          color: me.color,
          name: nameFr(country.isoCode, country.name),
          points: gained,
          difficulty: difficultyOf(country.isoCode),
        },
      },
      { type: "state" as const, payload: state },
      { type: "leaderboard_updated" as const, payload: lb },
    ];

    if (allTaken) {
      await admin.from("games").update({ status: "finished" }).eq("id", got.game.id);
      const finalFresh = await loadGameByCode(ctx.params.code);
      if (finalFresh) {
        const finalState = publicState(finalFresh.game, finalFresh.players, finalFresh.conquests);
        const finalLb = leaderboardFrom(finalFresh.players, finalFresh.conquests, "conquest");
        events.push({ type: "state", payload: finalState } as any);
        events.push({ type: "game_finished", payload: { state: finalState, leaderboard: finalLb } } as any);
      }
    }
    await broadcast(ctx.params.code, events);
    return ok({ matched: true, isoCode: country.isoCode });
  }

  // ===== Mystère =====
  // Round already settled (someone won, or we're in the reveal pause) → ignore,
  // and don't count it as a miss.
  if (got.game.mystery_winner_user_id || got.game.mystery_revealed_name) return ok({ matched: false });
  // Wrong guess (unrecognised, or not the target country) → count a try and,
  // if every player is now out of tries, end the round early.
  if (!country || got.game.mystery_iso !== country.isoCode) {
    await recordMissMaybeReveal(admin, ctx.params.code, got.game, got.players, userId);
    return ok({ matched: false });
  }

  // Atomic claim: only the first writer wins. Collapse the remaining round time
  // into a short reveal window so the answer shows briefly before the next round.
  const { data: claimed, error: cErr } = await admin
    .from("games")
    .update({
      mystery_winner_user_id: userId,
      mystery_revealed_name: nameFr(country.isoCode, country.name),
      ends_at: new Date(Date.now() + MYSTERY_REVEAL_MS).toISOString(),
    })
    .eq("id", got.game.id)
    .is("mystery_winner_user_id", null)
    .select("id")
    .maybeSingle();
  if (cErr) return bad(cErr.message, 500);
  if (!claimed) return ok({ matched: false }); // raced — someone else got it

  // Pays Mystère: a correct guess is always worth 1 point. Difficulty sorts
  // itself out — on a hard country only one player tends to find it at all.
  await admin.from("players").update({ score: me.score + 1 }).eq("id", me.id);

  const fresh = await loadGameByCode(ctx.params.code);
  if (fresh) {
    const lb = leaderboardFrom(fresh.players, fresh.conquests, "mystery");
    const state = publicState(fresh.game, fresh.players, fresh.conquests);
    await broadcast(ctx.params.code, [
      { type: "leaderboard_updated", payload: lb },
      { type: "state", payload: state },
      ...(state.round ? [{ type: "mystery_round_ended" as const, payload: state.round }] : []),
    ]);
  }
  return ok({ matched: true, isoCode: country.isoCode });
}
