// Strongly-typed contracts between client and server.

export type GameMode = "conquest" | "mystery";
export type Difficulty = "easy" | "normal";
export type GameStatus = "lobby" | "playing" | "finished";

export interface GameSettings {
  mode: GameMode;
  durationSec: number;          // conquest: total game ; mystery: per-round
  difficulty: Difficulty;
  maxPlayers: number;
  isPrivate: boolean;
  /** mystery-mode only */
  totalCountries?: 20 | 50 | 100 | 196;
}

export interface Player {
  id: string;          // socket id
  userId: string;      // persistent (guest token)
  username: string;
  color: string;       // hex
  ready: boolean;
  score: number;
  isHost: boolean;
  connected: boolean;
}

export interface ConqueredCountry {
  isoCode: string;     // e.g. "FR"
  playerId: string;
  conqueredAt: number; // epoch ms
}

export interface ChatMessage {
  id: string;
  playerId: string;
  username: string;
  color: string;
  text: string;
  at: number;
}

export interface LeaderboardEntry {
  playerId: string;
  username: string;
  color: string;
  countriesCount: number;
  totalAreaKm2: number;
  worldPercent: number;
  score: number; // mystery-mode points
}

export interface MysteryRound {
  index: number;
  isoCode: string;     // hidden country
  startedAt: number;
  endsAt: number;
  winnerId?: string;
  revealedName?: string;
}

export interface PublicGameState {
  code: string;
  status: GameStatus;
  settings: GameSettings;
  players: Player[];
  hostId: string;
  // conquest
  conquered: ConqueredCountry[];
  startedAt?: number;
  endsAt?: number;
  // mystery
  round?: MysteryRound;
  roundsPlayed?: number;
  totalRounds?: number;
}

// ---------- Socket events ----------

export interface ClientToServerEvents {
  create_game: (
    payload: { username: string; settings: GameSettings },
    cb: (res: { ok: true; code: string } | { ok: false; error: string }) => void
  ) => void;
  join_game: (
    payload: { code: string; username: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  leave_game: () => void;
  ready_up: (payload: { ready: boolean }) => void;
  update_settings: (payload: Partial<GameSettings>) => void;
  start_game: () => void;
  submit_country: (
    payload: { guess: string },
    cb: (res:
      | { ok: true; matched: true; isoCode: string }
      | { ok: true; matched: false }
      | { ok: false; error: string }
    ) => void
  ) => void;
  send_chat: (payload: { text: string }) => void;
  play_again: () => void;
}

export interface ServerToClientEvents {
  state: (state: PublicGameState) => void;
  player_joined: (player: Player) => void;
  player_left: (playerId: string) => void;
  country_conquered: (payload: ConqueredCountry & { username: string; color: string }) => void;
  leaderboard_updated: (entries: LeaderboardEntry[]) => void;
  timer_updated: (payload: { remainingMs: number }) => void;
  chat_message: (msg: ChatMessage) => void;
  mystery_new_round: (round: MysteryRound) => void;
  mystery_round_ended: (round: MysteryRound) => void;
  game_started: (state: PublicGameState) => void;
  game_finished: (payload: { state: PublicGameState; leaderboard: LeaderboardEntry[] }) => void;
  error_message: (msg: string) => void;
}

export interface InterServerEvents {}
export interface SocketData {
  userId: string;
  username: string;
  gameCode?: string;
}
