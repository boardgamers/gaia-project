import Engine, { Command } from "@gaia-project/engine";
import { expect } from "chai";
import { autoDecideChargePower } from "./auto-decide";

// Same fixture as hosted/host.spec.ts's SETUP_MOVES: after these, "terrans build ts -1x2." triggers
// a leech decision (charge/decline) for nevlas (seat 1) - the §J2 out-of-order interrupt case.
const SETUP_MOVES = [
  "p1 faction terrans",
  "p2 faction nevlas",
  "terrans build m -1x2",
  "nevlas build m -1x0",
  "nevlas build m 0x-4",
  "terrans build m -4x-1",
  "nevlas booster booster7",
  "terrans booster booster3",
];

function engineWithPendingLeech(): Engine {
  const engine = new Engine(["init 2 randomSeed", ...SETUP_MOVES]);
  engine.move("terrans build ts -1x2.");
  engine.generateAvailableCommandsIfNeeded();
  return engine;
}

describe("autoDecideChargePower", () => {
  it("does nothing when the preference is 'ask' (the default)", () => {
    const engine = engineWithPendingLeech();
    const before = engine.moveHistory.length;

    const result = autoDecideChargePower(engine, "ask");

    expect(result).to.equal(null);
    expect(engine.moveHistory.length).to.equal(before);
    expect(engine.availableCommands.some((c) => c.name === Command.ChargePower || c.name === Command.Decline)).to.equal(
      true
    );
  });

  it("does nothing when the pending seat is not eligible (not one of the local user's seats)", () => {
    const engine = engineWithPendingLeech();
    const before = engine.moveHistory.length;

    const result = autoDecideChargePower(engine, 5, () => false);

    expect(result).to.equal(null);
    expect(engine.moveHistory.length).to.equal(before);
  });

  it("'decline-cost' mode still auto-accepts a leech that costs 1 power or less (only real costs get auto-declined)", () => {
    const engine = engineWithPendingLeech();
    const before = engine.moveHistory.length;

    const result = autoDecideChargePower(engine, "decline-cost");

    expect(result).to.be.a("string");
    expect(result).to.include(Command.ChargePower);
    expect(engine.moveHistory.length).to.be.greaterThan(before);
    expect(engine.availableCommands.some((c) => c.name === Command.ChargePower || c.name === Command.Decline)).to.equal(
      false
    );
  });

  it("leaves a leech offer above the chosen numeric threshold for a real decision (asks, doesn't decline)", () => {
    const engine = engineWithPendingLeech();
    const before = engine.moveHistory.length;

    // this fixture's offer is a 1-power charge - the smallest real AutoCharge threshold (1) would
    // already auto-accept it, so 0 (below the valid 1-5 range, only used here to exercise
    // askOrDeclineBasedOnCost's "above threshold" branch) is the only way to force an ask.
    const result = autoDecideChargePower(engine, 0 as any);

    expect(result).to.equal(null);
    expect(engine.moveHistory.length).to.equal(before);
    expect(engine.availableCommands.some((c) => c.name === Command.ChargePower)).to.equal(true);
  });

  it("auto-accepts a leech within the chosen power threshold", () => {
    const engine = engineWithPendingLeech();
    const offer = engine.availableCommands.find(
      (c) => c.name === Command.ChargePower
    ) as any;
    const maxCharge = Math.max(...offer.data.offers.map((o: any) => Number(/(\d+)pw/.exec(o.offer)[1])));

    const result = autoDecideChargePower(engine, maxCharge as any);

    expect(result).to.be.a("string");
    expect(result).to.include(Command.ChargePower);
  });

  it("only applies the given preference to the currently-pending seat, not other players' settings", () => {
    const engine = engineWithPendingLeech();
    const pendingSeat = engine.playerToMove;

    autoDecideChargePower(engine, "decline-cost");

    const otherSeat = pendingSeat === 0 ? 1 : 0;
    expect(engine.player(otherSeat).settings.autoChargePower).to.not.equal("decline-cost");
  });
});
