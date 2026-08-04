import launchHosted from "./hosted";
import { startHostedInstallPrompt } from "./hosted/install-prompt";
import { isOfflineAccessGranted } from "./hosted/offline-access";
import { registerServiceWorker, registerServiceWorkerNavigationListener } from "./hosted/push";
import { initTheme } from "./hosted/theme";
import launch from "./launcher";
import launchOffline from "./offline";
import { shouldFallBackToOffline } from "./route-decision";
import launchSelfContained from "./self-contained";

initTheme();

console.log(process.env);

// Registration and installability belong to the whole app, not only hosted multiplayer. In
// particular, the offline hot-seat route must finish caching before a player boards a plane.
startHostedInstallPrompt();
registerServiceWorker().catch(() => undefined);
registerServiceWorkerNavigationListener();

// ?game=<uuid> / ?lobby=1 / ?preview=<uuid> / ?create=1 / ?users=1 / ?importOffline=<offlineGameId>
// boot the Supabase-hosted multiplayer mode; every other URL with query params keeps the existing self-contained
// behavior (demo, scenarios, state-share links, e.g.
// ?players=2&seed=..&lostFleet=1) untouched. The bare production URL (no
// query string at all) now defaults to the hosted lobby/login, since that's
// the primary entry point.
const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
const offlineLobbyFallback =
  typeof navigator !== "undefined" && shouldFallBackToOffline(params.toString(), navigator.onLine);

if (offlineLobbyFallback && typeof window !== "undefined") {
  const offlineUrl = new URL(window.location.href);
  offlineUrl.search = "";
  offlineUrl.searchParams.set("offline", "1");
  window.history.replaceState({}, "", offlineUrl.toString());
}

const wantsOffline = params.has("offline") || offlineLobbyFallback;

if (wantsOffline && !isOfflineAccessGranted()) {
  // Offline pass-and-play needs no account or connection, so it can't be checked against
  // `user_approvals` server-side - it's unlocked locally (see grantOfflineAccess()) the first
  // time this device's account clears the hosted approval gate. Until then, route to sign-in /
  // pending-approval instead of the offline lobby, same as every other feature in the app.
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState({}, "", url.toString());
  }
  launchHosted("#app");
} else if (wantsOffline && params.get("game")) {
  launchSelfContained();
} else if (wantsOffline) {
  launchOffline();
} else if (
  params.get("game") ||
  params.has("lobby") ||
  params.has("preview") ||
  params.has("create") ||
  params.has("users") ||
  params.has("importOffline") ||
  params.toString() === ""
) {
  launchHosted("#app");
} else if (process.env.VUE_APP_BGIO) {
  launch("#app");
} else {
  launchSelfContained();
}
