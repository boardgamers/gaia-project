import launchHosted from "./hosted";
import { startHostedInstallPrompt } from "./hosted/install-prompt";
import { registerServiceWorker, registerServiceWorkerNavigationListener } from "./hosted/push";
import launch from "./launcher";
import launchOffline from "./offline";
import launchSelfContained from "./self-contained";

console.log(process.env);

// Registration and installability belong to the whole app, not only hosted multiplayer. In
// particular, the offline hot-seat route must finish caching before a player boards a plane.
startHostedInstallPrompt();
registerServiceWorker().catch(() => undefined);
registerServiceWorkerNavigationListener();

// ?game=<uuid> / ?lobby=1 / ?preview=<uuid> / ?create=1 / ?users=1 boot the Supabase-hosted multiplayer
// mode; every other URL with query params keeps the existing self-contained
// behavior (demo, scenarios, state-share links, e.g.
// ?players=2&seed=..&lostFleet=1) untouched. The bare production URL (no
// query string at all) now defaults to the hosted lobby/login, since that's
// the primary entry point.
const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
const offlineLobbyFallback =
  typeof navigator !== "undefined" && navigator.onLine === false && (params.toString() === "" || params.has("lobby"));

if (offlineLobbyFallback && typeof window !== "undefined") {
  const offlineUrl = new URL(window.location.href);
  offlineUrl.search = "";
  offlineUrl.searchParams.set("offline", "1");
  window.history.replaceState({}, "", offlineUrl.toString());
}

if ((params.has("offline") || offlineLobbyFallback) && params.get("game")) {
  launchSelfContained();
} else if (params.has("offline") || offlineLobbyFallback) {
  launchOffline();
} else if (
  params.get("game") ||
  params.has("lobby") ||
  params.has("preview") ||
  params.has("create") ||
  params.has("users") ||
  params.toString() === ""
) {
  launchHosted("#app");
} else if (process.env.VUE_APP_BGIO) {
  launch("#app");
} else {
  launchSelfContained();
}
