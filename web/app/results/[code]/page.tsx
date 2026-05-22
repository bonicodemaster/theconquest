"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { useGameRealtime } from "@/lib/useGameRealtime";
import { api } from "@/lib/api";
import { getUserId } from "@/lib/identity";
import type { CountryMeta } from "@/types/shared";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function ResultsPage({ params }: { params: { code: string } }) {
  const { code } = params;
  useGameRealtime(code);
  const router = useRouter();
  const lb = useGameStore((s) => s.leaderboard);
  const state = useGameStore((s) => s.state);
  const [countries, setCountries] = useState<CountryMeta[]>([]);

  useEffect(() => {
    fetch("/api/countries").then((r) => r.json()).then(setCountries).catch(() => {});
  }, []);

  const mode = state?.settings.mode ?? "conquest";
  const myUserId = getUserId();
  const winner = lb[0];
  const iAmWinner = winner?.playerId === myUserId;
  const podium = [lb[1], lb[0], lb[2]]; // 2nd, 1st, 3rd visual order
  const totalConquered = state?.conquered.length ?? 0;
  const maxScore = Math.max(1, ...lb.map((p) => p.score));

  const playAgain = async () => {
    await api.playAgain(code);
    router.push(`/lobby/${code}`);
  };

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-line">
        <span className="text-[12px] text-mute">Fin de partie · Room {code.toUpperCase()}</span>
        <span className="text-[12px] text-mute">
          {mode === "conquest" ? "Conquête" : mode === "capitals" ? "Capitales" : "Pays Mystère"}
        </span>
      </header>

      <div className="grid lg:grid-cols-[1.3fr_1fr]">
        {/* LEFT — verdict + podium */}
        <section className="px-8 md:px-12 py-10 flex flex-col lg:border-r border-line">
          <div className="pav-label">Verdict</div>
          <h1 className="font-serif font-black leading-[0.92] tracking-tight text-5xl md:text-7xl mt-2">
            {winner ? (
              iAmWinner ? (
                <><span className="text-accent">Tu domines</span><br />la carte.</>
              ) : (
                <><span style={{ color: winner.color }}>{winner.username}</span><br />domine la carte.</>
              )
            ) : "Partie terminée."}
          </h1>

          {/* Podium */}
          <div className="grid grid-cols-[1fr_1.3fr_1fr] gap-3 items-end mt-10 flex-1 min-h-[260px]">
            {podium.map((p, i) => {
              if (!p) return <div key={i} />;
              const isWinner = i === 1;
              const h = isWinner ? "100%" : i === 0 ? "78%" : "60%";
              const rank = isWinner ? 1 : i === 0 ? 2 : 3;
              return (
                <div key={p.playerId} className="flex flex-col h-full justify-end">
                  <div className="text-[11px] text-mute mb-2">
                    {rank === 1 ? "Champion" : `${rank}e`}
                  </div>
                  <div className={`font-serif font-black mb-2 ${isWinner ? "text-3xl" : "text-xl"}`}>{p.username}</div>
                  <div
                    className="rounded-2xl shadow-soft relative px-4 pt-4 pb-3 animate-riseIn"
                    style={{ background: p.color, height: h, minHeight: 90 }}
                  >
                    <div className={`font-serif font-black text-white leading-none ${isWinner ? "text-5xl" : "text-3xl"}`}>
                      {p.score}<span className="text-sm ml-1 opacity-70">pts</span>
                    </div>
                    <div className="text-[11px] text-white/75 mt-1.5">
                      {mode === "conquest" ? `${p.countriesCount} pays` : `${p.score} trouvés`}
                    </div>
                    <div className={`absolute bottom-2 right-3 font-serif font-black text-white/40 leading-none ${isWinner ? "text-6xl" : "text-4xl"}`}>
                      {rank}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 mt-8">
            <button className="pav-btn-primary pav-btn-lg" onClick={playAgain}>Rejouer</button>
            <button className="pav-btn-ghost pav-btn-lg" onClick={() => router.push("/")}>Accueil</button>
          </div>
        </section>

        {/* RIGHT — stats + distribution + table */}
        <section className="px-8 md:px-10 py-10 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard k="Champion" v={winner?.username ?? "—"} sub={`${winner?.score ?? 0} points`} />
            <StatCard k="Joueurs" v={String(lb.length)} sub="dans la partie" />
            {mode === "conquest" ? (
              <>
                <StatCard k="Pays conquis" v={String(totalConquered)} sub={`/ ${countries.length || 196}`} />
                <StatCard k="Plus grand empire" v={`${(winner?.worldPercent ?? 0).toFixed(1)}%`} sub="du monde" />
              </>
            ) : (
              <StatCard k="Pays trouvés" v={String(lb.reduce((s, p) => s + p.score, 0))} sub="au total" />
            )}
          </div>

          {mode === "conquest" && (
            <>
              <div>
                <div className="pav-label mb-2">Répartition mondiale</div>
                <div className="pav-card h-44 p-1.5 overflow-hidden">
                  <WorldMap countries={countries} interactive={false} showLabels={false} />
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {lb.map((p) => (
                  <div key={p.playerId} className="flex items-center gap-1.5 text-[11px]">
                    <span className="w-2.5 h-2.5 rounded-[3px] border border-line" style={{ background: p.color }} />
                    <span className="font-semibold">{p.username}</span>
                    <span className="font-mono text-mute">{p.worldPercent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Ranked table */}
          <div className="pav-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="pav-label">
                  <th className="text-left px-3 py-2.5 font-normal">#</th>
                  <th className="text-left px-3 py-2.5 font-normal">Joueur</th>
                  {mode === "conquest" && <th className="text-right px-3 py-2.5 font-normal">Pays</th>}
                  <th className="text-right px-3 py-2.5 font-normal">Score</th>
                </tr>
              </thead>
              <tbody>
                {lb.map((p, i) => (
                  <tr key={p.playerId} className="border-t border-line">
                    <td className="px-3 py-2.5 font-mono text-mute">{String(i + 1).padStart(2, "0")}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-[3px] border border-line" style={{ background: p.color }} />
                        <span className="font-semibold">{p.username}</span>
                      </span>
                    </td>
                    {mode === "conquest" && <td className="px-3 py-2.5 text-right font-mono">{p.countriesCount}</td>}
                    <td className="px-3 py-2.5 text-right font-serif font-extrabold tnum">{p.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="pav-card p-4">
      <div className="pav-label">{k}</div>
      <div className="font-serif text-2xl font-black leading-none mt-1.5 truncate">{v}</div>
      <div className="text-[11px] text-mute mt-1.5">{sub}</div>
    </div>
  );
}
