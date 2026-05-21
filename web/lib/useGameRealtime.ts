"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "./supabase/client";
import { channelName, type RoomEvent } from "./realtime";
import { useGameStore } from "@/store/gameStore";
import { api } from "./api";

/**
 * Mount once per game-related page. Subscribes to the room's broadcast channel
 * and seeds the store from /api/games/[code].
 */
export function useGameRealtime(code?: string) {
  const router = useRouter();
  const setState = useGameStore((s) => s.setState);
  const setLb = useGameStore((s) => s.setLeaderboard);
  const pushChat = useGameStore((s) => s.pushChat);
  const setLast = useGameStore((s) => s.setLastConquest);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    const refetch = () => {
      api.getState(code).then((r) => {
        if (cancelled || !r.ok) return;
        setState(r.data.state);
        setLb(r.data.leaderboard);
      });
    };

    // 1) Initial snapshot
    refetch();

    // 1b) Safety-net poll: catches missed broadcasts in serverless environments
    const pollId = setInterval(refetch, 4000);

    // 2) Subscribe to live channel
    const ch = supabaseBrowser().channel(channelName(code), {
      config: { broadcast: { self: true, ack: false } },
    });

    const on = <T extends RoomEvent["type"]>(
      type: T,
      cb: (payload: Extract<RoomEvent, { type: T }>["payload"]) => void
    ) => ch.on("broadcast", { event: type }, ({ payload }) => cb(payload));

    on("state", (s) => setState(s));
    on("leaderboard_updated", (l) => setLb(l));
    on("chat_message", (m) => pushChat(m));
    on("country_conquered", (c) =>
      setLast({ isoCode: c.isoCode, color: c.color, username: c.username, at: Date.now() })
    );
    on("mystery_new_round", () => setLast(null));
    on("game_started", (st) => {
      setState(st);
      router.push(`/game/${code}`);
    });
    on("game_finished", ({ state, leaderboard }) => {
      setState(state);
      setLb(leaderboard);
      router.push(`/results/${code}`);
    });

    ch.subscribe();

    return () => {
      cancelled = true;
      clearInterval(pollId);
      supabaseBrowser().removeChannel(ch);
    };
  }, [code, router, setState, setLb, pushChat, setLast]);
}
