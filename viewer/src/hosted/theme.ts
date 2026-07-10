export type Theme = "light" | "dark";

const STORAGE_KEY = "gp-fight-club-theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  // Deliberately NOT auto-detecting from `prefers-color-scheme`: the dark theme here is a
  // whole-page `filter: invert()` hack (see frontend.scss), not a real color system - it looked
  // broken/unreadable when it silently activated for anyone whose OS/browser defaults to dark
  // mode, which is extremely common. Only ever switch on an explicit in-app toggle.
  return stored === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function initTheme(): void {
  applyTheme(getTheme());
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
