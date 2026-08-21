import Engine, { PlayerEnum } from "@gaia-project/engine";
import { Round } from "@gaia-project/engine/src/enums";
import { expect } from "chai";
import { autoLeechRiskWarning } from "./pass";

function make2pEngine(): Engine {
  return new Engine(["init 2 pass-warning-seed", "p1 faction terrans", "p2 faction nevlas"]);
}

describe("autoLeechRiskWarning", () => {
  it("warns when the preference auto-accepts a costly leech and another player is still active", () => {
    const engine = make2pEngine();
    const player = engine.player(PlayerEnum.Player1);

    const warning = autoLeechRiskWarning(engine, player, "3");

    expect(warning).to.not.equal(null);
    expect(warning.message).to.include("3 power");
  });

  it("does not warn when the preference is 'ask' (no auto-accept risk at all)", () => {
    const engine = make2pEngine();
    const player = engine.player(PlayerEnum.Player1);

    expect(autoLeechRiskWarning(engine, player, "ask")).to.equal(null);
  });

  it("does not warn when the preference is 'decline-cost' (never accepts a VP-costing leech)", () => {
    const engine = make2pEngine();
    const player = engine.player(PlayerEnum.Player1);

    expect(autoLeechRiskWarning(engine, player, "decline-cost")).to.equal(null);
  });

  it("does not warn when the threshold is 1 (leeching 1 power never costs a VP)", () => {
    const engine = make2pEngine();
    const player = engine.player(PlayerEnum.Player1);

    expect(autoLeechRiskWarning(engine, player, "1")).to.equal(null);
  });

  it("does not warn when the passed-round cap keeps automatic leech below VP cost", () => {
    const engine = make2pEngine();
    const player = engine.player(PlayerEnum.Player1);

    expect(autoLeechRiskWarning(engine, player, "5;passedCap=1")).to.equal(null);
  });

  it("mentions the passed-round cap when costly auto-leech is still possible", () => {
    const engine = make2pEngine();
    const player = engine.player(PlayerEnum.Player1);

    const warning = autoLeechRiskWarning(engine, player, "5;passedCap=2");

    expect(warning).to.not.equal(null);
    expect(warning.message).to.include("capped at 2 total power");
  });

  it("does not warn on the last round (already safe per the engine's own passed-player rule)", () => {
    const engine = make2pEngine();
    engine.round = Round.LastRound;
    const player = engine.player(PlayerEnum.Player1);

    expect(autoLeechRiskWarning(engine, player, "5")).to.equal(null);
  });

  it("does not warn when this player would be the last to pass (nobody left to trigger a leech offer)", () => {
    const engine = make2pEngine();
    const player = engine.player(PlayerEnum.Player1);
    engine.passedPlayers = [PlayerEnum.Player2];

    expect(autoLeechRiskWarning(engine, player, "4")).to.equal(null);
  });

  it("does not warn when the only other player has dropped", () => {
    const engine = make2pEngine();
    const player = engine.player(PlayerEnum.Player1);
    engine.player(PlayerEnum.Player2).dropped = true;

    expect(autoLeechRiskWarning(engine, player, "4")).to.equal(null);
  });
});
