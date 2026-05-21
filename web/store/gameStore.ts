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
  setState: (s) => set({ state: s }),

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
