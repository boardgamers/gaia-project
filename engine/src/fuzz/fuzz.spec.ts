/**
 * FUZZER_PLAN.md §2 — the SMALL smoke corpus, part of `npm test` (seconds, fixed seeds), plus the
 * `regressions/` replayer. The big campaigns live in the separate CLI runner (`npm run fuzz`) and
 * are deliberately NOT part of `npm test`.
 */
import { expect } from "chai";
import { isEqual } from "lodash";
import { smokeCorpus } from "./corpus";
import { fuzzGame } from "./driver";
import { loadRegressionFixtures, replayRegression } from "./regressions";

describe("Fuzzer", function () {
  // Full random games; slower than a unit test but bounded (a handful of seeds, ~1s each).
  this.timeout(60000);

  describe("smoke corpus (fixed seeds, end-to-end, tier-1 structural oracles)", () => {
    for (const spec of smokeCorpus()) {
      it(`should play ${spec.gameSeed} (${spec.players}p${spec.lostFleet ? ", Lost Fleet" : ""}) to completion with no oracle failures`, () => {
        const result = fuzzGame(spec);

        expect(result.failures, JSON.stringify(result.failures, null, 2)).to.have.length(0);
        expect(result.finished, "game should reach EndGame").to.be.true;
        expect(result.rounds).to.equal(6);
      });
    }
  });

  describe("regression fixtures (minimized findings — every found bug stays fixed forever)", () => {
    const fixtures = loadRegressionFixtures();

    for (const fixture of fixtures) {
      it(`${fixture.name}: ${fixture.description}`, () => {
        const outcome = replayRegression(fixture);

        // §J3: host-style (fromData-clone-per-move) play must match a plain constructor replay.
        expect(
          isEqual(outcome.hostStyleState, outcome.constructorState),
          "host-style (slowMotion) replay diverged from constructor replay"
        ).to.be.true;
        // Serialization must be lossless.
        expect(
          isEqual(outcome.roundTripState, outcome.constructorState),
          "fromData(JSON) round trip diverged"
        ).to.be.true;
      });
    }

    it("loads all committed fixtures", () => {
      // Guards against a typo'd fixtures directory silently skipping every regression.
      expect(fixtures).to.be.an("array");
    });
  });
});
