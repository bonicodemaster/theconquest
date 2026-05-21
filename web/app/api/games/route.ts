import { z } from "zod";
import {
  bad, getUserId, ok, parseBody,
  settingsSchema, usernameSchema,
} from "../_lib";
import { supabaseAdmin } from "@/lib/supabase/server";
import { newGameCode, PLAYER_COLORS } from "@/lib/codeGen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ username: usernameSchema, settings: settingsSchema });

export async function POST(req: Request) {
  try {
    const userId = getUserId(req);
    if (!userId) return bad("Missing user id", 401);

    const p = await parseBody(req, schema);
    if (!p.ok) return p.res;

    const admin = supabaseAdmin();
    const code = newGameCode();

    const { data: game, error } = await admin
      .from("games")
      .insert({
        code,
        mode: p.data.settings.mode,
        difficulty: p.data.settings.difficulty,
        duration_sec: p.data.settings.durationSec,
        max_players: p.data.settings.maxPlayers,
        is_private: p.data.settings.isPrivate,
        total_countries: p.data.settings.totalCountries ?? null,
        host_user_id: userId,
      })
      .select("id")
      .single();

    if (error || !game) {
      console.error("[api/games] insert games failed", error);
      return bad(error?.message ?? "Could not create game", 500);
    }

    const { error: pe } = await admin.from("players").insert({
      game_id: game.id,
      user_id: userId,
      username: p.data.username,
      color: PLAYER_COLORS[0],
      is_host: true,
    });
    if (pe) {
      console.error("[api/games] insert players failed", pe);
      await admin.from("games").delete().eq("id", game.id);
      return bad(pe.message, 500);
    }

    return ok({ code });
  } catch (e: any) {
    console.error("[api/games] unhandled", e);
    return bad(e?.message ?? "Internal error", 500);
  }
}
