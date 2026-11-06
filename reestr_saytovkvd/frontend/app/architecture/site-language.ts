"use client";

import { useSyncExternalStore } from "react";

export type SiteLanguage = "tg" | "ru";

const LANGUAGE_STORAGE_KEY = "niisa_site_language";
const LANGUAGE_EVENT = "niisa-site-language-change";

function getLanguageSnapshot(): SiteLanguage {
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "ru" ? "ru" : "tg";
}

function subscribeToLanguage(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(LANGUAGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(LANGUAGE_EVENT, listener);
  };
}

export function useSiteLanguage(): SiteLanguage {
  return useSyncExternalStore(subscribeToLanguage, getLanguageSnapshot, () => "tg");
}

export function setSiteLanguage(language: SiteLanguage) {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  window.dispatchEvent(new Event(LANGUAGE_EVENT));
}
