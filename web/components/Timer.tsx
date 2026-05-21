"use client";
import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { formatTime } from "@/lib/format";

/** Displays remaining time with smooth 250ms client tick (server is source of truth). */
export default function Timer({ endsAt }: { endsAt?: number }) {
  const remainingMs = useGameStore((s) => s.remainingMs);
  const [tick, setTick] = useState(remainingMs);

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setTick(Math.max(0, endsAt - Date.now())), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const value = endsAt ? tick : remainingMs;
  const danger = value < 10_000;

  return (
    <div className={`glass rounded-2xl px-4 py-3 text-center ${danger ? "ring-1 ring-red-500/40" : ""}`}>
      <div className="label">Time left</div>
      <div className={`font-display text-3xl font-bold tabular-nums ${danger ? "text-red-400" : ""}`}>
        {formatTime(value)}
      </div>
    </div>
  );
}
