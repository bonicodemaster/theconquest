# 🗺️ Project Roadmap — World Conquest Quiz

Living document. Update after every shipped feature.
Last update: 2026-05-23 · Status: **🟢 Live in production on Vercel + Supabase** (auto-deploys from `main`). · FR/EN i18n done on branch `feat/i18n-fr-en` (pending merge).

Legend: ✅ done · 🟡 partial · 🔵 in progress · ⬜ todo · 🟣 nice-to-have

---

## 0. Status at a glance

| Area | Status | Notes |
|---|---|---|
| Monorepo + tooling | ✅ | `web/` (Next.js) is the only deploy target; `server/` is legacy |
| Country data (196 countries) | ✅ | 193 UN + Vatican + Kosovo + Taiwan |
| Postgres schema (Supabase) | ✅ | migrations `0001_init`, `0002_mode_text`, `0003_region` (all applied) |
| API routes (stateless, Vercel-ready) | ✅ | full Socket parity in `web/app/api/games/**` |
| Realtime transport (Supabase Broadcast) | ✅ | `lib/realtime.ts` + `useGameRealtime` hook |
| Client refactor (no Socket.io) | ✅ | all pages + components use `api` + `useGameRealtime` |
| Conquest mode (race-safe claims) | ✅ | Postgres UNIQUE constraint |
| Mystery mode (race-safe winner) | ✅ | conditional UPDATE |
| Real-time chat | ✅ | rate-limited per (user, key) |
| Auth | 🟡 | guest-only (UUID in localStorage, sent as `x-user-id`) |
| Tests | 🟡 | normalize unit tests; no integration tests against API routes yet |
| Deploy | ✅ | **live in production**; Vercel auto-deploys `main`, Supabase provisioned + migrated |
| Visual design (Pavillon / Apple-soft) | ✅ | warm-white, hairline borders, rounded, pill buttons — `tailwind.config.ts` + `globals.css` |
| Game modes | ✅ | Conquête + Pays Mystère + Capitales |
| Difficulty scoring (Conquête) | ✅ | 5 tiers → 3/8/18/32/50 pts, points-ranked leaderboard |
| Region filter (round modes) | ✅ | Monde / Europe / Amériques / Asie & Océanie / Afrique |
| Internationalization (FR/EN) | ✅ | per-client switch, default FR; server/DB untouched — branch `feat/i18n-fr-en`, **pending merge** |
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
  - `GET  /api/countries` — statically generated at build, CDN-cached (language-neutral: English canonical names + difficulty/points; display names resolved client-side by ISO)
- **Shared helpers**: `parseBody`, `loadGameByCode`, `emitState`, `rateLimit`, zod schemas — [web/app/api/_lib.ts](web/app/api/_lib.ts)

### 1.4 Frontend
- **Home** — name input, mode picker, create/join via HTTP — [web/app/page.tsx](web/app/page.tsx)
- **Lobby** — host-controlled settings, player list, chat — [web/app/lobby/[code]/page.tsx](web/app/lobby/[code]/page.tsx)
- **Game** — map + inlined HUD (leaderboard + timer + answer bar) + chat, **client-driven `/advance` on timer expiry** — [web/app/game/[code]/page.tsx](web/app/game/[code]/page.tsx)
- **Results** — animated podium + stats + replay — [web/app/results/[code]/page.tsx](web/app/results/[code]/page.tsx)
- **WorldMap**, **Chat** — [web/components/](web/components) · (Leaderboard / Timer / AnswerInput components removed — HUD is now inlined into the game page)
- **`useGameRealtime`** — subscribes to `game:<CODE>` Supabase channel, seeds from `/api/games/[code]` — [web/lib/useGameRealtime.ts](web/lib/useGameRealtime.ts)
- **`api`** — HTTP client, sends persistent `x-user-id` header — [web/lib/api.ts](web/lib/api.ts)
- **`getUserId()`** — localStorage UUID — [web/lib/identity.ts](web/lib/identity.ts)
- **Zustand store** — [web/store/gameStore.ts](web/store/gameStore.ts)

### 1.5 Docs
- README rewritten for Vercel + Supabase ([README.md](README.md))
- Full deploy walkthrough ([DEPLOYMENT_VERCEL.md](DEPLOYMENT_VERCEL.md))

