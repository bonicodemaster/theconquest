// Mirror of server/src/types/shared.ts — keep in sync.
export type GameMode = "conquest" | "mystery";
export type Difficulty = "easy" | "normal";
export type GameStatus = "lobby" | "playing" | "finished";

export interface GameSettings {
  mode: GameMode;
  durationSec: number;
  difficulty: Difficulty;
  maxPlayers: number;
  isPrivate: boolean;
  totalCountries?: 20 | 50 | 100 | 196;
}

export interface Player {
  id: string;
  userId: string;
  username: string;
  color: string;
  ready: boolean;
  score: number;
  isHost: boolean;
  connected: boolean;
}

export interface ConqueredCountry {
  isoCode: string;
  playerId: string;
  conqueredAt: number;
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
  score: number;
}

export interface MysteryRound {
  index: number;
  isoCode: string;
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
  conquered: ConqueredCountry[];
  startedAt?: number;
  endsAt?: number;
  round?: MysteryRound;
  roundsPlayed?: number;
  totalRounds?: number;
}
