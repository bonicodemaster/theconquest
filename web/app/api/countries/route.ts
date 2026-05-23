import { COUNTRIES } from "@/lib/countries";
import { basePoints, difficultyOf } from "@/lib/difficulty";

// Pure, input-free GET → let Next statically generate it at build time and
// serve from the CDN. (Edge runtime would disable that static generation.)
export const dynamic = "force-static";

// Language-neutral country metadata. `name`/`capital`/`continent` are the
// canonical English values; the client never displays them directly — it
// resolves the display name from `isoCode` in the active language (see
// lib/i18n/geo.ts). This keeps the endpoint static and language-agnostic.
export async function GET() {
  return Response.json(
    COUNTRIES.map((c) => ({
      isoCode: c.isoCode,
      numericId: c.numericId,
      name: c.name,
      capital: c.capital,
      continent: c.continent,
      areaKm2: c.areaKm2,
      difficulty: difficultyOf(c.isoCode),
      points: basePoints(c.isoCode),
    })),
    { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } }
  );
}
