export type Theme = "light" | "dark";

const STORAGE_KEY = "gp-fight-club-theme";
const THEME_COLORS: Record<Theme, string> = {
  light: "#ffffff",
  dark: "#1c2027",
};

function storedTheme(): Theme | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : null;
  } catch {
    // Storage can be unavailable in hardened/private browser contexts. The theme still works for
    // the current page; it just cannot be remembered for the next load.
    return null;
  }
}

export function getTheme(): Theme {
  // Theme selection remains explicit: existing players keep the mode they chose in-app, while a
  // first visit stays in the familiar light theme regardless of the device setting.
  const stored = storedTheme();
  if (stored) {
    return stored;
  }
  // DOM state is also the in-session fallback when localStorage is unavailable, so the toggle can
  // still move in both directions in hardened/private browser contexts.
  return typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme, persist = true): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  themeColor?.setAttribute("content", THEME_COLORS[theme]);

  if (persist && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // See storedTheme(): persistence is optional, rendering the requested mode is not.
    }
  }
}

export function initTheme(): void {
  applyTheme(getTheme(), false);
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
