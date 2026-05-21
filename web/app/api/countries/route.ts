import { COUNTRIES } from "@/lib/countries";
import { nameFr, continentFr } from "@/lib/countriesFr";

export const runtime = "edge";

export async function GET() {
  return Response.json(
    COUNTRIES.map((c) => ({
      isoCode: c.isoCode,
      numericId: c.numericId,
      name: nameFr(c.isoCode, c.name),
      capital: c.capital,
      continent: continentFr(c.continent),
      areaKm2: c.areaKm2,
    })),
    { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } }
  );
}
