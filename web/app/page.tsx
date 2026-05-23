"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useGameStore } from "@/store/gameStore";
import { username as suggestUsername } from "@/lib/format";
import { useT } from "@/lib/i18n/useT";
import LangToggle from "@/components/LangToggle";
import type { GameMode, GameSettings } from "@/types/shared";

export default function Home() {
  const router = useRouter();
  const { t, lang } = useT();
  const storeName = useGameStore((s) => s.username);
  const setStoreName = useGameStore((s) => s.setUsername);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<GameMode>("conquest");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(storeName || suggestUsername(crypto.randomUUID(), lang));
  }, [storeName, lang]);

  const createGame = async () => {
    setError(null);
    setBusy(true);
    // Default to a PRIVATE room so nobody can wander in while the host is still
    // configuring; the host can flip it to public from the lobby.
    const settings: GameSettings =
      mode === "conquest"
        ? { mode, durationSec: 300, difficulty: "easy", maxPlayers: 12, isPrivate: true }
        : { mode, durationSec: 20, difficulty: "easy", maxPlayers: 12, isPrivate: true, totalCountries: 50 };
    setStoreName(name);
    const res = await api.createGame({ username: name, settings });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.push(`/lobby/${res.data.code}`);
  };

  const joinGame = async () => {
    setError(null);
    setBusy(true);
    setStoreName(name);
    const upper = code.trim().toUpperCase();
    const res = await api.joinGame(upper, { username: name });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.push(`/lobby/${upper}`);
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-line">
        <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.18em]">
          <span className="w-2.5 h-2.5 rounded-full bg-accent" />
          World · Conquest · Quiz
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[12px] text-mute hidden sm:block">{t.common.tagline}</span>
          <LangToggle />
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[1.2fr_1fr]">
        {/* LEFT — hero */}
        <section className="px-8 md:px-14 py-12 md:py-16 flex flex-col gap-8 lg:border-r border-line">
          <div className="pav-label">{t.home.heroLabel}</div>
          <h1 className="font-serif font-black leading-[0.9] tracking-tight text-6xl md:text-8xl">
            {t.home.heroLine1}<br />{t.home.heroLine2}<br /><span className="text-accent">{t.home.heroLine3}</span>
          </h1>
          <p className="max-w-md text-base md:text-lg leading-relaxed text-ink/80">
            {t.home.heroBody}
          </p>

          <div className="mt-auto flex gap-12 text-[11px] text-mute">
            <div><div className="font-serif text-3xl text-ink font-bold">196</div>{t.home.statCountries}</div>
            <div><div className="font-serif text-3xl text-ink font-bold">3–50</div>{t.home.statPtsPerCountry}</div>
            <div><div className="font-serif text-3xl text-ink font-bold">2–30</div>{t.home.statPlayers}</div>
          </div>
        </section>

        {/* RIGHT — console */}
        <section className="px-8 md:px-12 py-12 md:py-16 flex flex-col gap-7 justify-center">
          <div>
            <div className="pav-label mb-2">{t.home.yourName}</div>
            <input
              className="pav-input text-lg font-semibold"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
            />
          </div>

          <div>
            <div className="pav-label mb-2">{t.home.gameMode}</div>
            <div className="grid grid-cols-3 border border-line rounded-xl overflow-hidden">
              {(["conquest", "mystery", "capitals"] as GameMode[]).map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-2 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                    i < 2 ? "border-r border-line" : ""
                  } ${mode === m ? "bg-ink text-paper" : "bg-panel text-ink hover:bg-panel-soft"}`}
                >
                  {m === "conquest" ? t.mode.conquestShort : m === "mystery" ? t.mode.mysteryShort : t.mode.capitalsShort}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={createGame}
            disabled={busy || !name}
            className="pav-btn-primary pav-btn-lg w-full"
          >
            {busy ? t.home.creating : t.home.createGame}
          </button>

          <div className="flex items-center gap-4 text-[11px] text-mute">
            <span className="flex-1 pav-rule" />
            {t.home.orJoin}
            <span className="flex-1 pav-rule" />
          </div>

          <div className="flex gap-2">
            <input
              className="pav-input font-mono uppercase tracking-[0.3em] text-lg font-bold text-center"
              placeholder={t.home.codePlaceholder}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <button onClick={joinGame} disabled={busy || !code || !name} className="pav-btn-ghost px-6">
              {busy ? "…" : t.home.join}
            </button>
          </div>

          {error && <p className="text-sm text-accent font-medium">{error}</p>}
        </section>
      </div>
    </main>
  );
}
