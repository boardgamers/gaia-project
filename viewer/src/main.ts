import launchSelfContained from "./self-contained";

// Dev-server entry point (the published lib build uses src/wrapper.ts instead, which keeps the
// hosted `launch` for the BGS iframe - this file is never part of that bundle). Boot the
// self-contained viewer unconditionally, with or without query params
// (?players=2&seed=..&lostFleet=1 etc. still configure the game).
//
// The bare URL used to fall back to the plain hosted `launch("#app")` lobby, whose "N players"
// buttons emit the init move to a backend over the launcher interface. There is no backend behind
// `pnpm serve`, so those presses fired into the void and the game never advanced. Self-contained
// mode runs the engine in-browser - and, in dev, vite aliases @gaia-project/engine onto
// engine/src (see vite.config.ts), so it always uses the up-to-date engine source, never the
// stale dist/ build.
launchSelfContained();
