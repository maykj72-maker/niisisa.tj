"use client";

import { setSiteLanguage, useSiteLanguage } from "./architecture/site-language";

export default function LanguageToggle() {
  const language = useSiteLanguage();
  return (
    <div className="language-toggle" role="group" aria-label="Забон / Язык">
      <button type="button" aria-pressed={language === "tg"} onClick={() => setSiteLanguage("tg")}>TJ</button>
      <button type="button" aria-pressed={language === "ru"} onClick={() => setSiteLanguage("ru")}>RU</button>
    </div>
  );
}
