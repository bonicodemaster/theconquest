/**
 * Region filtering for round-based modes (Pays Mystère + Capitales). A "region"
 * is a playable grouping that can span more than one raw continent — Asia and
 * Oceania are merged into one region for smoother gameplay. Picking a region
 * locks the round deck to it and the count becomes every country in it.
 * `null` everywhere means "whole world" (the default).
 */
import { COUNTRIES } from "./countries";
import type { Region } from "@/types/shared";

/** Order shown in the lobby picker (after the "Monde" / whole-world option). */
export const REGIONS: Region[] = ["Europe", "Americas", "AsiaOceania", "Africa"];

export const REGION_LABEL_FR: Record<Region, string> = {
  Europe: "Europe",
  Americas: "Amériques",
  AsiaOceania: "Asie & Océanie",
  Africa: "Afrique",
};

/** Which raw continents (from the country data) each playable region spans. */
const REGION_CONTINENTS: Record<Region, string[]> = {
  Europe: ["Europe"],
  Americas: ["Americas"],
  AsiaOceania: ["Asia", "Oceania"],
  Africa: ["Africa"],
};

/** ISO codes of every country in a region — the deck pool for region-locked rounds. */
export function isosInRegion(region: Region): string[] {
  const continents = REGION_CONTINENTS[region] ?? [];
  return COUNTRIES.filter((c) => continents.includes(c.continent)).map((c) => c.isoCode);
}

/** Country count per region — derived from the data so it never drifts. */
export const REGION_COUNT: Record<Region, number> = REGIONS.reduce((acc, r) => {
  acc[r] = isosInRegion(r).length;
  return acc;
}, {} as Record<Region, number>);
