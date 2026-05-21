"use client";
import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";

export default function AnswerInput() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();
  const [value, setValue] = useState("");
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const guess = value.trim();
    if (!guess || !code || busy) return;
    setBusy(true);
    const res = await api.submitGuess(code, guess);
    setBusy(false);
    if (res.ok && res.data.matched) {
      setValue("");
      setFlash("ok");
    } else {
      setFlash("bad");
    }
    window.setTimeout(() => setFlash(null), 250);
  };

  return (
    <form onSubmit={submit} className="relative">
      <AnimatePresence>
        {flash && (
          <motion.span
            key={flash}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 rounded-xl pointer-events-none ${
              flash === "ok" ? "ring-2 ring-emerald-400" : "ring-2 ring-red-400"
            }`}
          />
        )}
      </AnimatePresence>
      <input
        ref={ref}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type a country and press Enter…"
        className="input text-lg font-medium"
      />
    </form>
  );
}
