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
  const listRef = useRef<HTMLDivElement>(null);

  // Pin the chat to its latest message by scrolling its OWN container — never
  // the page. (scrollIntoView scrolls every ancestor incl. the window, which
  // yanked the whole lobby to the bottom on entry.)
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !code) return;
    setText("");
    await api.sendChat(code, t);
  };

  return (
    <div className="pav-card flex flex-col min-h-0 overflow-hidden">
      <div className="px-4 py-2.5 pav-label border-b border-line">Discussion</div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 text-sm">
        {messages.map((m) => (
          <div key={m.id} className="leading-snug">
            <span className="font-bold" style={{ color: m.color }}>
              {m.username}
            </span>{" "}
            <span className="text-ink/80">{m.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="p-2 border-t border-line">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="pav-input border-0 rounded-none bg-transparent px-2 py-1.5 focus:shadow-none"
          maxLength={280}
          placeholder="Écris un message…"
        />
      </form>
    </div>
  );
}
