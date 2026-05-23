"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getUserId } from "@/lib/identity";
import { useGameRealtime } from "@/lib/useGameRealtime";
import { useGameStore } from "@/store/gameStore";
import Chat from "@/components/Chat";
import { REGIONS, REGION_COUNT } from "@/lib/regions";
import { regionLabel } from "@/lib/i18n/geo";
import { useT } from "@/lib/i18n/useT";
import type { Difficulty, GameSettings, Region } from "@/types/shared";

export default function LobbyPage({ params }: { params: { code: string } }) {
  const { code } = params;
  const router = useRouter();
  const state = useGameStore((s) => s.state);
  const setState = useGameStore((s) => s.setState);
  const setLb = useGameStore((s) => s.setLeaderboard);
  const { t, lang } = useT();

  useGameRealtime(code);

  const username = useGameStore((s) => s.username);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Optimistic settings: applied locally on click, cleared once the server confirms.
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
        if ((state.settings as any)[k] === (prev as any)[k]) {
          delete (next as any)[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [state]);

  // Auto-route based on server status (covers missed broadcasts).
  useEffect(() => {
    if (!state) return;
    if (state.status === "playing") router.replace(`/game/${code}`);
    else if (state.status === "finished") router.replace(`/results/${code}`);
  }, [state, code, router]);

  if (joinError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="pav-card p-8 max-w-sm text-center">
          <p className="text-accent mb-4 font-medium">{joinError}</p>
          <button className="pav-btn-ghost" onClick={() => router.push("/")}>{t.common.back}</button>
        </div>
      </main>
    );
  }

  if (!state) return <LobbySkeleton />;

  const myUserId = getUserId();
  const me = state.players.find((p) => p.userId === myUserId);
  const isHost = me?.userId === state.hostId;
  const settings: GameSettings = { ...state.settings, ...optimistic };
  const slots = Math.max(settings.maxPlayers, state.players.length);
  // Mode is chosen on the home screen at creation — shown read-only here.
  const modeLabel = settings.mode === "conquest" ? t.mode.conquest : settings.mode === "capitals" ? t.mode.capitals : t.mode.mystery;

  const updateSettings = async (patch: Partial<GameSettings>) => {
    setOptimistic((prev) => ({ ...prev, ...patch }));
    const res = await api.updateSettings(code, patch);
    if (res.ok && res.data.state) {
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
        setState(res.data.state);
        if (res.data.leaderboard) setLb(res.data.leaderboard);
      }
      router.push(`/game/${code}`);
      return;
    }
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
    router.push("/");
    void api.leaveGame(code);
  };

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-line">
        <div className="flex items-baseline gap-4">
          <span className="text-[12px] text-mute">{t.lobby.lobby} · {modeLabel}</span>
          <span className="font-serif text-3xl font-black tracking-[0.12em]">{state.code}</span>
        </div>
        <div className="flex items-center gap-5">
          <span className="text-[12px] text-mute hidden sm:block">
            {t.lobby.waiting(state.players.length, settings.maxPlayers)}
          </span>
          <button className="pav-btn-ghost" onClick={leave}>{t.common.leave}</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-8 grid lg:grid-cols-[1.3fr_1fr] gap-6">
        {/* Settings */}
        <section className="pav-card p-6 md:p-8 space-y-6">
          <h2 className="pav-label">{t.lobby.setup}</h2>

          {settings.mode === "conquest" ? (
            <Field label={t.lobby.gameDuration}>
              <Segmented<number>
                value={settings.durationSec}
                options={[{ v: 60, l: t.lobby.min(1) }, { v: 180, l: t.lobby.min(3) }, { v: 300, l: t.lobby.min(5) }, { v: 600, l: t.lobby.min(10) }]}
                disabled={!isHost}
                onChange={(v) => updateSettings({ durationSec: v })}
              />
            </Field>
          ) : (
            <>
              <Field label={t.lobby.roundDuration}>
                <Segmented<number>
                  value={settings.durationSec}
                  options={[{ v: 10, l: t.lobby.sec(10) }, { v: 20, l: t.lobby.sec(20) }, { v: 30, l: t.lobby.sec(30) }]}
                  disabled={!isHost}
                  onChange={(v) => updateSettings({ durationSec: v })}
                />
              </Field>
              <Field label={t.lobby.region}>
                <Segmented<string>
                  value={settings.region ?? "world"}
                  options={[
                    { v: "world", l: t.lobby.world },
                    ...REGIONS.map((r) => ({ v: r as string, l: regionLabel(r, lang) })),
                  ]}
                  disabled={!isHost}
                  onChange={(v) => updateSettings({ region: v === "world" ? null : (v as Region) })}
                />
              </Field>
              {settings.region ? (
                // Region-locked: the count is fixed to the whole continent.
                <Field label={t.lobby.countryCount}>
                  <div className="border border-line rounded-xl px-3 py-2.5 text-xs font-semibold text-mute bg-panel-soft">
                    {t.lobby.allCountriesIn(REGION_COUNT[settings.region], regionLabel(settings.region, lang))}
                  </div>
                </Field>
              ) : (
                <Field label={t.lobby.countryCount}>
                  <Segmented<number>
                    value={settings.totalCountries ?? 50}
                    options={[{ v: 20, l: "20" }, { v: 50, l: "50" }, { v: 100, l: "100" }, { v: 196, l: t.lobby.all }]}
                    disabled={!isHost}
                    onChange={(v) => updateSettings({ totalCountries: v as 20 | 50 | 100 | 196 })}
                  />
                </Field>
              )}
            </>
          )}

          <Field label={t.lobby.difficulty}>
            <Segmented<Difficulty>
              value={settings.difficulty}
              options={[{ v: "easy", l: t.lobby.difficultyLenient }, { v: "normal", l: t.lobby.difficultyStrict }]}
              disabled={!isHost}
              onChange={(v) => updateSettings({ difficulty: v })}
            />
          </Field>

          <Field label={t.lobby.maxPlayers}>
            <Segmented<number>
              value={settings.maxPlayers}
              options={[2, 4, 8, 12, 20, 30].map((n) => ({ v: n, l: String(n) }))}
              disabled={!isHost}
              onChange={(v) => updateSettings({ maxPlayers: v })}
            />
          </Field>

          <Field label={t.lobby.visibility}>
            <Segmented<boolean>
              value={settings.isPrivate}
              options={[{ v: false, l: t.lobby.public }, { v: true, l: t.lobby.private }]}
              disabled={!isHost}
              onChange={(v) => updateSettings({ isPrivate: v })}
            />
          </Field>

          <div className="pt-2">
            {isHost ? (
              <>
                <button onClick={start} disabled={starting} className="pav-btn-primary pav-btn-lg w-full">
                  {starting ? t.lobby.starting : t.lobby.startGame}
                </button>
                {startError && <p className="text-center text-sm text-accent mt-2">{startError}</p>}
                <div className="text-[11px] text-mute mt-3 text-center">
                  {t.lobby.hostHint}
                </div>
              </>
            ) : (
              <p className="text-center text-sm text-mute">{t.lobby.waitingForHost}</p>
            )}
          </div>
        </section>

        {/* Players + Chat */}
        <div className="flex flex-col gap-6 min-h-[520px]">
          <section className="pav-card p-5">
            <h2 className="pav-label mb-3">{t.lobby.playersPresent(state.players.length, settings.maxPlayers)}</h2>
            <div className="grid grid-cols-1 gap-2">
              {Array.from({ length: slots }).map((_, i) => {
                const p = state.players[i];
                if (!p) {
                  return (
                    <div key={`empty-${i}`} className="border border-dashed border-line rounded-xl min-h-[56px] flex items-center justify-center text-[11px] text-mute/50">
                      {t.lobby.openSlot}
                    </div>
                  );
                }
                return (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-3 bg-panel-soft border border-line rounded-xl">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-serif text-lg font-black text-white shrink-0" style={{ background: p.color }}>
                      {p.username[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate flex items-center gap-2">
                        {p.username}
                        {p.isHost && <span className="text-[9px] bg-ink text-paper px-2 py-0.5 rounded-full">{t.lobby.host}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
      <div className="pav-label mb-2">{label}</div>
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
    <div className="flex flex-wrap border border-line rounded-xl overflow-hidden divide-x divide-line">
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button
            key={String(o.v)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.v)}
            className={`flex-1 px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              active ? "bg-ink text-paper" : "bg-panel text-ink hover:bg-panel-soft"
            }`}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

function LobbySkeleton() {
  const { t } = useT();
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-sm text-mute animate-pulse">{t.lobby.connecting}</div>
    </main>
  );
}
