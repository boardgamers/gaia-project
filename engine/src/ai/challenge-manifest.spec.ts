import { expect } from "chai";
import { Phase } from "../enums";
import goldenManifest from "./challenge-manifest.v1.json";
import { LOST_FLEET_CHALLENGE } from "./challenge";
import {
  assertValidChallengeManifest,
  bootChallengeEngine,
  challengeManifestSha256,
  generateChallengeManifest,
} from "./challenge-manifest";

describe("Phase 0 AI challenge manifest", () => {
  it("boots only through deterministic faction choice", () => {
    const engine = bootChallengeEngine();

    expect(engine.phase).to.equal(Phase.SetupBuilding);
    expect(engine.newTurn).to.equal(true);
    expect(engine.players.map((player) => player.faction)).to.deep.equal(
      LOST_FLEET_CHALLENGE.seats.map((seat) => seat.faction)
    );
    expect(engine.players.every((player) => player.data.occupied.length === 0)).to.equal(true);
    expect(engine.players.every((player) => player.data.tiles.booster === null)).to.equal(true);
    expect(LOST_FLEET_CHALLENGE.strategicSetupDecisions).to.deep.equal(["starting-buildings", "round-boosters"]);
  });

  it("matches the checked-in manifest generated from the real engine", () => {
    const generated = generateChallengeManifest();
    assertValidChallengeManifest(generated);
    expect(generated).to.deep.equal(goldenManifest);
  });

  it("is deterministic and covers separate Space and Deep Space fields", () => {
    const first = generateChallengeManifest();
    const second = generateChallengeManifest();

    expect(challengeManifestSha256(first)).to.equal(challengeManifestSha256(second));
    expect(first.map.objectives.space.sectorIds).to.not.be.empty;
    expect(first.map.objectives.deepSpace.sectorIds).to.not.be.empty;
    expect(first.setup.finalScoring.objectives.space).to.have.property("selected");
    expect(first.setup.finalScoring.objectives.deepSpace).to.have.property("selected");
  });
});
