"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useGameRealtime } from "@/lib/useGameRealtime";
import { api } from "@/lib/api";
import { getUserId } from "@/lib/identity";
import { useGameStore, type ConquestEvent } from "@/store/gameStore";
import { formatArea } from "@/lib/format";
import { type DifficultyTier } from "@/lib/difficulty";
import { useT } from "@/lib/i18n/useT";
import { MAX_WRONG_GUESSES } from "@/lib/roundRules";
import { countryName, capitalName, difficultyTierLabel } from "@/lib/i18n/geo";
import type { Lang } from "@/lib/i18n/messages";
import type { CountryMeta, LeaderboardEntry, GameMode } from "@/types/shared";

// Map needs window — load client-only.
const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

const TOTAL_WORLD_KM2 = 148_940_000;
const MAX_WRONG_MYSTERY = MAX_WRONG_GUESSES; // shared with the server's early round-end

function fmtTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function GamePage({ params }: { params: { code: string } }) {
  const { code } = params;
  const router = useRouter();
  useGameRealtime(code);
  const { lang, t } = useT();

  const state = useGameStore((s) => s.state);
  const leaderboard = useGameStore((s) => s.leaderboard);
  const lastConquest = useGameStore((s) => s.lastConquest);
  const feed = useGameStore((s) => s.conquestFeed);

  const [countries, setCountries] = useState<CountryMeta[]>([]);
  const [value, setValue] = useState("");
  const [wrongCount, setWrongCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const advancedFor = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/countries").then((r) => r.json()).then(setCountries).catch(() => {});
  }, []);

  // Display ticker for the timer.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, [code]);

  // Anti-spam: reset the per-round wrong-guess count when the mystery round changes.
  useEffect(() => { setWrongCount(0); }, [state?.round?.index, state?.settings.mode]);

  // Keep the answer bar focused across rounds. The input is disabled during the
  // between-round reveal pause (and when out of tries), which drops browser focus
  // — so re-focus it the moment a fresh round re-enables it.
  useEffect(() => {
    const isRound = state ? state.settings.mode !== "conquest" : false;
    const locked = isRound && (!!state?.round?.revealedName || wrongCount >= MAX_WRONG_MYSTERY);
    if (!locked) inputRef.current?.focus();
  }, [state?.round?.index, state?.round?.revealedName, state?.settings.mode, wrongCount]);

  // Auto-route based on server status (covers missed broadcasts).
  useEffect(() => {
    if (!state) return;
    if (state.status === "lobby") router.replace(`/lobby/${code}`);
    else if (state.status === "finished") router.replace(`/results/${code}`);
  }, [state, code, router]);

  // Client-driven timer transition: when the round/game ends, ask the server to advance.
  useEffect(() => {
    if (!state) return;
    const mode = state.settings.mode;
    const endsAt = mode === "conquest" ? state.endsAt : state.round?.endsAt;
    if (!endsAt) return;
    const key = `${mode}:${state.round?.index ?? "g"}:${endsAt}`;
    const delay = endsAt - Date.now();
    const fire = () => {
      if (advancedFor.current !== key) {
        advancedFor.current = key;
        void api.advance(code);
      }
    };
    if (delay <= 0) { fire(); return; }
    const t = setTimeout(fire, delay + 150);
    return () => clearTimeout(t);
  }, [state, code]);

  const byIso = useMemo(() => {
    const m = new Map<string, CountryMeta>();
    for (const c of countries) m.set(c.isoCode, c);
    return m;
  }, [countries]);

  // Shake the input bar without remounting it (a key change would steal focus).
  const triggerShake = () => {
    footerRef.current?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-7px)" },
        { transform: "translateX(7px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 280, easing: "ease-in-out" }
    );
  };

  const submit = async () => {
    const guess = value.trim();
    if (!guess || !state || state.status !== "playing") return;
    const isRound = state.settings.mode !== "conquest"; // mystery or capitals
    if (isRound && state.round?.revealedName) return; // reveal pause
    if (isRound && wrongCount >= MAX_WRONG_MYSTERY) return; // no tries left this round
    setValue("");
    const res = await api.submitGuess(code, guess);
    const wrong = !res.ok || !res.data.matched;
    if (wrong) {
      triggerShake();
      if (isRound) setWrongCount((c) => c + 1);
    }
    inputRef.current?.focus(); // keep focus so the player can retype immediately
  };

  if (!state) {
    return (
      <main className="min-h-screen flex items-center justify-center text-sm text-mute">
        {t.game.loading}
      </main>
    );
  }

  const mode = state.settings.mode;
  const isConquest = mode === "conquest";
  const isCapitals = mode === "capitals";
  const roundBased = !isConquest; // mystery + capitals share the round-based HUD
  const modeLabel = isConquest ? t.mode.conquest : isCapitals ? t.mode.capitals : t.mode.mystery;
  const myUserId = getUserId();
  const ranked = leaderboard;
  const me = ranked.find((p) => p.playerId === myUserId);
  const myRank = ranked.findIndex((p) => p.playerId === myUserId) + 1;
  const topScore = Math.max(1, ...ranked.map((p) => p.score));
  const conqueredCount = state.conquered.length;
  const total = countries.length || 196;

  const endsAt = isConquest ? state.endsAt : state.round?.endsAt;
  const remaining = endsAt ? endsAt - now : 0;
  const danger = remaining > 0 && remaining < 30_000;
  const revealPhase = roundBased && !!state.round?.revealedName;
  const outOfTries = roundBased && wrongCount >= MAX_WRONG_MYSTERY;
  const inputLocked = revealPhase || outOfTries;
  const promptCountry = isCapitals && state.round ? byIso.get(state.round.isoCode) : null;

  const myArea = me?.totalAreaKm2 ?? 0;
  const myPct = ((myArea / TOTAL_WORLD_KM2) * 100).toFixed(1);

  return (
    <div className="h-screen flex flex-col bg-paper text-ink overflow-hidden">
      {/* HEADER */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-line px-6 py-2.5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <a href="/" className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.12em] text-ink no-underline">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            WCQ
          </a>
          <span className="text-[12px] text-mute truncate">
            {t.common.room} {state.code} · {modeLabel}
          </span>
        </div>
        <div className="text-center">
          <div className="pav-label">{isConquest ? t.game.timeLeft : t.game.round}</div>
          {isConquest ? (
            <div className={`font-serif font-black leading-none tnum text-4xl mt-0.5 ${danger ? "text-accent" : "text-ink"}`}>
              {fmtTime(remaining)}
            </div>
          ) : (
            <div className="font-serif font-black leading-none text-3xl mt-0.5">
              {(state.roundsPlayed ?? 0) + 1} <span className="text-mute text-lg">/ {state.totalRounds ?? "—"}</span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-6 items-baseline">
          <div className="text-right">
            <div className="pav-label">{isConquest ? t.game.countries : t.game.timeLeft}</div>
            <div className="font-serif text-lg font-extrabold tnum">
              {isConquest
                ? <>{conqueredCount} <span className="text-mute text-xs">/ {total}</span></>
                : fmtTime(remaining)}
            </div>
          </div>
          <div className="text-right">
            <div className="pav-label">{t.game.yourRank}</div>
            <div className={`font-serif text-lg font-extrabold ${myRank === 1 ? "text-accent" : "text-ink"}`}>
              #{myRank || "—"}
            </div>
          </div>
        </div>
      </header>

      {/* BODY: leaderboard rail + map */}
      <div className="flex-1 grid grid-cols-[260px_1fr] min-h-0">
        {/* LEFT — leaderboard */}
        <aside className="border-r border-line flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 pt-3.5 pb-2">
            <div className="pav-label">{t.game.liveRanking}</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {ranked.map((p, i) => (
              <LeaderRow key={p.playerId} p={p} rank={i + 1} me={p.playerId === myUserId} mode={mode} />
            ))}
          </div>
          {/* Ton score footer */}
          <div className="border-t border-line px-4 py-3 bg-panel">
            <div className="pav-label">{t.game.yourScore}</div>
            <div className="flex items-baseline gap-2.5 mt-1">
              <div className="font-serif text-4xl font-black leading-none text-accent tnum">{me?.score ?? 0}</div>
              <div className="font-mono text-[10px] text-mute">pts</div>
              <div className="ml-auto text-[11px] text-mute">
                {me && me.score >= topScore
                  ? <span className="text-accent font-semibold">{t.game.leading}</span>
                  : t.game.behind(topScore - (me?.score ?? 0))}
              </div>
            </div>
            <div className="text-[11px] text-mute mt-2">
              {isConquest
                ? t.game.conquestStat(me?.countriesCount ?? 0, formatArea(myArea), myPct)
                : isCapitals ? t.game.capitalsFound(me?.score ?? 0) : t.game.countriesFound(me?.score ?? 0)}
            </div>
            <div className="mt-2.5 h-1.5 bg-panel-soft rounded-full overflow-hidden relative">
              <div
                className="absolute inset-y-0 left-0 bg-accent rounded-full transition-[width] duration-500"
                style={{ width: `${Math.min(((me?.score ?? 0) / topScore) * 100, 100)}%` }}
              />
            </div>
          </div>
        </aside>

        {/* CENTER — map */}
        <section className="relative min-h-0">
          <div className="absolute inset-0 p-4">
            <div className="w-full h-full rounded-2xl overflow-hidden border border-line shadow-soft">
              <WorldMap
                countries={countries}
                highlightIso={roundBased ? state.round?.isoCode ?? null : null}
                showLabels
              />
            </div>
          </div>

          {/* Capitales — show the named country to find (answer = its capital) */}
          {isCapitals && promptCountry && !state.round?.revealedName && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-panel border border-line rounded-2xl px-5 py-2.5 shadow-elevated flex items-baseline gap-2.5 pointer-events-none">
              <span className="text-[11px] text-mute">{t.game.capitalOf}</span>
              <span className="font-serif text-xl font-black">{countryName(state.round!.isoCode, lang)}</span>
            </div>
          )}

          {/* Answer reveal (Mystère + Capitales) */}
          {roundBased && state.round?.revealedName && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-ink text-paper px-5 py-2.5 rounded-full shadow-toast animate-slideIn flex items-baseline gap-2">
              <span className="text-[11px] text-paper/60">{t.game.answer}</span>
              <span className="font-serif text-xl font-black">{isCapitals ? capitalName(state.round.isoCode, lang) : countryName(state.round.isoCode, lang)}</span>
            </div>
          )}

          {/* Capture flash (conquest) */}
          {isConquest && lastConquest && (
            <CaptureFlash key={lastConquest.at} ev={lastConquest} lang={lang} />
          )}

          {/* Toast feed bottom-left (conquest) */}
          {isConquest && (
            <div className="absolute bottom-6 left-8 flex flex-col gap-1.5 max-w-[340px] pointer-events-none">
              {feed.slice(0, 4).map((f) => (
                <div
                  key={f.at}
                  className="bg-ink text-paper px-4 py-2.5 flex items-center gap-2.5 rounded-2xl shadow-toast animate-slideIn"
                  style={{ boxShadow: f.isMe ? "0 0 0 2px #d4541c, 0 8px 24px rgba(28,28,30,0.16)" : undefined }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: f.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold">
                      <span style={{ color: f.color }}>{f.username}</span> · {countryName(f.isoCode, lang)}
                    </div>
                    <div className="text-[10px] text-paper/55 mt-0.5">
                      {difficultyTierLabel(f.difficulty as DifficultyTier, lang)}
                    </div>
                  </div>
                  <div className="font-serif text-xl font-black leading-none" style={{ color: f.isMe ? "#d4541c" : "#fff" }}>
                    +{f.points}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* INPUT BAR */}
      <footer
        ref={footerRef}
        className="grid grid-cols-[260px_1fr] border-t border-line bg-panel shrink-0"
      >
        <div className="px-5 flex items-center border-r border-line">
          <div>
            <div className="pav-label">{t.game.score}</div>
            <div className="font-serif text-3xl font-black leading-none text-accent tnum">{me?.score ?? 0}</div>
          </div>
        </div>
        <div className="px-6 py-3.5 flex items-center gap-4 bg-panel relative">
          <div className="font-serif text-4xl font-black text-accent leading-none">{">"}</div>
          <div className="flex-1">
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void submit(); }
                if (e.key === "Escape") setValue("");
              }}
              placeholder={outOfTries ? t.game.phNoTries : revealPhase ? t.game.phRevealed : isCapitals ? t.game.phCapital : mode === "mystery" ? t.game.phMystery : t.game.phConquest}
              autoComplete="off"
              spellCheck={false}
              disabled={inputLocked}
              className="w-full border-0 outline-none bg-transparent font-sans text-3xl md:text-4xl font-extrabold text-ink tracking-tight p-0 placeholder:text-mute/50 disabled:text-mute/50"
            />
            <div className="text-[11px] text-mute mt-1.5">
              {revealPhase
                ? t.game.hintNextRound
                : outOfTries
                ? t.game.hintNoTries
                : roundBased
                ? t.game.hintTries(wrongCount + 1, MAX_WRONG_MYSTERY)
                : t.game.hintConquest}
            </div>
          </div>
          <button
            onClick={submit}
            disabled={!value || inputLocked}
            className="pav-btn-primary disabled:bg-panel-soft disabled:text-mute disabled:shadow-none"
          >
            {revealPhase ? t.game.btnAnswer : t.game.btnLock}
          </button>
        </div>
      </footer>
    </div>
  );
}

function LeaderRow({ p, rank, me, mode }: { p: LeaderboardEntry; rank: number; me: boolean; mode: GameMode }) {
  const { t } = useT();
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 border-t border-line relative ${me ? "bg-panel" : ""}`}
    >
      {me && <span className="absolute left-0 inset-y-0 w-[3px] bg-accent" />}
      <div className="font-mono text-[11px] text-mute w-[18px] shrink-0">{String(rank).padStart(2, "0")}</div>
      <div className="w-5 h-5 rounded-md border border-line shrink-0" style={{ background: p.color }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold tracking-wide truncate">{p.username}</div>
        {mode === "conquest" && (
          <div className="font-mono text-[10px] text-mute truncate">
            {p.countriesCount} {t.game.countriesShort} · {formatArea(p.totalAreaKm2)}
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="font-serif text-xl font-extrabold tnum leading-none">{p.score}</div>
        <div className="font-mono text-[8px] text-mute mt-0.5">pts</div>
      </div>
    </div>
  );
}

function CaptureFlash({ ev, lang }: { ev: ConquestEvent; lang: Lang }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 950);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="absolute top-5 right-5 pointer-events-none">
      <div
        className="px-5 py-3 inline-flex items-baseline gap-3.5 text-white animate-slideIn shadow-toast"
        style={{ background: ev.color }}
      >
        <span className="font-serif text-2xl font-black">{countryName(ev.isoCode, lang)} ✓</span>
        <span className="font-serif text-2xl font-black">+{ev.points}</span>
        <span className="font-mono text-[11px] tracking-wider opacity-80">PTS</span>
      </div>
    </div>
  );
}
