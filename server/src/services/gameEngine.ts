import type {
  ChatMessage,
  ConqueredCountry,
  GameSettings,
  LeaderboardEntry,
  MysteryRound,
  Player,
  PublicGameState,
} from "../types/shared.js";
import { BY_ISO, COUNTRIES, TOTAL_WORLD_AREA_KM2 } from "../data/countries.js";
import { matchCountry } from "../lib/normalize.js";
import { newGameCode, newId, PLAYER_COLORS } from "../lib/codeGen.js";

type Listener = (state: PublicGameState) => void;

export class Game {
  readonly code: string;
  status: PublicGameState["status"] = "lobby";
  settings: GameSettings;
  players = new Map<string, Player>();
  hostId: string;

  // conquest
  conquered: ConqueredCountry[] = [];
  startedAt?: number;
  endsAt?: number;
  private tickHandle?: NodeJS.Timeout;

  // mystery
  round?: MysteryRound;
  roundsPlayed = 0;
  totalRounds?: number;
  mysteryDeck: string[] = []; // shuffled ISO codes
  private roundHandle?: NodeJS.Timeout;

  chat: ChatMessage[] = [];

  private listeners = new Set<Listener>();
  /** External callbacks set by the socket layer to emit specific events. */
  onCountryConquered?: (c: ConqueredCountry & { username: string; color: string }) => void;
  onLeaderboard?: (l: LeaderboardEntry[]) => void;
  onTimer?: (remainingMs: number) => void;
  onMysteryNew?: (r: MysteryRound) => void;
  onMysteryEnded?: (r: MysteryRound) => void;
  onChat?: (m: ChatMessage) => void;
  onFinished?: (l: LeaderboardEntry[]) => void;

  constructor(host: { userId: string; socketId: string; username: string }, settings: GameSettings) {
    this.code = newGameCode();
    this.settings = settings;
    this.hostId = host.socketId;
    this.addPlayer(host, true);
  }

  // ---------- Players ----------

  private nextColor(): string {
    const used = new Set([...this.players.values()].map((p) => p.color));
    return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[this.players.size % PLAYER_COLORS.length];
  }

  addPlayer(
    p: { userId: string; socketId: string; username: string },
    isHost = false
  ): Player | { error: string } {
    if (this.status !== "lobby") return { error: "Game already started" };
    if (this.players.size >= this.settings.maxPlayers) return { error: "Game is full" };
    const name = p.username.trim();
    if ([...this.players.values()].some((x) => x.username.toLowerCase() === name.toLowerCase())) {
      return { error: "Username taken in this room" };
    }
    const player: Player = {
      id: p.socketId,
      userId: p.userId,
      username: name,
      color: this.nextColor(),
      ready: false,
      score: 0,
      isHost,
      connected: true,
    };
    this.players.set(p.socketId, player);
    return player;
  }

  removePlayer(socketId: string): void {
    const p = this.players.get(socketId);
    if (!p) return;
    this.players.delete(socketId);
    // Reassign host if needed
    if (this.hostId === socketId) {
      const next = this.players.values().next().value;
      if (next) {
        next.isHost = true;
        this.hostId = next.id;
      }
    }
  }

  setReady(socketId: string, ready: boolean): void {
    const p = this.players.get(socketId);
    if (p) p.ready = ready;
  }

  updateSettings(socketId: string, patch: Partial<GameSettings>): boolean {
    if (socketId !== this.hostId) return false;
    if (this.status !== "lobby") return false;
    this.settings = { ...this.settings, ...patch };
    return true;
  }

  // ---------- Start / End ----------

  canStart(socketId: string): true | string {
    if (socketId !== this.hostId) return "Only the host can start";
    if (this.status !== "lobby") return "Already started";
    if (this.players.size < 1) return "Not enough players";
    return true;
  }

  start(): void {
    this.status = "playing";
    this.startedAt = Date.now();

    if (this.settings.mode === "conquest") {
      this.endsAt = this.startedAt + this.settings.durationSec * 1000;
      this.tickHandle = setInterval(() => this.tickConquest(), 1000);
    } else {
      // mystery — pre-shuffle deck of ISO codes
      const total = this.settings.totalCountries ?? 50;
      this.totalRounds = Math.min(total, COUNTRIES.length);
      this.mysteryDeck = shuffle(COUNTRIES.map((c) => c.isoCode)).slice(0, this.totalRounds);
      this.roundsPlayed = 0;
      this.startNextMysteryRound();
    }
  }

  private tickConquest(): void {
    if (!this.endsAt) return;
    const remaining = this.endsAt - Date.now();
    this.onTimer?.(Math.max(0, remaining));
    const allTaken = this.conquered.length >= COUNTRIES.length;
    if (remaining <= 0 || allTaken) this.finish();
  }

  private startNextMysteryRound(): void {
    if (!this.totalRounds) return;
    if (this.roundsPlayed >= this.totalRounds) return this.finish();

    const iso = this.mysteryDeck[this.roundsPlayed];
    const startedAt = Date.now();
    const endsAt = startedAt + this.settings.durationSec * 1000;
    this.round = { index: this.roundsPlayed, isoCode: iso, startedAt, endsAt };
    this.onMysteryNew?.(this.round);

    clearTimeout(this.roundHandle);
    this.roundHandle = setTimeout(() => this.endMysteryRound(false), this.settings.durationSec * 1000);
  }

