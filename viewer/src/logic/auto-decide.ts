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
 * real decision is needed or the current seat isn't eligible.
 *
 * We deliberately run `autoMove()` even when the preference is "ask" (the default). "Ask" is NOT
 * "auto-decide nothing": the engine's charge rules include a handful of decisions that are never a
 * real choice regardless of preference - chiefly a player who has already PASSED being offered a
 * charge in the LAST round, where the power can never be spent and any charge beyond the first only
 * costs VP (engine/src/auto-charge.ts's `askOrDeclineForPassedPlayer`). `autoMove()` resolves exactly
 * those (recording an ordinary decline/charge move - fully replay-safe, nothing about the move
 * sequence changes), and returns false for any genuine leech, which an "ask" user still decides by
 * hand. Without this, a passed player in round 6 was pointlessly made a pending turn everyone had to
 * wait on.
 *
 * Mutates `engine` directly (via `Engine.autoMove()`) - callers that must go through their own
 * commit/broadcast pipeline (e.g. a hosted mode's server-backed commit) should call this on a
 * disposable clone and feed the returned move line through that pipeline instead of using the
 * mutated clone itself.
 */
/** The stored preference is always a string (localStorage/env-var friendly); numeric thresholds
 * come back out as real numbers here since that's what `AutoCharge`/`askOrDeclineBasedOnCost`
 * expect. */
export function parseAutoChargePreference(pref: string | boolean): AutoCharge {
  if (pref === true) {
    return 1;
  }
  const basePref = String(pref).split(";")[0];
  if (basePref === "decline-cost") {
    return "decline-cost";
  }
  const n = Number(basePref);
  return n >= 1 && n <= 5 ? (n as AutoCharge) : "ask";
}

export function parseAutoChargeMaxPassedRoundLeech(pref: string | number | boolean): number {
  const text = String(pref);
  const encoded = /(?:^|;)passedCap=(\d+)/.exec(text);
  const n = Number(encoded ? encoded[1] : text);
  return n >= 1 && n <= 20 ? n : 0;
}

export function encodeAutoChargePreference(autoChargePower: string, maxPassedRoundLeech: string | number): string {
  const parsed = parseAutoChargePreference(autoChargePower);
  const cap = parseAutoChargeMaxPassedRoundLeech(maxPassedRoundLeech);
  const base = typeof parsed === "number" ? String(parsed) : parsed;
  return cap > 0 && base !== "ask" ? `${base};passedCap=${cap}` : base;
}

export function autoDecideChargePower(
  engine: Engine,
  autoChargePower: AutoCharge,
  isEligibleSeat: (seat: number) => boolean = () => true,
  autoChargeMaxPassedRoundLeech = 0
): string | null {
  const before = engine.moveHistory.length;
  let iterations = 0;
  while (engine.playerToMove !== undefined && isEligibleSeat(engine.playerToMove) && iterations++ < 20) {
    engine.player(engine.playerToMove).settings.autoChargePower = autoChargePower;
    engine.player(engine.playerToMove).settings.autoChargeMaxPassedRoundLeech = autoChargeMaxPassedRoundLeech;
    if (!engine.autoMove()) {
      break;
    }
  }

  return engine.moveHistory.length > before ? engine.moveHistory.slice(before).join(". ") : null;
}
