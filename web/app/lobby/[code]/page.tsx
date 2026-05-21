"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getUserId } from "@/lib/identity";
import { useGameRealtime } from "@/lib/useGameRealtime";
import { markFresh } from "@/lib/stateClock";
import { useGameStore } from "@/store/gameStore";
import Chat from "@/components/Chat";
import type { Difficulty, GameMode, GameSettings } from "@/types/shared";

export default function LobbyPage({ params }: { params: { code: string } }) {
  const { code } = params;
  const router = useRouter();
  const state = useGameStore((s) => s.state);
  const setState = useGameStore((s) => s.setState);
  const setLb = useGameStore((s) => s.setLeaderboard);

  useGameRealtime(code);

  const username = useGameStore((s) => s.username);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Optimistic settings: applied locally on click, cleared once the server
  // confirms (the next state broadcast/poll matches the optimistic value).
  const [optimistic, setOptimistic] = useState<Partial<GameSettings>>({});

  // If the user landed here directly, attempt to join exactly once on mount.
  useEffect(() => {
    if (!username) { router.replace("/"); return; }
    let cancelled = false;
    (async () => {
      const res = await api.joinGame(code, { username });
      if (!cancelled && !res.ok) {
        console.error("[lobby] join failed:", res.error);
        setJoinError(res.error);
      }
    })();
    return () => { cancelled = true; };
  // Intentionally only run once per (code, username) mount — re-joining on
  // every state change was causing extra writes and flicker.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, username]);

  // Clear optimistic settings as soon as the server state catches up to them.
  useEffect(() => {
    if (!state) return;
    setOptimistic((prev) => {
      const keys = Object.keys(prev) as Array<keyof GameSettings>;
      if (keys.length === 0) return prev;
      const next = { ...prev };
      let changed = false;
      for (const k of keys) {
        const serverVal = (state.settings as any)[k];
        const optVal = (prev as any)[k];
        if (serverVal === optVal) {
          console.log(`[lobby] cleanup: server matches optimistic for ${String(k)} =`, serverVal);
          delete (next as any)[k];
          changed = true;
        } else {
          console.log(`[lobby] cleanup: KEEP optimistic ${String(k)} (server=${JSON.stringify(serverVal)}, opt=${JSON.stringify(optVal)})`);
        }
      }
      return changed ? next : prev;
    });
  }, [state]);

  // Auto-route based on server status (covers missed broadcasts)
  useEffect(() => {
    if (!state) return;
    if (state.status === "playing") router.replace(`/game/${code}`);
    else if (state.status === "finished") router.replace(`/results/${code}`);
  }, [state, code, router]);

  if (joinError) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl p-6 max-w-sm text-center">
          <p className="text-red-400 mb-3">{joinError}</p>
          <button className="btn-ghost" onClick={() => router.push("/")}>Retour à l'accueil</button>
        </div>
      </main>
    );
  }

  if (!state) return <LobbySkeleton />;

  const myUserId = getUserId();
  const me = state.players.find((p) => p.userId === myUserId);
  const isHost = me?.userId === state.hostId;
  // Merge server state with any in-flight optimistic edits
  const settings: GameSettings = { ...state.settings, ...optimistic };

  const updateSettings = async (patch: Partial<GameSettings>) => {
    console.log("[lobby] CLICK updateSettings", patch);
    setOptimistic((prev) => {
      const next = { ...prev, ...patch };
      console.log("[lobby] optimistic set →", next);
      return next;
    });
    const res = await api.updateSettings(code, patch);
    console.log("[lobby] PATCH response", res);
    if (res.ok && res.data.state) {
      // Use the authoritative state returned by the write (no replica-lag risk)
      markFresh();
      setState(res.data.state);
      if (res.data.leaderboard) setLb(res.data.leaderboard);
    }
    if (!res.ok) {
      console.error("[lobby] update rejected:", res.error);
      setOptimistic((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(patch)) delete (next as any)[k];
        return next;
      });
      const cur = await api.getState(code);
      if (cur.ok) {
        if (cur.data.state.status === "playing") router.push(`/game/${code}`);
        else if (cur.data.state.status === "finished") router.push(`/results/${code}`);
      }
    }
  };

  const start = async () => {
    if (starting) return;
    setStartError(null);
    setStarting(true);
    const res = await api.startGame(code);
    if (res.ok) {
      if (res.data.state) {
        markFresh();
        setState(res.data.state);
        if (res.data.leaderboard) setLb(res.data.leaderboard);
      }
      router.push(`/game/${code}`);
      return;
    }
    // The game might already be running (e.g. previous start succeeded but
    // the broadcast was missed). Fall back to a fresh state lookup and route
    // based on the real status.
    console.warn("[start] rejected, checking real status:", res.error);
    const cur = await api.getState(code);
    if (cur.ok) {
      const status = cur.data.state.status;
      if (status === "playing") { router.push(`/game/${code}`); return; }
      if (status === "finished") { router.push(`/results/${code}`); return; }
    }
    setStartError(res.error);
    setStarting(false);
  };
  const leave = async () => {
    router.push("/");                            // optimistic — don't wait for the API
    void api.leaveGame(code);
  };

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <div className="label">Salon</div>
          <h1 className="font-display text-3xl font-bold tracking-wider">{state.code}</h1>
        </div>
        <button className="btn-ghost" onClick={leave}>Quitter</button>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Settings */}
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 space-y-4 lg:col-span-2"
        >
          <h2 className="label">Paramètres</h2>

          <Field label="Mode">
            <Segmented<GameMode>
              value={settings.mode}
              options={[
                { v: "conquest", l: "🌎 Conquête" },
                { v: "mystery", l: "🎯 Mystère" },
              ]}
              disabled={!isHost}
              onChange={(mode) =>
                updateSettings(
                  mode === "conquest"
                    ? { mode, durationSec: 300 }
                    : { mode, durationSec: 20, totalCountries: 50 }
                )
              }
            />
          </Field>

          {settings.mode === "conquest" ? (
            <Field label="Durée">
              <Segmented<number>
                value={settings.durationSec}
                options={[
                  { v: 60,  l: "1 min" },
                  { v: 180, l: "3 min" },
                  { v: 300, l: "5 min" },
                  { v: 600, l: "10 min" },
                ]}
                disabled={!isHost}
                onChange={(v) => updateSettings({ durationSec: v })}
              />
            </Field>
          ) : (
            <>
              <Field label="Durée par manche">
                <Segmented<number>
                  value={settings.durationSec}
                  options={[
                    { v: 10, l: "10s" },
                    { v: 20, l: "20s" },
                    { v: 30, l: "30s" },
                  ]}
                  disabled={!isHost}
                  onChange={(v) => updateSettings({ durationSec: v })}
                />
              </Field>
              <Field label="Nombre de pays">
                <Segmented<number>
                  value={settings.totalCountries ?? 50}
                  options={[
                    { v: 20, l: "20" },
                    { v: 50, l: "50" },
                    { v: 100, l: "100" },
                    { v: 196, l: "All" },
                  ]}
                  disabled={!isHost}
                  onChange={(v) => updateSettings({ totalCountries: v as 20 | 50 | 100 | 196 })}
                />
              </Field>
            </>
          )}

          <Field label="Difficulté">
            <Segmented<Difficulty>
              value={settings.difficulty}
              options={[
                { v: "easy", l: "Facile (orthographe approximative + alias)" },
                { v: "normal", l: "Normal (exact)" },
              ]}
              disabled={!isHost}
              onChange={(v) => updateSettings({ difficulty: v })}
            />
          </Field>

          <Field label="Joueurs max">
            <Segmented<number>
              value={settings.maxPlayers}
              options={[2, 4, 8, 12, 20, 30].map((n) => ({ v: n, l: String(n) }))}
              disabled={!isHost}
              onChange={(v) => updateSettings({ maxPlayers: v })}
            />
          </Field>

          <Field label="Visibilité">
            <Segmented<boolean>
              value={settings.isPrivate}
              options={[
                { v: false, l: "Public" },
                { v: true, l: "Privé" },
              ]}
              disabled={!isHost}
              onChange={(v) => updateSettings({ isPrivate: v })}
            />
          </Field>

          <div className="pt-2">
            {isHost ? (
              <>
                <button onClick={start} disabled={starting} className="btn-primary w-full text-base py-3">
                  {starting ? "Démarrage…" : "Démarrer la partie →"}
                </button>
                {startError && (
                  <p className="text-center text-sm text-red-400 mt-2">{startError}</p>
                )}
              </>
            ) : (
              <p className="text-center text-sm text-white/50">
                En attente du démarrage par l'hôte…
              </p>
            )}
          </div>
        </motion.section>

        {/* Players + Chat */}
        <div className="flex flex-col gap-4 min-h-[500px]">
          <section className="glass rounded-2xl p-4">
            <h2 className="label mb-3">Joueurs · {state.players.length}/{settings.maxPlayers}</h2>
            <ul className="space-y-1">
              {state.players.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-2 py-2 rounded-lg bg-white/[0.02]">
                  <span className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                  <span className="flex-1 truncate font-medium">{p.username}</span>
                  {p.isHost && <span className="text-[10px] uppercase font-bold text-amber-400">Hôte</span>}
                </li>
              ))}
            </ul>
          </section>
          <Chat />
        </div>
      </div>
    </main>
  );
}

// ---------- helpers ----------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      {children}
    </div>
  );
}

function Segmented<T>({
  value, options, onChange, disabled,
}: {
  value: T;
  options: { v: T; l: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/5">
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button
            key={String(o.v)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.v)}
            className={`px-3 py-1.5 text-xs rounded-lg transition ${
              active ? "bg-brand-500 text-white shadow-glow" : "text-white/60 hover:text-white"
            } disabled:opacity-50`}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

function LobbySkeleton() {
  return (
    <main className="min-h-screen p-8 flex items-center justify-center">
      <div className="text-white/40 animate-pulse">Connexion au salon…</div>
    </main>
  );
}