  private endMysteryRound(matched: boolean): void {
    if (!this.round) return;
    if (!matched) {
      this.round.revealedName = BY_ISO[this.round.isoCode]?.name;
    }
    this.onMysteryEnded?.(this.round);
    this.roundsPlayed++;
    // small delay before next
    clearTimeout(this.roundHandle);
    this.roundHandle = setTimeout(() => this.startNextMysteryRound(), 2500);
  }

  private finish(): void {
    if (this.status === "finished") return;
    this.status = "finished";
    clearInterval(this.tickHandle);
    clearTimeout(this.roundHandle);
    this.onFinished?.(this.leaderboard());
  }

  // ---------- Guessing ----------

  submit(socketId: string, raw: string):
    | { ok: false; error: string }
    | { ok: true; matched: false }
    | { ok: true; matched: true; isoCode: string } {
    const p = this.players.get(socketId);
    if (!p) return { ok: false, error: "Not in game" };
    if (this.status !== "playing") return { ok: false, error: "Not playing" };

    const country = matchCountry(raw, this.settings.difficulty);
    if (!country) return { ok: true, matched: false };

    if (this.settings.mode === "conquest") {
      if (this.conquered.some((c) => c.isoCode === country.isoCode)) {
        return { ok: true, matched: false }; // already taken
      }
      const conq: ConqueredCountry = {
        isoCode: country.isoCode,
        playerId: p.id,
        conqueredAt: Date.now(),
      };
      this.conquered.push(conq);
      p.score += 1; // count of countries
      this.onCountryConquered?.({ ...conq, username: p.username, color: p.color });
      this.onLeaderboard?.(this.leaderboard());
      if (this.conquered.length >= COUNTRIES.length) this.finish();
      return { ok: true, matched: true, isoCode: country.isoCode };
    }

    // mystery
    if (!this.round || this.round.winnerId) return { ok: true, matched: false };
    if (country.isoCode !== this.round.isoCode) return { ok: true, matched: false };
    this.round.winnerId = p.id;
    p.score += 1;
    this.onLeaderboard?.(this.leaderboard());
    this.endMysteryRound(true);
    return { ok: true, matched: true, isoCode: country.isoCode };
  }

  // ---------- Chat ----------

  pushChat(socketId: string, text: string): ChatMessage | null {
    const p = this.players.get(socketId);
    if (!p) return null;
    const msg: ChatMessage = {
      id: newId(),
      playerId: p.id,
      username: p.username,
      color: p.color,
      text,
      at: Date.now(),
    };
    this.chat.push(msg);
    if (this.chat.length > 200) this.chat.shift();
    this.onChat?.(msg);
    return msg;
  }

  // ---------- Snapshot ----------

  leaderboard(): LeaderboardEntry[] {
    const byPlayer = new Map<string, { area: number; count: number }>();
    for (const p of this.players.values()) {
      byPlayer.set(p.id, { area: 0, count: 0 });
    }
    for (const c of this.conquered) {
      const stat = byPlayer.get(c.playerId);
      const country = BY_ISO[c.isoCode];
      if (stat && country) {
        stat.area += country.areaKm2;
        stat.count += 1;
      }
    }
    const entries: LeaderboardEntry[] = [];
    for (const p of this.players.values()) {
      const s = byPlayer.get(p.id)!;
      entries.push({
        playerId: p.id,
        username: p.username,
        color: p.color,
        countriesCount: s.count,
        totalAreaKm2: s.area,
        worldPercent: +(s.area / TOTAL_WORLD_AREA_KM2 * 100).toFixed(2),
        score: p.score,
      });
    }
    return this.settings.mode === "conquest"
      ? entries.sort((a, b) => b.totalAreaKm2 - a.totalAreaKm2)
      : entries.sort((a, b) => b.score - a.score);
  }

  snapshot(): PublicGameState {
    return {
      code: this.code,
      status: this.status,
      settings: this.settings,
      players: [...this.players.values()],
      hostId: this.hostId,
      conquered: this.conquered,
      startedAt: this.startedAt,
      endsAt: this.endsAt,
      round: this.round,
      roundsPlayed: this.roundsPlayed,
      totalRounds: this.totalRounds,
    };
  }

  resetForReplay(): void {
    clearInterval(this.tickHandle);
    clearTimeout(this.roundHandle);
    this.status = "lobby";
    this.conquered = [];
    this.startedAt = undefined;
    this.endsAt = undefined;
    this.round = undefined;
    this.roundsPlayed = 0;
    this.totalRounds = undefined;
    this.mysteryDeck = [];
    for (const p of this.players.values()) {
      p.score = 0;
      p.ready = false;
    }
  }

  dispose(): void {
    clearInterval(this.tickHandle);
    clearTimeout(this.roundHandle);
    this.listeners.clear();
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
