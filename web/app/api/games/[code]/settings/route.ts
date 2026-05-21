import {
  bad, getUserId, loadGameByCode, ok, parseBody, settingsSchema,
} from "../../../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";
import { broadcast } from "@/lib/realtime";
import { leaderboardFrom, publicState, type GameRow } from "@/lib/gameLogic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: { code: string } }) {
  const userId = getUserId(req);
  if (!userId) return bad("Identifiant utilisateur manquant", 401);

  const p = await parseBody(req, settingsSchema.partial());
  if (!p.ok) return p.res;

  const got = await loadGameByCode(ctx.params.code);
  if (!got) return bad("Partie introuvable", 404);
  if (got.game.host_user_id !== userId) return bad("Seul l'hôte peut changer les paramètres", 403);
  // If the game already moved past lobby, surface the actual status so the
  // client can route to /game or /results instead of being stuck.
  if (got.game.status !== "lobby") {
    return bad(got.game.status === "playing" ? "Partie déjà démarrée" : "Partie terminée", 409);
  }

  const patch: Record<string, unknown> = {};
  if (p.data.mode !== undefined) patch.mode = p.data.mode;
  if (p.data.durationSec !== undefined) patch.duration_sec = p.data.durationSec;
  if (p.data.difficulty !== undefined) patch.difficulty = p.data.difficulty;
  if (p.data.maxPlayers !== undefined) patch.max_players = p.data.maxPlayers;
  if (p.data.isPrivate !== undefined) patch.is_private = p.data.isPrivate;
  if (p.data.totalCountries !== undefined) patch.total_countries = p.data.totalCountries;

  if (Object.keys(patch).length === 0) return ok({ ok: true });

  // Use RETURNING so we get the post-write row directly, avoiding read-replica
  // lag (the cause of "settings revert" bugs in production).
  const { data, error } = await supabaseAdmin()
    .from("games")
    .update(patch)
    .eq("id", got.game.id)
    .select("*");
  if (error) {
    console.error("[settings] update games failed", error);
    return bad(error.message, 500);
  }
  if (!data || data.length === 0) {
    console.error("[settings] 0 rows updated");
    return bad("Écriture bloquée par la base", 500);
  }

  // Broadcast using the freshly-written row, NOT a re-read (which can hit a
  // stale read replica).
  const freshGame = data[0] as GameRow;
  const state = publicState(freshGame, got.players, got.conquests);
  const lb = leaderboardFrom(got.players, got.conquests, freshGame.mode);
  await broadcast(supabaseAdmin(), ctx.params.code, [
    { type: "state", payload: state },
    { type: "leaderboard_updated", payload: lb },
  ]);

  // Return the fresh state in the PATCH response so the client can update
  // immediately even before the broadcast or the next poll arrives.
  return ok({ ok: true, state, leaderboard: lb });
}
