import Engine from "@gaia-project/engine";
import { AutoCharge } from "@gaia-project/engine/src/player";

/**
 * "Auto leech": the engine already fully implements auto-deciding power-charge/decline offers
 * (engine/src/auto-charge.ts, engine/src/move/auto.ts's `Engine.autoMove()`) via a per-player
 * `Settings.autoChargePower` field, but nothing in this viewer ever called it - the setting always
 * sat at its class default and was never consulted, so every leech interrupt always had to be
 * decided by hand. This is a thin viewer-side wrapper: it applies the LOCAL user's own preference
 * (never synced/persisted as part of game state - see the callers in self-contained.ts/host.ts) to
 * whichever seat is currently due to act, as long as that seat passes `isEligibleSeat` (in hosted
 * mode: one of the local user's own seats - never decide on a stranger's behalf), and lets
 * `autoMove()` chain through as many auto-decidable leech interrupts as apply. Stops the moment a
 * real decision is needed, the current seat isn't eligible, or the preference is "ask" (the
 * default - nothing auto-decides unless a user opts in).
 *
 * Mutates `engine` directly (via `Engine.autoMove()`) - callers that must go through their own
 * commit/broadcast pipeline (e.g. hosted mode's Supabase-backed commit) should call this on a
 * disposable clone and feed the returned move line through that pipeline instead of using the
 * mutated clone itself.
 */
/** The stored preference is always a string (localStorage/env-var friendly); numeric thresholds
 * come back out as real numbers here since that's what `AutoCharge`/`askOrDeclineBasedOnCost`
 * expect. */
export function parseAutoChargePreference(pref: string | boolean): AutoCharge {
  if (pref === "decline-cost") {
    return "decline-cost";
  }
  const n = Number(pref);
  return n >= 1 && n <= 5 ? (n as AutoCharge) : "ask";
}

export function autoDecideChargePower(
  engine: Engine,
  autoChargePower: AutoCharge,
  isEligibleSeat: (seat: number) => boolean = () => true
): string | null {
  if (autoChargePower === "ask") {
    return null;
  }

  const before = engine.moveHistory.length;
  let iterations = 0;
  while (engine.playerToMove !== undefined && isEligibleSeat(engine.playerToMove) && iterations++ < 20) {
    engine.player(engine.playerToMove).settings.autoChargePower = autoChargePower;
    if (!engine.autoMove()) {
      break;
    }
  }

  return engine.moveHistory.length > before ? engine.moveHistory.slice(before).join(". ") : null;
}
