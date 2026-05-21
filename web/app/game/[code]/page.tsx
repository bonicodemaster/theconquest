"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Leaderboard from "@/components/Leaderboard";
import Timer from "@/components/Timer";
import AnswerInput from "@/components/AnswerInput";
import Chat from "@/components/Chat";
import { useGameRealtime } from "@/lib/useGameRealtime";
import { api } from "@/lib/api";
import { useGameStore } from "@/store/gameStore";

// Map needs window — load client-only
const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

interface CountryMeta {
  isoCode: string;
  numericId: string;
  name: string;
  capital: string;
  continent: string;
  areaKm2: number;
}

export default function GamePage({ params }: { params: { code: string } }) {
  const { code } = params;
  const router = useRouter();
  useGameRealtime(code);

  const state = useGameStore((s) => s.state);
  const [countries, setCountries] = useState<CountryMeta[]>([]);
  const advancedFor = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/countries").then((r) => r.json()).then(setCountries).catch(() => {});
  }, []);

  // Auto-route based on server status (covers missed broadcasts)
  useEffect(() => {
    if (!state) return;
    if (state.status === "lobby") router.replace(`/lobby/${code}`);
    else if (state.status === "finished") router.replace(`/results/${code}`);
  }, [state, code, router]);

  // Client-driven timer transition: when the current round/game ends, ask the server to advance.
  useEffect(() => {
    if (!state) return;
    const mode = state.settings.mode;
    const endsAt = mode === "conquest" ? state.endsAt : state.round?.endsAt;
    if (!endsAt) return;
    const key = `${mode}:${state.round?.index ?? "g"}:${endsAt}`;
    const delay = endsAt - Date.now();
    if (delay <= 0) {
      if (advancedFor.current !== key) {
        advancedFor.current = key;
        void api.advance(code);
      }
      return;
    }
    const t = setTimeout(() => {
      if (advancedFor.current !== key) {
        advancedFor.current = key;
        void api.advance(code);
      }
    }, delay + 150);
    return () => clearTimeout(t);
  }, [state, code]);

  if (!state) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white/40">
        Chargement de la partie…
      </main>
    );
  }

  const mode = state.settings.mode;

  return (
    <main className="h-screen overflow-hidden flex flex-col p-3 md:p-4 gap-3">
      <header className="flex items-center justify-between gap-3 shrink-0">
        <div>
          <div className="label">Salon</div>
          <div className="font-display text-xl font-bold tracking-wider">{state.code}</div>
        </div>
        <Timer endsAt={mode === "conquest" ? state.endsAt : state.round?.endsAt} />
        <div className="text-right text-xs text-white/40 hidden md:block">
          {mode === "conquest"
            ? `${state.conquered.length} / ${countries.length || 196} pays conquis`
            : `Manche ${(state.roundsPlayed ?? 0) + 1} / ${state.totalRounds ?? "—"}`}
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-3 flex-1 min-h-0">
        {/* Map + input */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="flex-1 min-h-0">
            <WorldMap
              countries={countries}
              highlightIso={mode === "mystery" ? state.round?.isoCode ?? null : null}
            />
          </div>

          {mode === "mystery" && state.round?.revealedName && (
            <AnimatePresence>
              <motion.div
                key={state.round.index + "_reveal"}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="glass rounded-2xl p-3 text-center"
              >
                <span className="text-white/60 text-xs uppercase tracking-wider">Réponse :</span>{" "}
                <span className="font-display text-xl font-bold">{state.round.revealedName}</span>
              </motion.div>
            </AnimatePresence>
          )}

          <AnswerInput />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3 min-h-0">
          <Leaderboard mode={mode} />
          <div className="flex-1 min-h-[180px]">
            <Chat />
          </div>
        </div>
      </div>
    </main>
  );
}
