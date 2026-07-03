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
