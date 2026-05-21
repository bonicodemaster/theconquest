# 🗺️ Project Roadmap — World Conquest Quiz

Living document. Update after every shipped feature.
Last update: 2026-05-21 · Status: **MVP refactored for Vercel + Supabase, ready to deploy after first smoke test**.

Legend: ✅ done · 🟡 partial · 🔵 in progress · ⬜ todo · 🟣 nice-to-have

---

## 0. Status at a glance

| Area | Status | Notes |
|---|---|---|
| Monorepo + tooling | ✅ | `web/` (Next.js) is the only deploy target; `server/` is legacy |
| Country data (196 countries) | ✅ | 193 UN + Vatican + Kosovo + Taiwan |
| Postgres schema (Supabase) | ✅ | `supabase/migrations/0001_init.sql` |
| API routes (stateless, Vercel-ready) | ✅ | full Socket parity in `web/app/api/games/**` |
| Realtime transport (Supabase Broadcast) | ✅ | `lib/realtime.ts` + `useGameRealtime` hook |
| Client refactor (no Socket.io) | ✅ | all pages + components use `api` + `useGameRealtime` |
| Conquest mode (race-safe claims) | ✅ | Postgres UNIQUE constraint |
| Mystery mode (race-safe winner) | ✅ | conditional UPDATE |
| Real-time chat | ✅ | rate-limited per (user, key) |
| Auth | 🟡 | guest-only (UUID in localStorage, sent as `x-user-id`) |
| Tests | 🟡 | normalize unit tests; no integration tests against API routes yet |
| Deploy | 🔵 | guide written ([DEPLOYMENT_VERCEL.md](DEPLOYMENT_VERCEL.md)); not yet provisioned |
| Legacy Socket.io server | 🟡 | preserved in `server/` for reference; safe to delete |

---

## 1. ✅ Done

### 1.1 Project foundation
- npm workspaces (`web/`, `server/`)
- TypeScript strict on both sides
- Tailwind dark theme + custom design tokens ([web/tailwind.config.ts](web/tailwind.config.ts), [web/app/globals.css](web/app/globals.css))
- Env scaffolding rewritten for Supabase ([.env.example](.env.example))

### 1.2 Game logic (shared)
- **196 countries** with capitals, areas (km²), continent, ISO-2, ISO numeric, multilingual aliases — [web/lib/countries.ts](web/lib/countries.ts)
- **Normalization + matcher**: accent strip, alias index, Levenshtein fuzzy for easy mode — [web/lib/normalize.ts](web/lib/normalize.ts)
- **Pure state derivation** from DB rows → `PublicGameState` + `LeaderboardEntry[]` — [web/lib/gameLogic.ts](web/lib/gameLogic.ts)

### 1.3 Backend (Vercel API routes + Supabase)
- **Postgres schema** with RLS, indexes, and race-safety constraints — [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql)
- **Supabase clients** (browser anon + server service-role) — [web/lib/supabase/](web/lib/supabase)
- **Realtime channel layer** — discriminated `RoomEvent` union + `broadcast()` helper — [web/lib/realtime.ts](web/lib/realtime.ts)
- **Stateless API routes** (Node runtime, dynamic) — all parity with old Socket events:
  - `POST /api/games` — create
  - `GET  /api/games/[code]` — snapshot
  - `POST /api/games/[code]/join` — idempotent rejoin
  - `POST /api/games/[code]/leave` — auto-promote / destroy empty
  - `PATCH /api/games/[code]/settings` — host-only
  - `POST /api/games/[code]/start` — host-only
  - `POST /api/games/[code]/guess` — Conquest (UNIQUE) + Mystery (conditional UPDATE)
  - `POST /api/games/[code]/chat` — rate-limited
  - `POST /api/games/[code]/advance` — client-driven timer transition (optimistic concurrency)
  - `POST /api/games/[code]/replay` — host-only reset
  - `GET  /api/countries` — edge runtime, cached
- **Shared helpers**: `parseBody`, `loadGameByCode`, `emitState`, `rateLimit`, zod schemas — [web/app/api/_lib.ts](web/app/api/_lib.ts)

### 1.4 Frontend
- **Home** — name input, mode picker, create/join via HTTP — [web/app/page.tsx](web/app/page.tsx)
- **Lobby** — host-controlled settings, player list, chat — [web/app/lobby/[code]/page.tsx](web/app/lobby/[code]/page.tsx)
- **Game** — map + leaderboard + timer + input + chat, **client-driven `/advance` on timer expiry** — [web/app/game/[code]/page.tsx](web/app/game/[code]/page.tsx)
- **Results** — animated podium + stats + replay — [web/app/results/[code]/page.tsx](web/app/results/[code]/page.tsx)
- **WorldMap**, **Leaderboard**, **Timer**, **AnswerInput**, **Chat** — [web/components/](web/components)
- **`useGameRealtime`** — subscribes to `game:<CODE>` Supabase channel, seeds from `/api/games/[code]` — [web/lib/useGameRealtime.ts](web/lib/useGameRealtime.ts)
- **`api`** — HTTP client, sends persistent `x-user-id` header — [web/lib/api.ts](web/lib/api.ts)
- **`getUserId()`** — localStorage UUID — [web/lib/identity.ts](web/lib/identity.ts)
- **Zustand store** — [web/store/gameStore.ts](web/store/gameStore.ts)

