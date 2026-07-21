export type Theme = "light" | "dark";

const STORAGE_KEY = "gp-fight-club-theme";
const DEFAULT_THEME: Theme = "dark";
const THEME_COLORS: Record<Theme, string> = {
  light: "#ffffff",
  dark: "#1c2027",
};

function storedTheme(): Theme | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    // Storage can be unavailable in hardened/private browser contexts. The theme still works for
    // the current page; it just cannot be remembered for the next load.
    return null;
  }
}

export function getTheme(): Theme {
  // Existing players keep their explicit choice; everyone else starts in the purpose-designed
  // dark theme regardless of the device setting.
  const stored = storedTheme();
  if (stored) {
    return stored;
  }
  // DOM state is also the in-session fallback when localStorage is unavailable, so the toggle can
  // still move in both directions in hardened/private browser contexts.
  if (typeof document !== "undefined") {
    const liveTheme = document.documentElement.getAttribute("data-theme");
    if (liveTheme === "light" || liveTheme === "dark") {
      return liveTheme;
    }
  }
  return DEFAULT_THEME;
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
