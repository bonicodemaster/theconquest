/**
 * Tracks the timestamp of the most recent "trusted" state we received
 * (from a write response or broadcast). The poll uses this to ignore
 * GET responses that are likely stale due to Supabase read-replica lag.
 *
 * Without this, the sequence is:
 *   1. PATCH /settings → DB primary writes maxPlayers=8
 *   2. broadcast arrives at client → store has maxPlayers=8
 *   3. poll GET /api/games/CODE → read replica still says maxPlayers=12
 *   4. store overwritten with 12 → UI snaps back
 */
let lastFreshAt = 0;

export function markFresh() { lastFreshAt = Date.now(); }
export function getLastFresh() { return lastFreshAt; }
export function isInFreshWindow(ms = 3000) { return Date.now() - lastFreshAt < ms; }
