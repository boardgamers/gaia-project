import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import Engine from "./src/engine";
import { Phase } from "./src/enums";

// Drift guard (PREMOVE_PLAN.md §9, finding #8): supabase/functions/_shared/engine.bundle.js is a
// separately-built esbuild artifact (`npm run build:edge-engine`, run from the repo root) that the
// premove edge functions import instead of this package. Nothing enforces that it stays in sync with
// engine/src as this package evolves, so this test replays the same move logs through both the real
// TS engine and the built bundle (dynamically imported, since it's a plain ESM file Node can load
// directly) and asserts identical playerToMove/round/phase/moveHistory.length. A failure here means
// someone edited engine/src without re-running the bundle build.
describe("edge function engine bundle (drift guard)", () => {
  const bundlePath = path.join(__dirname, "..", "supabase", "functions", "_shared", "engine.bundle.js");

  before(function () {
    if (!fs.existsSync(bundlePath)) {
      this.skip();
    }
  });

  async function loadBundle(): Promise<{ Engine: typeof Engine; Phase: typeof Phase }> {
    return import(bundlePath);
  }

  function summarize(engine: Engine) {
    return {
      playerToMove: engine.playerToMove,
      round: engine.round,
      phase: engine.phase,
      moveHistoryLength: engine.moveHistory.length,
    };
  }

  it("replays a base-game 2p setup identically", async () => {
    const moves = [
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

    const real = new Engine(moves, {});
    real.generateAvailableCommandsIfNeeded();

    const bundled = await loadBundle();
    const viaBundle = new bundled.Engine(moves, {});
    viaBundle.generateAvailableCommandsIfNeeded();

    expect(summarize(viaBundle)).to.deep.equal(summarize(real));
    expect(viaBundle.phase).to.equal(Phase.RoundMove);
  });

  it("replays a Lost Fleet setup identically", async () => {
    const moves = ["init 2 lost-fleet-one-mine"];

    const real = new Engine(moves, { lostFleet: true });
    real.generateAvailableCommandsIfNeeded();

    const bundled = await loadBundle();
    const viaBundle = new bundled.Engine(moves, { lostFleet: true });
    viaBundle.generateAvailableCommandsIfNeeded();

    expect(summarize(viaBundle)).to.deep.equal(summarize(real));
  });
});