### 1.5 Docs
- README rewritten for Vercel + Supabase ([README.md](README.md))
- Full deploy walkthrough ([DEPLOYMENT_VERCEL.md](DEPLOYMENT_VERCEL.md))

---

## 2. 🔵 In progress

> Nothing currently. Next priority: provision the Supabase project and smoke-test end-to-end before any further feature work.

---

## 3. ⬜ To do — prioritized

### Phase A — Smoke test on Supabase + Vercel
- [ ] Create Supabase project, run `0001_init.sql`
- [ ] `cd web && npm install && npm run dev` against real Supabase
- [ ] 2-tab smoke test: create → join → start → conquer → finish → replay (both modes)
- [ ] Fix any TS / runtime errors found
- [ ] Deploy to Vercel preview, repeat the smoke test
- [ ] (Optional) delete `server/` and remove from workspace if confident

### Phase B — Hardening
- [ ] Move per-(user, key) rate limit from in-process Map to Upstash Redis (`@upstash/ratelimit`) so it survives Lambda cold starts
- [ ] Tighten RLS SELECT policies (require room-scoped header) to prevent enumerating other rooms
- [ ] Add `middleware.ts` to restrict `/api/*` to your origin
- [ ] Add Sentry to `web/` (DSN env var)
- [ ] Add Vercel Web Analytics or PostHog

### Phase C — Reconnect & resilience
- [ ] On `useGameRealtime` mount, also fetch state every 10s as a safety net for missed broadcasts
- [ ] Server-side `last_seen_at` on players + client heartbeat (`POST /api/games/[code]/ping`)
- [ ] Auto-clean players idle > 60s

### Phase D — Auth
- [ ] Wire Supabase Auth (Google, magic link)
- [ ] Replace `x-user-id` header with verified JWT (Supabase issues these natively)
- [ ] Add `profiles` table + RLS, link `players.user_id` to `auth.users.id`
- [ ] Profile page: avatar, ELO, last 20 games

### Phase E — Persistence & stats
- [ ] `match_history` table populated on `game_finished`
- [ ] ELO update per pair: `Δ = K * (actual − expected)`
- [ ] `GET /api/history/[userId]` route
- [ ] Global leaderboard view

### Phase F — UX polish
- [ ] Mobile layout pass (game screen — leaderboard collapses to bottom sheet)
- [ ] Sound effects + mute toggle
- [ ] Continent filter in conquest mode (host setting)
- [ ] Color picker in lobby
- [ ] Avatar (DiceBear preset or upload)
- [ ] i18n (FR/EN)

### Phase G — Tests
- [ ] Vitest: cover `gameLogic` derivations
- [ ] Vitest: cover `normalize` (already partly)
- [ ] API route tests with `supabase-js` against a local Supabase
- [ ] Playwright E2E: 2 browser contexts, full game in both modes
- [ ] CI: GitHub Actions running lint + tests on PR

### Phase H — Bonus features
- [ ] Spectator mode (join with `spectate=true`, excluded from `players`)
- [ ] Replay timeline (already storing `conquests` with `created_at`)
- [ ] Matchmaking queue
- [ ] Achievements
- [ ] Map skins (Tailwind theme tokens)
- [ ] Team mode (`players.team`, color by team)
- [ ] Bots (server cron picking guesses paced by difficulty)
- [ ] Seasons

---

## 4. 🟣 Known limitations / tech debt

- **Country count**: Vatican is matchable but won't render on the map — the 110m world topojson is too coarse for a 0.49 km² polygon. Switch to `countries-50m.json` if Vatican needs to be visually conquerable. Kosovo uses Natural Earth's `-99` sentinel id and renders correctly.
- **Type duplication**: `web/types/shared.ts` mirrors `server/src/types/shared.ts`. With the server deprecated, the web copy is now the source of truth — collapse when ready.
- **Topojson + custom data join**: `world-atlas` topojson uses ISO numeric ids; we match via `numericId`. Western Sahara, Somaliland, Antarctica render unclaimable, which is correct.
- **In-process rate limit**: per-Lambda Map. A burst across many cold-started instances can exceed the intended limit. Mitigated by moving to Upstash Redis (Phase B).
- **No reconnection grace period**: a player who closes the tab is removed by `leave`. Phase C addresses this.
- **Mystery mode** doesn't track per-player accuracy or response time stats.
- **Chat moderation**: only rate-limited, not content-filtered.
- **Legacy `server/`**: still in the repo but no longer wired into deploys. Safe to delete.

---

## 5. Suggested working order

1. **Phase A** (1 session) — provision + smoke test on real Supabase + Vercel
2. **Phase B** (1 session) — Redis rate limit + RLS tightening before launch
3. **Phase C** (1 session) — reconnect grace + idle cleanup
4. **Phase G.1–G.3** (1 session) — engine + route tests before features land
5. **Phase D + E** (2 sessions) — auth + persistence unlocks ELO/history/profiles
6. **Phase F** (1–2 sessions) — UX polish before sharing
7. **Phase H** features as appetite dictates

Tackle one phase per branch, one PR per phase. Update §0 and §2 of this file as you go.
