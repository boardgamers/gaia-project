import launch from "./launcher";
import launchSelfContained from "./self-contained";

// Dev-server entry point (the published lib build uses src/wrapper.ts instead).
// URLs with query params (demo, scenarios, state-share links, e.g. ?players=2&seed=..&lostFleet=1)
// boot the self-contained viewer; the bare URL boots the plain launcher.
const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");

if (params.toString() !== "") {
  launchSelfContained();
} else {
  launch("#app");
}
