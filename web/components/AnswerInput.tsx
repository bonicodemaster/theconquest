"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";

export default function AnswerInput() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();
  const [value, setValue] = useState("");
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-focus the input whenever the room code resolves (after route hydration)
  useEffect(() => {
    if (code) inputRef.current?.focus();
  }, [code]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const guess = value.trim();
    if (!guess || !code || busy) return;
    setBusy(true);
    setValue("");
    try {
      const res = await api.submitGuess(code, guess);
      setFlash(res.ok && res.data.matched ? "ok" : "bad");
    } catch {
      setFlash("bad");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
      window.setTimeout(() => setFlash(null), 250);
    }
  };

  return (
    <form onSubmit={submit} className="relative shrink-0">
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
        ref={inputRef}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="Type a country and press Enter…"
        className="input text-lg font-medium w-full"
      />
      {/* Hidden submit button guarantees Enter triggers submit even in edge cases */}
      <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
    </form>
  );
}
