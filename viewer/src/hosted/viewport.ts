// Lobby and create-game are meant to be used one-handed on a phone; pinch-zoom
// there just fights the layout. The actual game board still allows it (maps
// benefit from zooming in). There's a single shared index.html/meta tag for
// the whole SPA (see viewer/public/index.html), so this toggles it in place
// on mount/unmount instead of shipping a per-route HTML file.
const ZOOM_LOCKED = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
const ZOOM_DEFAULT = "width=device-width, initial-scale=1";

export function setViewportZoomLocked(locked: boolean): void {
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute("content", locked ? ZOOM_LOCKED : ZOOM_DEFAULT);
  }
}

// Matches frontend.scss's `@media (min-width: 768px)` / every component's own `(max-width:
// 767px)` mobile breakpoint - kept as a single source of truth so a real desktop/mobile *layout*
// decision (docked-and-default-open side panels vs. floating-toggle overlays) can be made in JS,
// not just CSS. Never returns true outside a browser (SSR/tests without matchMedia) - "assume
// mobile" is the safe default for anything that only differs by adding a desktop-only affordance.
const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

export function isDesktopViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

// Fires `callback` only when the viewport actually crosses the desktop/mobile breakpoint (window
// resize, tablet rotation) - not on every resize event. Returns an unsubscribe function.
export function watchDesktopViewport(callback: (isDesktop: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
  const listener = (event: MediaQueryListEvent) => callback(event.matches);
  mql.addEventListener("change", listener);
  return () => mql.removeEventListener("change", listener);
}
