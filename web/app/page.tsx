"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useGameStore } from "@/store/gameStore";
import { username as suggestUsername } from "@/lib/format";
import type { GameMode, GameSettings } from "@/types/shared";

export default function Home() {
  const router = useRouter();
  const storeName = useGameStore((s) => s.username);
  const setStoreName = useGameStore((s) => s.setUsername);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<GameMode>("conquest");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(storeName || suggestUsername(crypto.randomUUID()));
  }, [storeName]);

  const createGame = async () => {
    setError(null);
    setBusy(true);
    const settings: GameSettings =
      mode === "conquest"
        ? { mode, durationSec: 300, difficulty: "easy", maxPlayers: 12, isPrivate: false }
        : { mode, durationSec: 20, difficulty: "easy", maxPlayers: 12, isPrivate: false, totalCountries: 50 };
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
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-block px-3 py-1 text-[11px] font-bold uppercase tracking-widest rounded-full bg-brand-500/20 text-brand-400 mb-4">
            multijoueur en temps réel · géographie
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
            World{" "}
            <span className="bg-gradient-to-r from-brand-400 via-fuchsia-400 to-amber-400 bg-clip-text text-transparent">
              Conquest
            </span>{" "}
            Quiz
          </h1>
          <p className="mt-4 text-white/60 max-w-md">
            Tape les noms de pays plus vite que tes adversaires. Conquiers la carte,
            gravis le classement, domine le monde.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass rounded-3xl p-6 space-y-5"
        >
          <div>
            <label className="label">Votre nom</label>
            <input
              className="input mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
            />
          </div>

          <div>
            <label className="label">Mode</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(["conquest", "mystery"] as GameMode[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMode(m)}
                  className={`btn ${mode === m ? "btn-primary" : "btn-ghost"}`}
                >
                  {m === "conquest" ? "🌎 Conquête" : "🎯 Mystère"}
                </button>
              ))}
            </div>
          </div>

          <button onClick={createGame} disabled={busy || !name} className="btn-primary w-full text-base py-3">
            Créer une partie
          </button>

          <div className="flex items-center gap-3 text-xs text-white/40">
            <span className="flex-1 h-px bg-white/10" />
            ou rejoindre une partie
            <span className="flex-1 h-px bg-white/10" />
          </div>

          <div className="flex gap-2">
            <input
              className="input font-mono uppercase tracking-widest"
              placeholder="CODE DU SALON"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <button onClick={joinGame} disabled={busy || !code || !name} className="btn-ghost">
              Rejoindre
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </motion.div>
      </div>
    </main>
  );
}
