import { expect } from "chai";
import PilingSong from "./fixtures/Piling-song-3477.data.json";
import WavelyTriangle from "./fixtures/Wavely-triangle-5324.data.json";
import Engine from "./src/engine";
import { isOutclassedBy } from "./src/federation";
import { currentPlayer, logSlice, move, scores } from "./wrapper";

/**
 * Regression tests for the federation-enumeration performance issue that got two
 * production games stuck: engine.move() took >10s (the platform kills engine calls
 * at 10s) because Player.availableFederations exploded combinatorially on late-game
 * states with many building groups.
 *
 * The fixtures are the actual production game states. Before the optimization, the
 * moves below took ~5s and ~3.5s on a fast dev machine (and >10s in production);
 * they now take well under a second, so the generous bounds here should only trip
 * on a real complexity regression, not on slow CI hardware.
 */
describe("federation computation performance", function () {
  this.timeout(30000);

  const MAX_MS = 5000;

  it("Wavely-triangle-5324: 'xenos action qic3.' completes quickly", () => {
    const engine = Engine.fromData(JSON.parse(JSON.stringify(WavelyTriangle)));
    const historyLength = engine.moveHistory.length;

    const start = Date.now();
    const result = move(engine, "xenos action qic3.", 1);
    const elapsed = Date.now() - start;

    expect(result.moveHistory.length).to.be.greaterThan(historyLength);
    expect(result.moveHistory[historyLength]).to.match(/^xenos action qic3\./);
    expect(elapsed).to.be.lessThan(MAX_MS);

    // The follow-up entry points the platform calls on the result also complete
    expect(currentPlayer(result)).to.be.a("number");
    expect(scores(result)).to.have.length(4);
    expect(logSlice(result, { start: historyLength }).log).to.have.length(1);
  });

  it("Piling-song-3477: baltaks' federation move completes quickly", () => {
    // The failing move is at index 203 of the fixture's move history: load the state
    // right before it, then apply it as a live move (which triggers the expensive
    // legality checks and the next player's federation computation)
    const engine = Engine.fromData(JSON.parse(JSON.stringify(PilingSong))).replayedTo(203, false);
    const historyLength = engine.moveHistory.length;

    const start = Date.now();
    const result = move(
      engine,
      "baltaks federation 10A10,10A3,10A4,10A9,10B0,10B1,10B2,10B3,10B4 fed6 using area1: 3.",
      0
    );
    const elapsed = Date.now() - start;

    expect(result.moveHistory.length).to.be.greaterThan(historyLength);
    // Same power-token accounting as when the move was accepted in production
    expect(result.moveHistory[historyLength]).to.equal(
      "baltaks federation 10A10,10A3,10A4,10A9,10B0,10B1,10B2,10B3,10B4 fed6 using area1: 3. (6/1/0/0 ⇒ 3/1/0/0)"
    );
    expect(elapsed).to.be.lessThan(MAX_MS);

    expect(currentPlayer(result)).to.be.a("number");
    expect(scores(result)).to.have.length(3);
    expect(logSlice(result, { start: historyLength }).log).to.have.length(1);
  });

  it("Piling-song-3477: availableFederations returns only rules-legal federations", () => {
    const engine = Engine.fromData(JSON.parse(JSON.stringify(PilingSong))).replayedTo(203, false);

    for (const player of engine.players) {
      player.federationCache = null;
      const feds = player.availableFederations(engine.map, engine.options.flexibleFederations);

      for (const fed of feds) {
        expect(fed.powerValue).to.be.at.least(player.federationCost);
        expect(fed.newSatellites).to.be.at.most(player.maxSatellites);
        // The hexes of a federation must form a single connected group
        expect(engine.map.grid.groups(fed.hexes)).to.have.length(1);
      }

      // No returned federation may be outclassed by another one
      for (const fed of feds) {
        for (const other of feds) {
          if (fed !== other) {
            expect(isOutclassedBy(fed, other), "federation should not be outclassed").to.be.false;
          }
        }
      }
    }
  });
});
