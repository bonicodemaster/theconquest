"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useGameStore } from "@/store/gameStore";

export default function Chat() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();
  const messages = useGameStore((s) => s.chat);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !code) return;
    setText("");
    await api.sendChat(code, t);
  };

  return (
    <div className="glass rounded-2xl flex flex-col min-h-0 overflow-hidden">
      <div className="px-4 py-2 label border-b border-white/5">Discussion</div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-sm">
        {messages.map((m) => (
          <div key={m.id} className="leading-snug">
            <span className="font-semibold" style={{ color: m.color }}>
              {m.username}:
            </span>{" "}
            <span className="text-white/80">{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="p-2 border-t border-white/5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input"
          maxLength={280}
          placeholder="Écris un message…"
        />
      </form>
    </div>
  );
}
