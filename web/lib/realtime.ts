/**
 * Thin wrapper around Supabase Realtime "broadcast" channels.
 * One channel per game room: `game:<CODE>`.
 *
 * Events mirror the original Socket.io contract.
 */
import { createClient } from "@supabase/supabase-js";
import type {
  ChatMessage,
  ConqueredCountry,
  LeaderboardEntry,
  MysteryRound,
  Player,
  PublicGameState,
} from "@/types/shared";

export type RoomEvent =
  | { type: "state";                payload: PublicGameState }
  | { type: "player_joined";        payload: Player }
  | { type: "player_left";          payload: { playerId: string } }
  | { type: "country_conquered";    payload: ConqueredCountry & { username: string; color: string } }
  | { type: "leaderboard_updated";  payload: LeaderboardEntry[] }
  | { type: "chat_message";         payload: ChatMessage }
  | { type: "mystery_new_round";    payload: MysteryRound }
  | { type: "mystery_round_ended";  payload: MysteryRound }
  | { type: "game_started";         payload: PublicGameState }
  | { type: "game_finished";        payload: { state: PublicGameState; leaderboard: LeaderboardEntry[] } };

export const channelName = (code: string) => `game:${code.toUpperCase()}`;

/**
 * Server-side broadcast helper.
 * Uses Supabase Realtime via a short-lived WebSocket: opens channel,
 * subscribes, sends all events, unsubscribes. This is the only
 * delivery mechanism guaranteed to reach existing subscribers, because
 * the supabase-js client subscribes on internal topic "realtime:<name>".
 *
 * The (unused) first arg is kept for API compatibility with callers that
 * still pass `supabaseAdmin()`.
 */
export async function broadcast(
  _client: unknown,
  code: string,
  events: RoomEvent[]
): Promise<void> {
  if (events.length === 0) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[broadcast] Supabase env missing");
    return;
  }
  // A short-lived client per call. Realtime needs a persistent socket to
  // subscribe, and we want to tear it down so the serverless function exits.
  const c = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 50 } },
  });
  const ch = c.channel(channelName(code), {
    config: { broadcast: { self: true, ack: false } },
  });
  try {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.error("[broadcast] subscribe timeout");
        resolve();
      }, 4000);
      ch.subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        clearTimeout(timeout);
        for (const e of events) {
          await ch.send({ type: "broadcast", event: e.type, payload: e.payload });
        }
        resolve();
      });
    });
  } finally {
    try { await ch.unsubscribe(); } catch {}
    try { await c.removeAllChannels(); } catch {}
  }
}
