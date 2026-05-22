/**
 * Difficulty-based scoring.
 *
 * Every conquest is worth points proportional to how hard the country is to
 * recall — a casual player should be rewarded far more for "Tanzanie" than for
 * "France". Five tiers, anchored to the values tuned during design:
 *
 *   1 Évident   →  3 pts   (France, Japon, Russie…)
 *   2 Facile    →  8 pts   (Turquie, Suède, Maroc…)
 *   3 Moyen     → 18 pts   (Pologne, Kazakhstan, Kenya…)   ← default bucket
 *   4 Difficile → 32 pts   (Bolivie, Cameroun, Bulgarie…)
 *   5 Expert    → 50 pts   (Tanzanie, Paraguay, Angola…)
 *
 * Only the easy (1–2) and hard (4–5) tiers are listed explicitly; everything
 * else falls through to tier 3, which keeps coverage of all 196 countries
 * guaranteed and the table easy to tune.
 */
export type DifficultyTier = 1 | 2 | 3 | 4 | 5;

export const POINTS_BY_DIFFICULTY: Record<DifficultyTier, number> = {
  1: 3,
  2: 8,
  3: 18,
  4: 32,
  5: 50,
};

export const DIFFICULTY_LABEL: Record<DifficultyTier, string> = {
  1: "Évident",
  2: "Facile",
  3: "Moyen",
  4: "Difficile",
  5: "Expert",
};

// Tier 1 — instantly recognised by almost everyone.
const TIER_1 = [
  "FR", "DE", "ES", "IT", "PT", "GB", "BE", "CH", "NL",
  "RU", "CN", "JP", "IN", "US", "CA", "MX", "BR", "EG", "AU",
];

// Tier 2 — well known.
const TIER_2 = [
  "GR", "SE", "NO", "IE", "AR", "ZA", "SA", "TR", "IR", "IQ",
  "ID", "TH", "VN", "KR", "IL", "CU", "MA", "DZ",
];

// Tier 4 — hard; a geography buff lands these.
const TIER_4 = [
  "BG", "SY", "GT", "BO", "EC", "SN", "CM", "GH", "MG", "NA",
  "BW", "ML", "NE", "TD", "BF", "MR", "SO", "SS", "ER", "GA",
  "CG", "PG", "FJ", "MV", "BN", "BT", "TL", "GY", "SR", "MW",
  "RW", "UZ", "MD",
];

// Tier 5 — expert / micro-states / easily-forgotten.
const TIER_5 = [
  "UY", "PY", "TZ", "CD", "AO", "AD", "LI", "SM", "MC", "VA",
  "GM", "GW", "GN", "SL", "LR", "TG", "BJ", "GQ", "KM", "CV",
  "ST", "SC", "DJ", "LS", "SZ", "CF", "BI", "KG", "TJ", "TM",
  "KI", "NR", "TV", "TO", "WS", "VU", "SB", "FM", "PW", "MH",
  "AG", "BB", "DM", "GD", "KN", "LC", "VC", "BS",
];

const TIER_BY_ISO: Record<string, DifficultyTier> = {};
for (const iso of TIER_1) TIER_BY_ISO[iso] = 1;
for (const iso of TIER_2) TIER_BY_ISO[iso] = 2;
for (const iso of TIER_4) TIER_BY_ISO[iso] = 4;
for (const iso of TIER_5) TIER_BY_ISO[iso] = 5;

/** Difficulty tier (1–5) for an ISO-3166-1 alpha-2 code. Defaults to 3 (Moyen). */
export function difficultyOf(isoCode: string): DifficultyTier {
  return TIER_BY_ISO[isoCode] ?? 3;
}

/** Base points awarded for conquering / guessing a country. */
export function basePoints(isoCode: string): number {
  return POINTS_BY_DIFFICULTY[difficultyOf(isoCode)];
}

/** Short FR difficulty label, e.g. "Difficile". */
export function difficultyLabel(isoCode: string): string {
  return DIFFICULTY_LABEL[difficultyOf(isoCode)];
}
