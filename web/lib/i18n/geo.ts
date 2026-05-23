/**
 * Language-aware *display* names for geographic data, all resolved from the
 * data files that already ship in the bundle:
 *   - country names:  EN from countries.ts (`name`), FR from countriesFr.ts
 *   - capital names:  EN from countries.ts (`capital`), FR from capitals.ts
 *   - continents:     EN is the raw value, FR from countriesFr.ts
 *   - regions:        FR from regions.ts, EN below
 *   - difficulty:     FR from difficulty.ts, EN below
 *
 * Everything is keyed by `isoCode`, which every server payload already carries,
 * so display can be rendered per-client in either language with no backend
 * change. Matching (guess → country/capital) is unaffected: the matchers in
 * normalize.ts / capitals.ts already accept both French and English forms.
 */
import { BY_ISO } from "../countries";
import { nameFr, continentFr } from "../countriesFr";
import { capitalFr } from "../capitals";
import { REGION_LABEL_FR } from "../regions";
import { difficultyOf, DIFFICULTY_LABEL, type DifficultyTier } from "../difficulty";
import type { Lang } from "./messages";
import type { Region } from "@/types/shared";

/** Country display name in the given language. */
export function countryName(isoCode: string, lang: Lang): string {
  const en = BY_ISO[isoCode]?.name ?? isoCode;
  return lang === "fr" ? nameFr(isoCode, en) : en;
}

/** Capital display name in the given language (falls back to English capital). */
export function capitalName(isoCode: string, lang: Lang): string {
  if (lang === "fr") return capitalFr(isoCode);
  return BY_ISO[isoCode]?.capital ?? capitalFr(isoCode);
}

/** Continent display name. The raw data value is already the English form. */
export function continentName(continent: string, lang: Lang): string {
  return lang === "fr" ? continentFr(continent) : continent;
}

const REGION_LABEL_EN: Record<Region, string> = {
  Europe: "Europe",
  Americas: "Americas",
  AsiaOceania: "Asia & Oceania",
  Africa: "Africa",
};

/** Playable-region label (e.g. "Asie & Océanie" / "Asia & Oceania"). */
export function regionLabel(region: Region, lang: Lang): string {
  return lang === "fr" ? REGION_LABEL_FR[region] : REGION_LABEL_EN[region];
}

const DIFFICULTY_LABEL_EN: Record<DifficultyTier, string> = {
  1: "Obvious",
  2: "Easy",
  3: "Medium",
  4: "Hard",
  5: "Expert",
};

/** Difficulty-tier label (1–5) in the given language. */
export function difficultyTierLabel(tier: DifficultyTier, lang: Lang): string {
  return lang === "fr" ? DIFFICULTY_LABEL[tier] : DIFFICULTY_LABEL_EN[tier];
}

/** Difficulty label for a country, in the given language. */
export function difficultyLabel(isoCode: string, lang: Lang): string {
  return difficultyTierLabel(difficultyOf(isoCode), lang);
}
