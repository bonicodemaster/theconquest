import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

/**
 * Server-side Supabase client using the **service role** key.
 *  - bypasses RLS (game-engine logic is the authority)
 *  - only ever called from API routes / server actions
 *  - every PostgREST request is `cache: "no-store"`: Next patches global
 *    `fetch` and will otherwise serve supabase-js **reads from its fetch
 *    cache** (reproduced: GET a room, join a player, re-read → the new player
 *    never appears, response time drops to ~5ms because Supabase is never
 *    contacted). `export const dynamic = "force-dynamic"` on the routes does
 *    NOT reliably opt route-handler fetches out. This — not replica lag — is
 *    the likely root cause of the historical "stale read" bugs.
 */
export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!service) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  _admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return _admin;
}
