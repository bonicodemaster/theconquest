"use client";
import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { LANGS, type Lang } from "@/lib/i18n/messages";

/**
 * Mounted once in the root layout. The store starts at the default language so
 * SSR and the first client render agree; here we (1) adopt the saved language
 * from localStorage after mount, and (2) keep <html lang> in sync.
 */
export default function LangBoot() {
  const lang = useGameStore((s) => s.lang);
  const setLang = useGameStore((s) => s.setLang);

  useEffect(() => {
    const saved = localStorage.getItem("conquest.lang");
    if (saved && (LANGS as string[]).includes(saved) && saved !== lang) {
      setLang(saved as Lang);
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return null;
}
