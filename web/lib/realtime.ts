/**
 * Thin wrapper around Supabase Realtime "broadcast" channels.
 * One channel per game room: `game:<CODE>`.
 *
 * Events mirror the original Socket.io contract.
 *
 * IMPORTANT in serverless: broadcast() always resolves within ~700ms even
 * if Supabase's WebSocket handshake fails. We deliberately do NOT block the
 * API response on a successful broadcast — the client also polls every
 * 1.5s as a safety net, so missed broadcasts are harmless.
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

const SUBSCRIBE_TIMEOUT_MS = 700;

export async function broadcast(
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

  const c = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 50 } },
  });
  const ch = c.channel(channelName(code), {
    config: { broadcast: { self: true, ack: false } },
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        resolve();
      };
      timer = setTimeout(() => {
        console.warn("[broadcast] subscribe timeout, abandoning");
        finish();
      }, SUBSCRIBE_TIMEOUT_MS);
      ch.subscribe(async (status) => {
        if (done) return;
        if (status !== "SUBSCRIBED") return;
        try {
          for (const e of events) {
            await ch.send({ type: "broadcast", event: e.type, payload: e.payload });
          }
        } catch (err) {
          console.error("[broadcast] send error", err);
        }
        finish();
      });
    });
  } finally {
    // Always tear down — never block the response on cleanup
    void (async () => {
      try { await ch.unsubscribe(); } catch {}
      try { await c.removeAllChannels(); } catch {}
    })();
  }
}
