"use client";
import { getUserId } from "./identity";

async function call<T>(
  url: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-user-id": getUserId(),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json?.error ?? `HTTP ${res.status}` };
    return { ok: true, data: json as T };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}

export const api = {
  createGame: (body: { username: string; settings: any }) =>
    call<{ code: string }>("/api/games", { method: "POST", body: JSON.stringify(body) }),

  joinGame: (code: string, body: { username: string }) =>
    call<{ ok: true }>(`/api/games/${code}/join`, { method: "POST", body: JSON.stringify(body) }),

  leaveGame: (code: string) =>
    call<{ ok: true }>(`/api/games/${code}/leave`, { method: "POST" }),

  updateSettings: (code: string, patch: any) =>
    call<{ ok: true }>(`/api/games/${code}/settings`, { method: "PATCH", body: JSON.stringify(patch) }),

  startGame: (code: string) =>
    call<{ ok: true }>(`/api/games/${code}/start`, { method: "POST" }),

  submitGuess: (code: string, guess: string) =>
    call<{ matched: boolean; isoCode?: string }>(`/api/games/${code}/guess`, {
      method: "POST",
      body: JSON.stringify({ guess }),
    }),

  sendChat: (code: string, text: string) =>
    call<{ ok: true }>(`/api/games/${code}/chat`, { method: "POST", body: JSON.stringify({ text }) }),

  advance: (code: string) =>
    call<{ ok: true }>(`/api/games/${code}/advance`, { method: "POST" }),

  playAgain: (code: string) =>
    call<{ ok: true }>(`/api/games/${code}/replay`, { method: "POST" }),

  getState: (code: string) => call<any>(`/api/games/${code}`),
};
