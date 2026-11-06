"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "institute-theme";

function getThemeSnapshot() {
  if (typeof window === "undefined") return false;
  return document.documentElement.dataset.theme === "dark" || window.localStorage.getItem(THEME_KEY) === "dark";
}

function subscribeToTheme(listener: () => void) {
  window.addEventListener("institute-theme-change", listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener("institute-theme-change", listener);
    window.removeEventListener("storage", listener);
  };
}

function applyTheme(isDark: boolean) {
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  window.dispatchEvent(new Event("institute-theme-change"));
}

export default function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => false);

  useEffect(() => {
    applyTheme(window.localStorage.getItem(THEME_KEY) === "dark");
  }, []);

  const toggleTheme = () => {
    const nextIsDark = !isDark;
    window.localStorage.setItem(THEME_KEY, nextIsDark ? "dark" : "light");
    applyTheme(nextIsDark);
  };

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      aria-pressed={isDark}
      onClick={toggleTheme}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </span>
      <span className="theme-toggle__label">{isDark ? "Светлая" : "Тёмная"}</span>
    </button>
  );
}
