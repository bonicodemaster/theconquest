import { z } from "zod";
import {
  bad, getUserId, loadGameByCode, ok, parseBody, rateLimit,
} from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";
import { broadcast } from "@/lib/realtime";
import { matchCountry } from "@/lib/normalize";
import { leaderboardFrom, publicState } from "@/lib/gameLogic";
import { BY_ISO, COUNTRIES } from "@/lib/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ guess: z.string().trim().min(1).max(60) });

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

  const country = matchCountry(p.data.guess, got.game.difficulty);
  if (!country) return ok({ matched: false });

  const admin = supabaseAdmin();

  if (got.game.mode === "conquest") {
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
    await admin.from("players").update({ score: me.score + 1 }).eq("id", me.id);

    const fresh = await loadGameByCode(ctx.params.code);
    if (!fresh) return ok({ matched: true, isoCode: country.isoCode });

    const lb = leaderboardFrom(fresh.players, fresh.conquests, "conquest");
    const allTaken = fresh.conquests.length >= COUNTRIES.length;
    const events = [
      {
        type: "country_conquered" as const,
        payload: {
          isoCode: country.isoCode,
          playerId: userId,
          conqueredAt: Date.now(),
          username: me.username,
          color: me.color,
        },
      },
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
    await broadcast(admin, ctx.params.code, events);
    return ok({ matched: true, isoCode: country.isoCode });
  }

  // Mystery
  if (got.game.mystery_iso !== country.isoCode) return ok({ matched: false });
  if (got.game.mystery_winner_user_id) return ok({ matched: false }); // round already won

  // Atomic claim: only first writer succeeds (winner_user_id is null guard)
  const { data: claimed, error: cErr } = await admin
    .from("games")
    .update({ mystery_winner_user_id: userId, mystery_revealed_name: country.name })
    .eq("id", got.game.id)
    .is("mystery_winner_user_id", null)
    .select("id")
    .maybeSingle();
  if (cErr) return bad(cErr.message, 500);
  if (!claimed) return ok({ matched: false }); // raced — someone else got it

  await admin.from("players").update({ score: me.score + 1 }).eq("id", me.id);

  const fresh = await loadGameByCode(ctx.params.code);
  if (fresh) {
    const lb = leaderboardFrom(fresh.players, fresh.conquests, "mystery");
    const state = publicState(fresh.game, fresh.players, fresh.conquests);
    await broadcast(admin, ctx.params.code, [
      { type: "leaderboard_updated", payload: lb },
      { type: "state", payload: state },
      ...(state.round ? [{ type: "mystery_round_ended" as const, payload: state.round }] : []),
    ]);
  }
  return ok({ matched: true, isoCode: country.isoCode });
}
