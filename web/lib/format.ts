export function formatArea(km2: number): string {
  if (km2 >= 1_000_000) return `${(km2 / 1_000_000).toFixed(2)}M km²`;
  if (km2 >= 1_000) return `${(km2 / 1_000).toFixed(1)}k km²`;
  return `${km2.toFixed(0)} km²`;
}

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function username(seed: string): string {
  const adj = ["Bold", "Wise", "Swift", "Brave", "Silent", "Crimson", "Mystic", "Iron", "Frost", "Lunar"];
  const noun = ["Fox", "Wolf", "Eagle", "Tiger", "Cobra", "Falcon", "Bear", "Lion", "Hawk", "Panda"];
  const h = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  return `${adj[h % adj.length]}${noun[(h >> 3) % noun.length]}${(h % 99).toString().padStart(2, "0")}`;
}
