import launchHosted from "./hosted";
import launch from "./launcher";
import launchSelfContained from "./self-contained";

console.log(process.env);

// ?game=<uuid> / ?lobby=1 boot the Supabase-hosted multiplayer mode; every
// other URL keeps the existing self-contained behavior (demo, scenarios,
// state-share links) untouched.
const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");

if (params.get("game") || params.has("lobby")) {
  launchHosted("#app");
} else if (process.env.VUE_APP_BGIO) {
  launch("#app");
} else {
  launchSelfContained();
}
