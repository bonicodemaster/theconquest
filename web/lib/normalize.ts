import { COUNTRIES, type Country } from "./countries";

/** Strip accents, lowercase, collapse whitespace/punctuation. */
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[`'’.\-_,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Precomputed index name -> ISO code
const INDEX = new Map<string, string>();
for (const c of COUNTRIES) {
  const keys = [c.name, c.officialName, c.isoCode, c.numericId, ...c.aliases];
  for (const k of keys) {
    INDEX.set(normalize(k), c.isoCode);
  }
}

/** Levenshtein distance — O(n*m) but country names are short. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

/**
 * Match user input to a country.
 *  - "easy"   : exact match OR Levenshtein ≤ 2 (≤1 for short names)
 *  - "normal" : exact (normalized) match only
 */
export function matchCountry(
  guess: string,
  difficulty: "easy" | "normal"
): Country | null {
  const q = normalize(guess);
  if (!q) return null;

  const direct = INDEX.get(q);
  if (direct) return COUNTRIES.find((c) => c.isoCode === direct) ?? null;

  if (difficulty === "normal") return null;

  // Easy: fuzzy
  let best: { iso: string; d: number; refLen: number } | null = null;
  for (const [k, iso] of INDEX) {
    const d = levenshtein(q, k);
    const maxAllowed = k.length <= 5 ? 1 : 2;
    if (d <= maxAllowed && (!best || d < best.d)) {
      best = { iso, d, refLen: k.length };
    }
  }
  return best ? COUNTRIES.find((c) => c.isoCode === best!.iso) ?? null : null;
}
