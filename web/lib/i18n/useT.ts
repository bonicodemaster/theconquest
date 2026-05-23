"use client";
import { useGameStore } from "@/store/gameStore";
import { dict } from "./messages";

/**
 * Access the active language, its message dictionary, and the setter.
 *   const { t, lang, setLang } = useT();
 *   t.home.yourName          // string
 *   t.lobby.waiting(2, 8)    // interpolated string
 */
export function useT() {
  const lang = useGameStore((s) => s.lang);
  const setLang = useGameStore((s) => s.setLang);
  return { lang, setLang, t: dict(lang) };
}
