import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { registerHandlers } from "./sockets/index.js";
import { rooms } from "./services/roomManager.js";
import { COUNTRIES } from "./data/countries.js";

const PORT = Number(process.env.SERVER_PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "32kb" }));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.get("/api/rooms", (_req, res) =>
  res.json(rooms.list().filter((r) => !r.isPrivate && r.status === "lobby"))
);

app.get("/api/countries", (_req, res) =>
  res.json(
    COUNTRIES.map((c) => ({
      isoCode: c.isoCode,
      numericId: c.numericId,
      name: c.name,
      capital: c.capital,
      continent: c.continent,
      areaKm2: c.areaKm2,
    }))
  )
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, credentials: true },
  pingInterval: 20_000,
  pingTimeout: 25_000,
});

registerHandlers(io);

server.listen(PORT, () => {
  console.log(`🌍  Conquest server listening on :${PORT} (CORS: ${CORS_ORIGIN})`);
});

const shutdown = () => {
  console.log("Shutting down…");
  io.close();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