### 1.6 Production launch + Pavillon redesign (2026-05-21 → 05-22)
- **Live in production** on Vercel + Supabase (smoke-tested, all migrations applied) — Phase A complete.
- **Pavillon → Apple-soft visual system**: warm-white surfaces, hairline borders, rounded cards, pill buttons, sentence-case labels; Fraunces / Inter Tight / JetBrains Mono. Tokens in [web/tailwind.config.ts](web/tailwind.config.ts) + [web/app/globals.css](web/app/globals.css).
- **Difficulty scoring** (Conquête): 5 tiers → 3/8/18/32/50 pts, points-ranked leaderboard — [web/lib/difficulty.ts](web/lib/difficulty.ts).
- **Pays Mystère** + **Capitales** modes share a round engine: no-repeat shuffled deck, per-round timer, flat +1 per correct, 3s answer reveal, 2-wrong-guesses-per-round limit, map auto-zoom + locator pin for tiny countries. Capitales names the country and asks for its capital — [web/lib/capitals.ts](web/lib/capitals.ts).
- **Region filter** (round modes): lobby picker Monde / Europe / Amériques / Asie & Océanie / Afrique; a region locks the deck to every country in it (Asia+Oceania merged) — [web/lib/regions.ts](web/lib/regions.ts), nullable `games.region` column.
- **UX**: rooms default to private; lobby mode selector removed (mode chosen on home, read-only in lobby header); lobby no longer auto-scrolls to bottom; answer bar stays focused across rounds; hover detail overlay removed (spoiler-safe for Capitales).
- **Map**: switched to `countries-50m` topojson (finer borders) + micro-country locator pin.
- DB: `games.mode` enum→text (`0002`), nullable `games.region` (`0003`).

### 1.7 Internationalization — FR/EN (2026-05-23) — *branch `feat/i18n-fr-en`, pending merge*
- **Per-client language switch** (FR/EN) from the home header; default **French** (v1 unchanged). Choice persists in `localStorage`, applies app-wide, and syncs `<html lang>` with no hydration flash — [web/components/LangToggle.tsx](web/components/LangToggle.tsx), [web/components/LangBoot.tsx](web/components/LangBoot.tsx).
- **Server, DB, and broadcasts untouched.** All geographic display text (country / capital / continent / region / difficulty names) is resolved **client-side by `isoCode`** from data that already shipped; the matchers were already bilingual, so gameplay/scoring needed no change — [web/lib/i18n/geo.ts](web/lib/i18n/geo.ts).
- **UI strings** in [web/lib/i18n/messages.ts](web/lib/i18n/messages.ts); the `en` dictionary is typed `typeof fr`, so the compiler rejects any missing translation. Hook: `useT()` — [web/lib/i18n/useT.ts](web/lib/i18n/useT.ts).
- `GET /api/countries` made language-neutral (English canonical names); server error strings translated client-side (`translateServerError`); generated usernames localized.
- Verified: production build clean (types + lint + static gen) + headless-Chrome run (FR default, EN toggle switches whole app, persistence across reload, lobby in both languages).

---

## 2. 🔵 In progress

> **FR/EN i18n** on branch `feat/i18n-fr-en` — awaiting PR review + merge (then auto-deploys from `main`). Otherwise live in production. Suggested next: **Phase B** hardening (Redis rate limit + RLS tightening) before wider sharing, or **Phase F** mobile pass.

---

## 3. ⬜ To do — prioritized

### Phase A — Smoke test on Supabase + Vercel — ✅ DONE (2026-05)
- [x] Create Supabase project, run migrations (`0001`–`0003`)
- [x] Run against real Supabase; iterate on TS / runtime errors
- [x] Live-tested create → join → start → play → finish → replay (all 3 modes)
- [x] Deployed to Vercel (preview, then production from `main`)
- [ ] (Optional) delete legacy `server/` workspace

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
- [ ] Continent filter in **Conquête** (host setting) — already shipped for round modes (see §1.6)
- [ ] Color picker in lobby
- [ ] Avatar (DiceBear preset or upload)
- [x] **i18n (FR/EN)** — ✅ done on branch `feat/i18n-fr-en` (per-client switch, default FR; see §1.7), pending merge

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

- **Tiny countries**: now on `countries-50m` topojson; Vatican (0.49 km²) still won't render as a polygon, but round modes show a locator pin for micro-countries. Kosovo uses Natural Earth's `-99` sentinel id and renders correctly.
- **Type duplication**: `web/types/shared.ts` mirrors `server/src/types/shared.ts`. With the server deprecated, the web copy is now the source of truth — collapse when ready.
- **Topojson + custom data join**: `world-atlas` topojson uses ISO numeric ids; we match via `numericId`. Western Sahara, Somaliland, Antarctica render unclaimable, which is correct.
- **In-process rate limit**: per-Lambda Map. A burst across many cold-started instances can exceed the intended limit. Mitigated by moving to Upstash Redis (Phase B).
- **No reconnection grace period**: a player who closes the tab is removed by `leave`. Phase C addresses this.
- **Mystery mode** doesn't track per-player accuracy or response time stats.
- **Chat moderation**: only rate-limited, not content-filtered.
- **Legacy `server/`**: still in the repo but no longer wired into deploys. Safe to delete.

---

## 5. Suggested working order

1. ~~**Phase A** — provision + smoke test on real Supabase + Vercel~~ ✅ done (live in production)
2. **Phase B** (1 session) — Redis rate limit + RLS tightening before launch
3. **Phase C** (1 session) — reconnect grace + idle cleanup
4. **Phase G.1–G.3** (1 session) — engine + route tests before features land
5. **Phase D + E** (2 sessions) — auth + persistence unlocks ELO/history/profiles
6. **Phase F** (1–2 sessions) — UX polish before sharing
7. **Phase H** features as appetite dictates

Tackle one phase per branch, one PR per phase. Update §0 and §2 of this file as you go.
