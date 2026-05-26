import { create } from "zustand";
import type { ChatMessage, LeaderboardEntry, PublicGameState } from "@/types/shared";
import { DEFAULT_LANG, type Lang } from "@/lib/i18n/messages";

interface GameStore {
  username: string;
  setUsername: (u: string) => void;

  /** UI language — a per-client preference (persisted to localStorage). */
  lang: Lang;
  setLang: (l: Lang) => void;

  state: PublicGameState | null;
  setState: (s: PublicGameState | null) => void;

  leaderboard: LeaderboardEntry[];
  setLeaderboard: (l: LeaderboardEntry[]) => void;

  chat: ChatMessage[];
  pushChat: (m: ChatMessage) => void;
  resetChat: () => void;

  remainingMs: number;
  setRemaining: (n: number) => void;

  /** Estimated (server clock − client clock) in ms, refreshed by the state poll.
   *  The countdown runs against server time so a skewed device clock can't
   *  distort timers (a friend's clock 20s behind showed 10s rounds as 30s). */
  serverOffset: number;
  setServerOffset: (ms: number) => void;

  /** Most recent conquest — drives the map glow + capture flash. */
  lastConquest: ConquestEvent | null;
  setLastConquest: (c: ConquestEvent | null) => void;

  /** Rolling feed of recent conquests (newest first) for the toast strip. */
  conquestFeed: ConquestEvent[];
  pushConquest: (c: ConquestEvent) => void;
  resetConquestFeed: () => void;
}

export interface ConquestEvent {
  isoCode: string;
  color: string;
  username: string;
  name: string;
  points: number;
  difficulty: number;
  isMe: boolean;
  at: number;
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

  // Always starts at the default so the server render and the first client
  // render agree (no hydration mismatch). <LangBoot/> reads localStorage once
  // after mount and switches to the saved language.
  lang: DEFAULT_LANG,
  setLang: (l) => {
    if (typeof window !== "undefined") localStorage.setItem("conquest.lang", l);
    set({ lang: l });
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

  serverOffset: 0,
  setServerOffset: (ms) => set({ serverOffset: ms }),

  lastConquest: null,
  setLastConquest: (c) => set({ lastConquest: c }),

  conquestFeed: [],
  pushConquest: (c) => set((s) => ({ conquestFeed: [c, ...s.conquestFeed].slice(0, 8) })),
  resetConquestFeed: () => set({ conquestFeed: [] }),
}));
