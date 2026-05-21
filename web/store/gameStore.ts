import { create } from "zustand";
import type { ChatMessage, LeaderboardEntry, PublicGameState } from "@/types/shared";

interface GameStore {
  username: string;
  setUsername: (u: string) => void;

  state: PublicGameState | null;
  setState: (s: PublicGameState | null) => void;

  leaderboard: LeaderboardEntry[];
  setLeaderboard: (l: LeaderboardEntry[]) => void;

  chat: ChatMessage[];
  pushChat: (m: ChatMessage) => void;
  resetChat: () => void;

  remainingMs: number;
  setRemaining: (n: number) => void;

  /** Recent conquest events for animation triggers */
  lastConquest: { isoCode: string; color: string; username: string; at: number } | null;
  setLastConquest: (c: GameStore["lastConquest"]) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  username:
    typeof window !== "undefined"
      ? localStorage.getItem("conquest.username") || ""
      : "",
  setUsername: (u) => {
    if (typeof window !== "undefined") localStorage.setItem("conquest.username", u);
    set({ username: u });
  },

  state: null,
  // Drop stale reads: for the same room, never let an older DB version
  // (replica lag / cached GET) overwrite newer state. Equal versions are
  // allowed through (e.g. a player join re-broadcasts without bumping the
  // games row). A different code is always a different room → accept.
  setState: (s) =>
    set((cur) => {
      if (
        s && cur.state &&
        s.code === cur.state.code &&
        s.version < cur.state.version
      ) {
        return cur;
      }
      return { state: s };
    }),

  leaderboard: [],
  setLeaderboard: (l) => set({ leaderboard: l }),

  chat: [],
  pushChat: (m) => set((s) => ({ chat: [...s.chat.slice(-99), m] })),
  resetChat: () => set({ chat: [] }),

  remainingMs: 0,
  setRemaining: (n) => set({ remainingMs: n }),

  lastConquest: null,
  setLastConquest: (c) => set({ lastConquest: c }),
}));
