import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostic endpoint — proves whether the server has a working
 * SERVICE_ROLE key by attempting a write that RLS would block for anon.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceKeyLen = process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0;
  const anonLen = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length ?? 0;

  // Quick "can I write?" probe: try to insert a sentinel game, then delete it.
  // If RLS is blocking writes, the insert returns 0 rows with no error.
  let canWrite: "yes" | "no (RLS)" | "no (error)" = "no (error)";
  let probeError: string | null = null;
  try {
    const admin = supabaseAdmin();
    const sentinelCode = `ZZ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const { data, error } = await admin.from("games").insert({
      code: sentinelCode,
      mode: "conquest",
      difficulty: "easy",
      duration_sec: 60,
      max_players: 2,
      is_private: false,
      host_user_id: "00000000-0000-0000-0000-000000000000",
    }).select("id");

    if (error) {
      probeError = error.message;
    } else if (!data || data.length === 0) {
      canWrite = "no (RLS)";
    } else {
      canWrite = "yes";
      await admin.from("games").delete().eq("id", data[0].id);
    }
  } catch (e: any) {
    probeError = e?.message ?? String(e);
  }

  return Response.json({
    supabase_url: url,
    has_service_key: hasService,
    service_key_length: serviceKeyLen,
    anon_key_length: anonLen,
    keys_appear_identical: serviceKeyLen > 0 && serviceKeyLen === anonLen,
    can_write: canWrite,
    probe_error: probeError,
    hint: canWrite === "no (RLS)"
      ? "Your SUPABASE_SERVICE_ROLE_KEY is probably the anon key. Get the real service_role key from Supabase → Settings → API → reveal service_role."
      : null,
  });
}
