import Engine from "@gaia-project/engine";
import { expect } from "chai";
import { buildSequentialChainPreview } from "./premove-preview";

// Same fixture as host.spec.ts/Game.spec.ts's "premove (hosted mode)" describe block: after these
// moves it's terrans' (seat 0) turn, and "nevlas up terra." / "nevlas pass booster4" are both legal,
// turn-completing moves for nevlas (seat 1).
const SETUP_MOVES = [
  "init 2 randomSeed",
  "p1 faction terrans",
  "p2 faction nevlas",
  "terrans build m -1x2",
  "nevlas build m -1x0",
  "nevlas build m 0x-4",
  "terrans build m -4x-1",
  "nevlas booster booster7",
  "terrans booster booster3",
];

describe("buildSequentialChainPreview", () => {
  it("forces the given seat's turn with no prior moves (equivalent to previewAvailableCommandsFor)", () => {
    const engine = new Engine(SETUP_MOVES);
    const clone = buildSequentialChainPreview(engine, 1, []);
    expect(clone.playerToMove).to.equal(1);
    expect(clone.availableCommands.map((c) => c.name)).to.include("up");
  });

  it("previews premove #2 against a clone with #1 already applied", () => {
    const engine = new Engine(SETUP_MOVES);
    const clone = buildSequentialChainPreview(engine, 1, ["nevlas up terra."]);
    // #1's effect (the research upgrade) is visible, and it's forced back to seat 1's turn for #2.
    expect(clone.playerToMove).to.equal(1);
    expect(clone.availableCommands.map((c) => c.name)).to.not.include("up");
    expect(clone.availableCommands.map((c) => c.name)).to.include("pass");

    // #2 itself is a legal, turn-completing move against this chained preview.
    clone.move("nevlas pass booster4");
    clone.generateAvailableCommandsIfNeeded();
    expect(clone.newTurn).to.equal(true);
  });

  it("does not throw, and stops the chain, when an earlier queued move has gone illegal", () => {
    const engine = new Engine(SETUP_MOVES);
    // "up nav" is not a real prior queued move for this fixture - simulates a since-illegal entry.
    const clone = buildSequentialChainPreview(engine, 1, ["nevlas build m 99x99"]);
    // Broke on the illegal replay, so the preview reflects the ORIGINAL state, still forced to seat 1.
    expect(clone.playerToMove).to.equal(1);
    expect(clone.availableCommands.map((c) => c.name)).to.include("up");
  });

  it("keeps chaining when premove #1 offers an opponent a leech", () => {
    const engine = new Engine(SETUP_MOVES);
    // Nevlas's mine at -1x0 is two hexes from terrans' at -1x2, so upgrading it offers terrans 2
    // power - a real decision (it costs a VP), which parks the engine in Phase.RoundLeech. Replaying
    // that move used to leave the chain clone stuck in that phase, where the next slot could
    // generate no commands at all and every queued row behind it read "no longer possible".
    engine.players[1].data.credits = 20;
    engine.players[1].data.ores = 20;

    const clone = buildSequentialChainPreview(engine, 1, ["nevlas build ts -1x0."]);

    expect(clone.playerToMove).to.equal(1);
    expect(clone.availableCommands.length).to.be.greaterThan(0);
    expect(clone.availableCommands.map((c) => c.name)).to.include("pass");

    clone.move("nevlas pass booster4");
    clone.generateAvailableCommandsIfNeeded();
    expect(clone.newTurn).to.equal(true);
  });

  it("leaves the original engine untouched", () => {
    const engine = new Engine(SETUP_MOVES);
    const before = JSON.stringify(engine);
    buildSequentialChainPreview(engine, 1, ["nevlas up terra."]);
    expect(JSON.stringify(engine)).to.equal(before);
  });
});
