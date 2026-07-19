/**
 * Whether a page load with no explicit params should silently redirect into offline mode.
 * `navigator.onLine` is well known to be unreliable (can get stuck reporting `false` on a real
 * connection), so this must only apply to a truly ambient load (no params at all) - never to an
 * explicit navigation like `?lobby=1` (the PWA manifest's own `start_url`, and the in-app "Online
 * lobby" link), or a stuck `navigator.onLine` traps the user in the offline lobby with no way out.
 */
export function shouldFallBackToOffline(search: string, isOnline: boolean | undefined): boolean {
  return isOnline === false && new URLSearchParams(search).toString() === "";
}
