"use client";
import { useEffect, useState } from "react";
import { formatTime } from "@/lib/format";

/** Displays remaining time. Server `endsAt` is source of truth; client ticks for display. */
export default function Timer({ endsAt }: { endsAt?: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    setNow(Date.now()); // refresh immediately when endsAt changes
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const value = endsAt ? Math.max(0, endsAt - now) : 0;
  const danger = !!endsAt && value < 10_000;

  return (
    <div className={`glass rounded-2xl px-4 py-3 text-center ${danger ? "ring-1 ring-red-500/40" : ""}`}>
      <div className="label">Temps restant</div>
      <div className={`font-display text-3xl font-bold tabular-nums ${danger ? "text-red-400" : ""}`}>
        {formatTime(value)}
      </div>
    </div>
  );
}
