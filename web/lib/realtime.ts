/**
 * Thin wrapper around Supabase Realtime "broadcast" channels.
 * One channel per game room: `game:<CODE>`.
 *
 * Events mirror the original Socket.io contract.
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
 *   Call from API routes after mutating Postgres.
 *   `client` can be the service-role client or the anon one — broadcasts
 *   don't require RLS as long as the channel is open.
 */
export async function broadcast(
  client: import("@supabase/supabase-js").SupabaseClient,
  code: string,
  events: RoomEvent[]
): Promise<void> {
  const ch = client.channel(channelName(code), {
    config: { broadcast: { self: true, ack: false } },
  });
  await new Promise<void>((resolve) => {
    ch.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      for (const e of events) {
        await ch.send({ type: "broadcast", event: e.type, payload: e.payload });
      }
      // Detach immediately — stateless Vercel function should not linger.
      await ch.unsubscribe();
      resolve();
    });
  });
}
