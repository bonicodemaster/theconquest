"use client";
import { LANGS } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/useT";

/**
 * Compact FR / EN segmented switch. A per-client preference — flipping it
 * re-renders the whole app in the chosen language (and persists to
 * localStorage via the store). Reusable across page headers.
 */
export default function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useT();
  return (
    <div
      className={`inline-flex border border-line rounded-full overflow-hidden text-[11px] font-semibold ${className}`}
      role="group"
      aria-label="Language"
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 py-1 uppercase tracking-wider transition-colors ${
            lang === l ? "bg-ink text-paper" : "bg-panel text-mute hover:text-ink"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
