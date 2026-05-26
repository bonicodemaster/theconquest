"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "./supabase/client";
import { channelName, type RoomEvent } from "./realtime";
import { useGameStore } from "@/store/gameStore";
import { getUserId } from "./identity";
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
  const pushConquest = useGameStore((s) => s.pushConquest);
  const resetFeed = useGameStore((s) => s.resetConquestFeed);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    const refetch = () => {
      api.getState(code).then((r) => {
        if (cancelled || !r.ok) return;
        // Sync to server time: derive (server − client) clock offset so the
        // countdown uses server time, not the device clock (a friend's clock 20s
        // behind showed 10s rounds as 30s). Only adopt meaningful drift (>750ms)
        // so request-latency jitter can't wobble the displayed timer.
        const sn = (r.data as { serverNow?: number }).serverNow;
        if (typeof sn === "number") {
          const off = sn - Date.now();
          const store = useGameStore.getState();
          if (Math.abs(off - store.serverOffset) > 750) store.setServerOffset(off);
        }
        // Drop stale reads (replica lag / cached GET): if this read is an older
        // version of the same room than what we already hold, ignore it
        // entirely — state AND leaderboard — so it can't revert settings or
        // bounce us back to the lobby.
        const cur = useGameStore.getState().state;
        const incoming = r.data.state;
        if (cur && cur.code === incoming.code && incoming.version < cur.version) return;
        setState(incoming);
        setLb(r.data.leaderboard);
      });
    };

    // 1) Initial snapshot
    refetch();

    // 1b) Safety-net poll: catches missed broadcasts in serverless environments
    const pollId = setInterval(refetch, 1500);

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
    on("country_conquered", (c) => {
      const ev = {
        isoCode: c.isoCode,
        color: c.color,
        username: c.username,
        name: c.name,
        points: c.points,
        difficulty: c.difficulty,
        isMe: c.playerId === getUserId(),
        at: Date.now() + Math.random(),
      };
      setLast(ev);
      pushConquest(ev);
    });
    on("mystery_new_round", () => setLast(null));
    on("game_started", (st) => {
      resetFeed();
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
  }, [code, router, setState, setLb, pushChat, setLast, pushConquest, resetFeed]);
}
