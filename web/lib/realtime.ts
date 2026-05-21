/**
 * Thin wrapper around Supabase Realtime "broadcast" channels.
 * One channel per game room: `game:<CODE>`.
 *
 * Events mirror the original Socket.io contract.
 *
 * SERVER-SIDE broadcasting is done via the Realtime HTTP endpoint
 * (no channel subscribe/unsubscribe handshake → ~10× faster).
 */
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
 * Uses Supabase Realtime's HTTP broadcast API so we don't pay the cost of
 * opening + subscribing + closing a WebSocket channel on every API request.
 *
 * Docs: POST {SUPABASE_URL}/realtime/v1/api/broadcast
 *   { messages: [{ topic, event, payload, private }] }
 *
 * The first arg (`_client`) is kept for API compatibility with existing
 * callers but is no longer used.
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
  const topic = channelName(code);
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: events.map((e) => ({
          topic,
          event: e.type,
          payload: e.payload,
          private: false,
        })),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[broadcast] non-200", res.status, body);
    }
  } catch (err) {
    console.error("[broadcast] HTTP send failed", err);
  }
}
