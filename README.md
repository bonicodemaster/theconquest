# 🌍 World Conquest Quiz

Real-time multiplayer geography game on an interactive world map. Two modes:

- **🌎 Conquest** — first to type a country name claims it. Win the most landmass before time runs out.
- **🎯 Mystery** — a country is highlighted on the map. First to name it scores.

> **Deployment target:** Vercel (Next.js) + Supabase (Postgres + Realtime). The legacy Socket.io server in `server/` is now optional/deprecated. See [DEPLOYMENT_VERCEL.md](./DEPLOYMENT_VERCEL.md).

---

## ✨ Features

- All **196 countries** (193 UN members + Vatican + Kosovo + Taiwan) with capitals, areas, continent, ISO codes, multilingual aliases.
- Server-authoritative game logic in stateless API routes (Vercel-compatible).
- Live state synced over **Supabase Realtime Broadcast** channels (`game:<CODE>`).
- Race-safe conquest claims via Postgres `UNIQUE(game_id, iso_code)`.
- Race-safe Mystery winner via conditional `UPDATE … WHERE mystery_winner_user_id IS NULL`.
- Difficulty modes: **easy** (accents stripped + Levenshtein fuzzy + aliases) and **normal** (exact).
- Live leaderboard with km², %-of-world, country count.
- Real-time chat with anti-spam token-bucket rate limiting.
- Interactive SVG world map (one `<path>` per country, hover tooltips, zoom/pan).
- Lobby with host-controlled settings (mode, duration, difficulty, max players, visibility).
- Animated conquest splash, podium results screen.
- Zod input validation on every API route.
- Guest identity via persistent `localStorage` UUID (no auth required to play).

## 🧱 Stack

| Layer    | Tech |
|----------|------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, TailwindCSS, Framer Motion, Zustand, react-simple-maps |
| API      | Next.js Route Handlers (Node runtime) on Vercel |
| Realtime | Supabase Realtime (Broadcast channels) |
| DB       | Supabase Postgres + RLS |
| Legacy   | `server/` — original Socket.io scaffold, kept for reference |

## 🚀 Getting started (local dev against Supabase)

Requires Node 20+ and a free Supabase project.

```bash
# 1) Create a Supabase project at https://supabase.com
# 2) Run the migration in the SQL editor:
#    supabase/migrations/0001_init.sql

cp .env.example .env.local        # then fill in SUPABASE_URL/keys
cd web && npm install && npm run dev
```

Open **http://localhost:3000**.

> Full deploy walkthrough: [DEPLOYMENT_VERCEL.md](./DEPLOYMENT_VERCEL.md)

## 🗂️ Project layout

```
theconquest.io/
├── web/                          # Next.js app (deploys to Vercel)
│   ├── app/
│   │   ├── page.tsx              # 1. Home (create/join)
│   │   ├── lobby/[code]/         # 2. Lobby + settings + chat
│   │   ├── game/[code]/          # 3. Live game
│   │   ├── results/[code]/       # 4. Podium + stats
│   │   └── api/                  # Stateless route handlers
│   │       ├── _lib.ts           # shared helpers (auth, rate limit, emit)
│   │       ├── countries/        # GET cached country list (edge)
│   │       └── games/            # POST create + per-code routes
│   ├── components/               # WorldMap, Leaderboard, Timer, AnswerInput, Chat
│   ├── lib/
│   │   ├── api.ts                # HTTP client (sends x-user-id header)
│   │   ├── identity.ts           # localStorage UUID
│   │   ├── realtime.ts           # RoomEvent union + broadcast helper
│   │   ├── useGameRealtime.ts    # Supabase channel subscription hook
│   │   ├── supabase/             # browser + service-role clients
│   │   ├── countries.ts          # 196 countries with aliases & areas
│   │   ├── normalize.ts          # accent-strip + Levenshtein matcher
│   │   └── gameLogic.ts          # pure state derivation
│   ├── store/                    # zustand game store
│   └── types/                    # shared types (mode, difficulty, settings…)
├── supabase/
│   └── migrations/0001_init.sql  # schema, RLS, indexes
└── server/                       # ⚠️ DEPRECATED — original Socket.io scaffold
```

## 🎮 Gameplay reference

### Conquest mode
- Host picks duration (1 / 3 / 5 / 10 min), difficulty, max players, visibility.
- Players race to type country names. The first correct guess claims that country.
- Already-claimed countries are locked.
- Winner: largest `Σ areaKm2`. Tie-breaker: country count.

### Mystery mode
- Host picks total countries (20 / 50 / 100 / 196) and per-round timer (10 / 20 / 30 s).
- One country highlighted at a time. First correct answer = 1 pt and next round starts.
- If timer expires, the country name is revealed and the next round starts.

### Matching engine
- `normal`: normalized exact match against name, official name, aliases, ISO-2, ISO numeric.
- `easy`: same as above, plus Levenshtein ≤ 1 for short names, ≤ 2 otherwise.

## 🔌 Realtime contract

Channel: `game:<CODE>` (Supabase Broadcast). Events live in `web/lib/realtime.ts`.

| Event | Payload |
|-------|---------|
| `state` | Full `PublicGameState` snapshot |
| `leaderboard_updated` | `LeaderboardEntry[]` |
| `country_conquered` | `{ isoCode, color, username, score }` |
| `chat_message` | `{ id, userId, username, color, text, ts }` |
| `mystery_new_round` | `{ index, total, endsAt }` |
| `game_started` | full state |
| `game_finished` | `{ state, leaderboard }` |

API routes are the only writers — they call `broadcast(adminClient, code, events)` from `lib/realtime.ts` after mutating Postgres. Clients only subscribe (anon key, read-only RLS).

## 🛡️ Security

- Every inbound payload validated with **zod** in `app/api/_lib.ts`.
- RLS enabled on every table; only the service-role key (server-side) can write.
- Per-(userId, key) token-bucket rate limiting: 8 guesses/sec, 2 chat/sec.
- Guest identity (`x-user-id` header) bound to a persistent `localStorage` UUID.
- Server is the authority for game state — clients never compute scores or claims.

## ⏱️ Timer model

There is no background process in serverless. Timers are **client-driven, server-validated**:
- The game page schedules a `setTimeout` for `endsAt - now`.
- When it fires, the client POSTs `/api/games/[code]/advance`.
- The route uses optimistic concurrency (`WHERE round_index = $current AND status = $expected`) so a double-POST from two clients only succeeds once.

## 🌐 Environment

| Var | Required | Used by |
|-----|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | browser (subscribe-only) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | API routes (writes + broadcast) |

## 📦 Production deploy

1. Create a Supabase project, run `supabase/migrations/0001_init.sql`.
2. Import the repo into Vercel, set Root Directory to `web/`.
3. Add the three Supabase env vars in Vercel project settings.
4. Deploy. That's it — no separate game server, no WebSocket infra.

Detailed walkthrough: [DEPLOYMENT_VERCEL.md](./DEPLOYMENT_VERCEL.md)

## License

MIT
