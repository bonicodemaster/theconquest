import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types/shared.js";
import { rooms } from "../services/roomManager.js";
import { newPlayerId } from "../lib/codeGen.js";
import {
  chatSchema,
  createGameSchema,
  guessSchema,
  joinGameSchema,
  settingsSchema,
} from "../validators/events.js";

// In-memory simple rate limiter (per-socket / event).
function rateLimiter(perSec: number) {
  const buckets = new Map<string, { tokens: number; ts: number }>();
  return (key: string) => {
    const now = Date.now();
    const b = buckets.get(key) ?? { tokens: perSec, ts: now };
    const elapsed = (now - b.ts) / 1000;
    b.tokens = Math.min(perSec, b.tokens + elapsed * perSec);
    b.ts = now;
    if (b.tokens < 1) {
      buckets.set(key, b);
      return false;
    }
    b.tokens -= 1;
    buckets.set(key, b);
    return true;
  };
}

const limitGuess = rateLimiter(8); // 8 guesses / sec / player
const limitChat = rateLimiter(2);  // 2 messages / sec / player

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerHandlers(io: TypedServer): void {
  io.on("connection", (socket: TypedSocket) => {
    socket.data.userId = (socket.handshake.auth?.userId as string) || newPlayerId();
    socket.data.username = "";

    socket.on("create_game", (raw, cb) => {
      const parsed = createGameSchema.safeParse(raw);
      if (!parsed.success) return cb({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" });
      const { username, settings } = parsed.data;
      socket.data.username = username;
      const game = rooms.create({ userId: socket.data.userId, socketId: socket.id, username }, settings);
      bindGameEvents(io, game);
      socket.join(game.code);
      socket.data.gameCode = game.code;
      cb({ ok: true, code: game.code });
      io.to(game.code).emit("state", game.snapshot());
    });

    socket.on("join_game", (raw, cb) => {
      const parsed = joinGameSchema.safeParse(raw);
      if (!parsed.success) return cb({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" });
      const game = rooms.get(parsed.data.code);
      if (!game) return cb({ ok: false, error: "Room not found" });
      const r = game.addPlayer({ userId: socket.data.userId, socketId: socket.id, username: parsed.data.username });
      if ("error" in r) return cb({ ok: false, error: r.error });
      rooms.attach(socket.id, game.code);
      socket.join(game.code);
      socket.data.username = parsed.data.username;
      socket.data.gameCode = game.code;
      cb({ ok: true });
      io.to(game.code).emit("player_joined", r);
      io.to(game.code).emit("state", game.snapshot());
    });

    socket.on("leave_game", () => handleLeave(io, socket));

    socket.on("ready_up", ({ ready }) => {
      const game = rooms.gameOf(socket.id);
      if (!game) return;
      game.setReady(socket.id, !!ready);
      io.to(game.code).emit("state", game.snapshot());
    });

    socket.on("update_settings", (patch) => {
      const game = rooms.gameOf(socket.id);
      if (!game) return;
      const parsed = settingsSchema.partial().safeParse(patch);
      if (!parsed.success) return;
      if (game.updateSettings(socket.id, parsed.data)) {
        io.to(game.code).emit("state", game.snapshot());
      }
    });

    socket.on("start_game", () => {
      const game = rooms.gameOf(socket.id);
      if (!game) return;
      const can = game.canStart(socket.id);
      if (can !== true) return socket.emit("error_message", can);
      game.start();
      io.to(game.code).emit("game_started", game.snapshot());
      io.to(game.code).emit("state", game.snapshot());
      io.to(game.code).emit("leaderboard_updated", game.leaderboard());
    });

    socket.on("submit_country", (raw, cb) => {
      if (!limitGuess(socket.id)) return cb({ ok: false, error: "Slow down" });
      const parsed = guessSchema.safeParse(raw);
      if (!parsed.success) return cb({ ok: false, error: "Invalid input" });
      const game = rooms.gameOf(socket.id);
      if (!game) return cb({ ok: false, error: "Not in a game" });
      const r = game.submit(socket.id, parsed.data.guess);
      cb(r);
    });

    socket.on("send_chat", (raw) => {
      if (!limitChat(socket.id)) return;
      const parsed = chatSchema.safeParse(raw);
      if (!parsed.success) return;
      const game = rooms.gameOf(socket.id);
      if (!game) return;
      game.pushChat(socket.id, parsed.data.text);
    });

    socket.on("play_again", () => {
      const game = rooms.gameOf(socket.id);
      if (!game) return;
      if (socket.id !== game.hostId) return;
      game.resetForReplay();
      io.to(game.code).emit("state", game.snapshot());
    });

    socket.on("disconnect", () => handleLeave(io, socket));
  });
}

function handleLeave(io: TypedServer, socket: TypedSocket): void {
  const game = rooms.gameOf(socket.id);
  if (!game) return;
  game.removePlayer(socket.id);
  rooms.detach(socket.id);
  socket.leave(game.code);
  io.to(game.code).emit("player_left", socket.id);
  io.to(game.code).emit("state", game.snapshot());
  if (game.players.size === 0) rooms.destroy(game.code);
}

/** Wire game-engine callbacks → socket.io emissions. Idempotent. */
function bindGameEvents(io: TypedServer, game: ReturnType<typeof rooms.create>): void {
  game.onCountryConquered = (c) => io.to(game.code).emit("country_conquered", c);
  game.onLeaderboard = (l) => io.to(game.code).emit("leaderboard_updated", l);
  game.onTimer = (remainingMs) => io.to(game.code).emit("timer_updated", { remainingMs });
  game.onMysteryNew = (r) => io.to(game.code).emit("mystery_new_round", r);
  game.onMysteryEnded = (r) => io.to(game.code).emit("mystery_round_ended", r);
  game.onChat = (m) => io.to(game.code).emit("chat_message", m);
  game.onFinished = (l) =>
    io.to(game.code).emit("game_finished", { state: game.snapshot(), leaderboard: l });
}
