import { NextResponse } from "next/server";
import { z, type ZodSchema } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { leaderboardFrom, publicState, type ConquestRow, type GameRow, type PlayerRow } from "@/lib/gameLogic";
import { broadcast, type RoomEvent } from "@/lib/realtime";

// Use Node runtime — Edge has issues with some Supabase realtime internals.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

export function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: NO_CACHE_HEADERS });
}

export function ok<T extends object>(data: T = {} as T) {
  return NextResponse.json(data, { headers: NO_CACHE_HEADERS });
}

export function getUserId(req: Request): string | null {
  return req.headers.get("x-user-id");
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, res: bad(parsed.error.issues[0]?.message ?? "Entrée invalide") };
  return { ok: true, data: parsed.data };
}

export async function loadGameByCode(code: string) {
  const admin = supabaseAdmin();
  // Force a fresh read every time — bypass any client / connection-level cache.
  const { data: g } = await admin
    .from("games")
    .select("*")
    .eq("code", code.toUpperCase())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!g) return null;
  const [{ data: ps }, { data: cs }] = await Promise.all([
    admin.from("players").select("*").eq("game_id", g.id).order("joined_at"),
    admin.from("conquests").select("iso_code,user_id,conquered_at").eq("game_id", g.id),
  ]);
  return { game: g as GameRow, players: (ps ?? []) as PlayerRow[], conquests: (cs ?? []) as ConquestRow[] };
}

export async function emitState(code: string, opts: { withLeaderboard?: boolean; extraEvents?: RoomEvent[] } = {}) {
  const ctx = await loadGameByCode(code);
  if (!ctx) return;
  const events: RoomEvent[] = [
    { type: "state", payload: publicState(ctx.game, ctx.players, ctx.conquests) },
  ];
  if (opts.withLeaderboard) {
    events.push({
      type: "leaderboard_updated",
      payload: leaderboardFrom(ctx.players, ctx.conquests, ctx.game.mode),
    });
  }
  if (opts.extraEvents) events.push(...opts.extraEvents);
  await broadcast(supabaseAdmin(), code, events);
}

// --- shared zod schemas ---
export const usernameSchema = z.string().trim().min(2).max(20).regex(/^[\p{L}\p{N}_\-. ]+$/u);
export const codeSchema = z.string().regex(/^[A-Z0-9]{6}$/);
export const settingsSchema = z.object({
  mode: z.enum(["conquest", "mystery"]),
  durationSec: z.number().int().positive().max(60 * 30),
  difficulty: z.enum(["easy", "normal"]),
  maxPlayers: z.number().int().min(2).max(30),
  isPrivate: z.boolean(),
  totalCountries: z.union([z.literal(20), z.literal(50), z.literal(100), z.literal(196)]).optional(),
});

// Token-bucket per (userId, key). In-memory per Vercel instance — best-effort.
const buckets = new Map<string, { tokens: number; ts: number }>();
export function rateLimit(userId: string, key: string, perSec: number): boolean {
  const id = `${userId}:${key}`;
  const now = Date.now();
  const b = buckets.get(id) ?? { tokens: perSec, ts: now };
  const elapsed = (now - b.ts) / 1000;
  b.tokens = Math.min(perSec, b.tokens + elapsed * perSec);
  b.ts = now;
  if (b.tokens < 1) { buckets.set(id, b); return false; }
  b.tokens -= 1;
  buckets.set(id, b);
  return true;
}
