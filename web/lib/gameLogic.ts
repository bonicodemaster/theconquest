/**
 * Pure functions — no DB, no Supabase. Used by API routes to derive
 * leaderboard / public state from raw DB rows.
 */
import { BY_ISO, TOTAL_WORLD_AREA_KM2 } from "./countries";
import type {
  ConqueredCountry,
  LeaderboardEntry,
  MysteryRound,
  Player,
  PublicGameState,
  GameSettings,
  GameStatus,
  Difficulty,
  GameMode,
} from "@/types/shared";

/** How long the correct answer stays revealed between Pays Mystère rounds (ms). */
export const MYSTERY_REVEAL_MS = 3000;

export interface GameRow {
  id: string;
  code: string;
  mode: GameMode;
  status: GameStatus;
  difficulty: Difficulty;
  duration_sec: number;
  max_players: number;
  is_private: boolean;
  total_countries: number | null;
  region: string | null;
  host_user_id: string;
  started_at: string | null;
  ends_at: string | null;
  round_index: number;
  total_rounds: number | null;
  mystery_iso: string | null;
  mystery_deck: string[] | null;
  mystery_winner_user_id: string | null;
  mystery_revealed_name: string | null;
  mystery_round_started_at: string | null;
  updated_at: string;
}

export interface PlayerRow {
  id: string;
  user_id: string;
  username: string;
  color: string;
  ready: boolean;
  score: number;
  is_host: boolean;
}

export interface ConquestRow {
  iso_code: string;
  user_id: string;
  conquered_at: string;
}

export function settingsOf(g: GameRow): GameSettings {
  return {
    mode: g.mode,
    durationSec: g.duration_sec,
    difficulty: g.difficulty,
    maxPlayers: g.max_players,
    isPrivate: g.is_private,
    totalCountries: g.total_countries as GameSettings["totalCountries"],
    region: (g.region as GameSettings["region"]) ?? null,
  };
}

export function publicState(
  g: GameRow,
  ps: PlayerRow[],
  cs: ConquestRow[]
): PublicGameState {
  const players: Player[] = ps.map((p) => ({
    id: p.user_id,           // we use user_id as the stable id
    userId: p.user_id,
    username: p.username,
    color: p.color,
    ready: p.ready,
    score: p.score,
    isHost: p.is_host,
    connected: true,
  }));

  const conquered: ConqueredCountry[] = cs.map((c) => ({
    isoCode: c.iso_code,
    playerId: c.user_id,
    conqueredAt: new Date(c.conquered_at).getTime(),
  }));

  // Both round-based modes (Pays Mystère + Capitales) expose a round.
  const round: MysteryRound | undefined =
    g.mode !== "conquest" && g.mystery_iso && g.mystery_round_started_at && g.ends_at
      ? {
          index: g.round_index,
          isoCode: g.mystery_iso,
          startedAt: new Date(g.mystery_round_started_at).getTime(),
          endsAt: new Date(g.ends_at).getTime(),
          winnerId: g.mystery_winner_user_id ?? undefined,
          revealedName: g.mystery_revealed_name ?? undefined,
        }
      : undefined;

  return {
    code: g.code,
    // Falls back to 0 if somehow absent so a missing version never blocks updates.
    version: g.updated_at ? new Date(g.updated_at).getTime() : 0,
    status: g.status,
    settings: settingsOf(g),
    players,
    hostId: g.host_user_id,
    conquered,
    startedAt: g.started_at ? new Date(g.started_at).getTime() : undefined,
    endsAt: g.ends_at ? new Date(g.ends_at).getTime() : undefined,
    round,
    roundsPlayed: g.round_index,
    totalRounds: g.total_rounds ?? undefined,
  };
}

export function leaderboardFrom(
  players: PlayerRow[],
  conquests: ConquestRow[],
  mode: GameMode
): LeaderboardEntry[] {
  const stats = new Map<string, { area: number; count: number }>();
  for (const p of players) stats.set(p.user_id, { area: 0, count: 0 });
  for (const c of conquests) {
    const s = stats.get(c.user_id);
    const country = BY_ISO[c.iso_code];
    if (s && country) {
      s.area += country.areaKm2;
      s.count += 1;
    }
  }
  const entries: LeaderboardEntry[] = players.map((p) => {
    const s = stats.get(p.user_id)!;
    return {
      playerId: p.user_id,
      username: p.username,
      color: p.color,
      countriesCount: s.count,
      totalAreaKm2: s.area,
      worldPercent: +(s.area / TOTAL_WORLD_AREA_KM2 * 100).toFixed(2),
      score: p.score,
    };
  });
  // Both modes now rank by points (score). Area is only a tiebreaker / a
  // secondary stat — conquering Russia + China no longer auto-wins.
  return entries.sort((a, b) => b.score - a.score || b.totalAreaKm2 - a.totalAreaKm2);
}
