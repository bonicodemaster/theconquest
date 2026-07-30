export const dynamic = "force-dynamic";

/**
 * Public client configuration for native apps (iOS). Serves ONLY values that
 * are already public — the same NEXT_PUBLIC_* pair embedded in the web bundle —
 * so a native client can subscribe to the room's Supabase Realtime broadcast
 * channel without hardcoding deployment-specific values.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return Response.json({ error: "Config indisponible" }, { status: 503 });
  }
  return Response.json({ supabaseUrl, supabaseAnonKey });
}
