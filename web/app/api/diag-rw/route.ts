import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Round-trip test: PATCH a game's max_players to a known value, then immediately
 * SELECT it back, then SELECT again 500ms later. Reveals connection pooling
 * issues or read-after-write inconsistency.
 *
 * Usage: GET /api/diag-rw?code=ABCDEF&v=42
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").toUpperCase();
  const v = Number(url.searchParams.get("v") ?? "77");
  if (!code) return Response.json({ error: "missing ?code=" }, { status: 400 });

  const admin = supabaseAdmin();

  // 1. Read current value
  const r1 = await admin.from("games").select("id, max_players, updated_at").eq("code", code).maybeSingle();
  if (r1.error) return Response.json({ step: "initial read", error: r1.error });
  if (!r1.data) return Response.json({ error: "code not found" }, { status: 404 });
  const beforeMaxPlayers = r1.data.max_players;
  const id = r1.data.id;

  // 2. Update
  const r2 = await admin.from("games").update({ max_players: v }).eq("id", id).select("max_players, updated_at");

  // 3. Immediate read-back
  const r3 = await admin.from("games").select("max_players, updated_at").eq("id", id).maybeSingle();

  // 4. Wait 500ms, read again
  await new Promise((r) => setTimeout(r, 500));
  const r4 = await admin.from("games").select("max_players, updated_at").eq("id", id).maybeSingle();

  return Response.json({
    code,
    before: beforeMaxPlayers,
    requested: v,
    update_result: { error: r2.error, returned: r2.data },
    immediate_readback: r3.data,
    delayed_readback: r4.data,
    sticks_immediately: r3.data?.max_players === v,
    sticks_after_delay: r4.data?.max_players === v,
  }, { headers: { "cache-control": "no-store" } });
}
