import type { GameSettings } from "../types/shared.js";
import { Game } from "./gameEngine.js";

class RoomManager {
  private games = new Map<string, Game>();
  /** Reverse-lookup: socket id -> game code (one game per socket at a time) */
  private bySocket = new Map<string, string>();

  create(host: { userId: string; socketId: string; username: string }, settings: GameSettings): Game {
    const g = new Game(host, settings);
    this.games.set(g.code, g);
    this.bySocket.set(host.socketId, g.code);
    return g;
  }

  get(code: string): Game | undefined {
    return this.games.get(code.toUpperCase());
  }

  gameOf(socketId: string): Game | undefined {
    const code = this.bySocket.get(socketId);
    return code ? this.games.get(code) : undefined;
  }

  attach(socketId: string, code: string): void {
    this.bySocket.set(socketId, code);
  }

  detach(socketId: string): Game | undefined {
    const code = this.bySocket.get(socketId);
    this.bySocket.delete(socketId);
    return code ? this.games.get(code) : undefined;
  }

  destroy(code: string): void {
    const g = this.games.get(code);
    if (!g) return;
    g.dispose();
    this.games.delete(code);
  }

  list() {
    return [...this.games.values()].map((g) => ({
      code: g.code,
      mode: g.settings.mode,
      status: g.status,
      players: g.players.size,
      maxPlayers: g.settings.maxPlayers,
      isPrivate: g.settings.isPrivate,
    }));
  }
}

export const rooms = new RoomManager();
