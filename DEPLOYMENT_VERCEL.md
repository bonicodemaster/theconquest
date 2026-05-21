# Deploying to Vercel + Supabase

This guide takes you from zero to a live, production-ready World Conquest Quiz running entirely on Vercel (Next.js) and Supabase (Postgres + Realtime). No long-lived servers, no WebSocket infra to manage.

---

## 1. Create a Supabase project

1. Sign in at https://supabase.com and create a new project (Free tier is enough to start).
2. Pick a strong DB password and a region close to your players.
3. Once provisioned, open **SQL Editor → New query**.
4. Paste the full contents of [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) and click **Run**.
5. Verify in **Database → Tables** that `games`, `players`, `conquests`, and `chat_messages` exist.

### Enable Realtime broadcast

Broadcast channels work out of the box — no per-table replication needed. You can skip the "Realtime → Tables" toggle entirely; we don't use Postgres Changes.

### Copy your keys

Open **Project Settings → API** and copy:

| Field | Use as |
|-------|--------|
| `Project URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` (server-only, **never** expose) |

---

## 2. Test locally

```bash
cp .env.example .env.local
# Fill in the three SUPABASE vars
cd web
npm install
npm run dev
```

Open http://localhost:3000, create a game in one tab, open the lobby URL in a second tab/browser, and confirm the player list updates in real time.

### Common local issues

| Symptom | Fix |
|---------|-----|
| `Missing user id` 401s | Browser blocked `localStorage`. Try a non-incognito window. |
| Lobby never updates | Check the browser console for Realtime connection errors. Verify `NEXT_PUBLIC_SUPABASE_URL` is reachable. |
| Guesses always fail | Service-role key missing — API routes can't write. |

---

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:<you>/theconquest.io.git
git push -u origin main
```

---

## 4. Import into Vercel

1. Go to https://vercel.com/new and pick your repo.
2. **Root Directory:** `web`
3. **Framework Preset:** Next.js (auto-detected)
4. **Build & Output Settings:** leave defaults
5. **Environment Variables** — add all three:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Click **Deploy**.

When the build finishes, open the preview URL and play a round.

---

## 5. Production hardening

### Restrict CORS for the API (optional)

By default, Next.js Route Handlers accept requests from any origin. If you want to lock the API to your Vercel domain, add a `middleware.ts` in `web/` that rejects cross-origin requests to `/api/*`.

### Rate limiting at the edge (optional)

The in-process token bucket in `app/api/_lib.ts` is per-instance, so a busy site with many cold-started Lambdas may give a player more headroom than intended. For a stricter limit, swap it for `@upstash/ratelimit` backed by Upstash Redis (free tier available, ~50ms overhead).

### Tighten RLS

The migration ships with read-only RLS for the `anon` role on `games`, `players`, `conquests`, and `chat_messages`. If you don't want players to be able to enumerate other rooms via the REST API, tighten the SELECT policies to require a matching `game_id` cookie/header. (The Realtime channel itself is already scoped per room name.)

### Backups

Supabase Free includes 7 days of daily backups. For paid plans, enable PITR.

---

## 6. Custom domain

1. In Vercel **Settings → Domains**, add your domain (e.g., `theconquest.io`).
2. Update DNS as Vercel instructs.
3. No change to Supabase or env vars is needed — the Supabase URL is independent of your site domain.

---

## 7. Updating the schema

Add new SQL files under `supabase/migrations/` with an incrementing prefix (e.g., `0002_add_avatars.sql`). Run them in the Supabase SQL editor in order. The Supabase CLI (`supabase db push`) can automate this once you wire up a local stack — optional.

---

## 8. Observability

- **Vercel** → Logs tab gives per-route latency and errors.
- **Supabase** → Logs → Postgres / Realtime gives query and channel logs.
- Errors surfaced via `bad("…", status)` in API routes are visible in both places.

---

## 9. Cost expectations (rough)

| Tier | What you get |
|------|--------------|
| Vercel Hobby + Supabase Free | Plenty for development and small games (< ~50 concurrent rooms). |
| Vercel Pro + Supabase Pro | Production traffic, daily backups, larger DB, no cold starts on Pro. |

The serverless model means cost scales with rooms played, not idle uptime.

---

## 10. Tearing down the legacy server

The `server/` directory still contains the original Socket.io implementation. It is **no longer required** to run the app. You can:

- Keep it as a reference (the engine logic mirrors the API routes one-for-one), or
- Delete it (`rm -rf server/`) and update `docker-compose.yml` / `package.json` workspaces accordingly.
