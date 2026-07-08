import launchHosted from "./hosted";
import launch from "./launcher";
import launchSelfContained from "./self-contained";

console.log(process.env);

// ?game=<uuid> / ?lobby=1 / ?create=1 / ?users=1 boot the Supabase-hosted multiplayer
// mode; every other URL with query params keeps the existing self-contained
// behavior (demo, scenarios, state-share links, e.g.
// ?players=2&seed=..&lostFleet=1) untouched. The bare production URL (no
// query string at all) now defaults to the hosted lobby/login, since that's
// the primary entry point.
const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");

if (params.get("game") || params.has("lobby") || params.has("create") || params.has("users") || params.toString() === "") {
  launchHosted("#app");
} else if (process.env.VUE_APP_BGIO) {
  launch("#app");
} else {
  launchSelfContained();
}
