"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { formatArea } from "@/lib/format";

export default function Leaderboard({ mode }: { mode: "conquest" | "mystery" }) {
  const lb = useGameStore((s) => s.leaderboard);

  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-2 min-h-0">
      <div className="flex items-center justify-between">
        <h3 className="label">Classement</h3>
        <span className="text-xs text-white/40">{lb.length} joueurs</span>
      </div>

      <ul className="flex flex-col gap-1 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {lb.map((p, i) => (
            <motion.li
              layout
              key={p.playerId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-2 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05]"
            >
              <span className="w-5 text-center text-xs font-mono text-white/40">{i + 1}</span>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="flex-1 truncate font-medium">{p.username}</span>
              {mode === "conquest" ? (
                <div className="text-right">
                  <div className="text-sm font-semibold">{p.worldPercent.toFixed(2)}%</div>
                  <div className="text-[10px] text-white/40">
                    {p.countriesCount} · {formatArea(p.totalAreaKm2)}
                  </div>
                </div>
              ) : (
                <div className="text-right">
                  <div className="text-sm font-semibold">{p.score}</div>
                  <div className="text-[10px] text-white/40">points</div>
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
