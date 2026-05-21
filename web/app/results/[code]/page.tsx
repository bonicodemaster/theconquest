"use client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { useGameRealtime } from "@/lib/useGameRealtime";
import { api } from "@/lib/api";
import { formatArea } from "@/lib/format";

export default function ResultsPage({ params }: { params: { code: string } }) {
  const { code } = params;
  useGameRealtime(code);
  const router = useRouter();
  const lb = useGameStore((s) => s.leaderboard);
  const state = useGameStore((s) => s.state);

  const top3 = lb.slice(0, 3);
  const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd → visual

  const playAgain = async () => {
    await api.playAgain(code);
    router.push(`/lobby/${code}`);
  };

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <h1 className="font-display text-4xl md:text-5xl font-extrabold text-center mt-6 mb-10">
        Game over
      </h1>

      <div className="flex items-end justify-center gap-3 md:gap-6 mb-10">
        {podiumOrder.map((idx) => {
          const p = top3[idx];
          if (!p) return <div key={idx} className="w-32" />;
          const heights = ["h-44", "h-56", "h-36"]; // 2nd, 1st, 3rd
          const medals = ["🥈", "🥇", "🥉"];
          const rankIdx = idx === 0 ? 1 : idx === 1 ? 0 : 2;
          return (
            <motion.div
              key={p.playerId}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: rankIdx * 0.15, type: "spring" }}
              className="flex flex-col items-center w-28 md:w-36"
            >
              <div className="text-3xl mb-2">{medals[rankIdx]}</div>
              <div className="font-semibold text-center truncate w-full">{p.username}</div>
              <div className="text-xs text-white/50">
                {state?.settings.mode === "conquest"
                  ? `${p.worldPercent.toFixed(2)}% • ${p.countriesCount} countries`
                  : `${p.score} pts`}
              </div>
              <div
                className={`${heights[rankIdx]} w-full mt-3 rounded-t-xl shadow-glow`}
                style={{ background: p.color }}
              />
            </motion.div>
          );
        })}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-white/40 text-xs uppercase">
            <tr>
              <th className="text-left p-3">#</th>
              <th className="text-left p-3">Player</th>
              <th className="text-right p-3">Countries</th>
              <th className="text-right p-3">Area</th>
              <th className="text-right p-3">World %</th>
              <th className="text-right p-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {lb.map((p, i) => (
              <tr key={p.playerId} className="border-t border-white/5">
                <td className="p-3 text-white/40 font-mono">{i + 1}</td>
                <td className="p-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                  {p.username}
                </td>
                <td className="p-3 text-right">{p.countriesCount}</td>
                <td className="p-3 text-right">{formatArea(p.totalAreaKm2)}</td>
                <td className="p-3 text-right">{p.worldPercent.toFixed(2)}%</td>
                <td className="p-3 text-right font-semibold">{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 justify-center mt-8">
        <button className="btn-primary" onClick={playAgain}>Play again</button>
        <button className="btn-ghost" onClick={() => router.push("/")}>Home</button>
      </div>
    </main>
  );
}
