"use client";

import { useSiteLanguage } from "./architecture/site-language";

/** Returns a picker: tr("Русский текст", "Матни тоҷикӣ"). Language is shared site-wide. */
export function useTr() {
  const language = useSiteLanguage();
  return (ru: string, tg: string) => (language === "ru" ? ru : tg);
}
