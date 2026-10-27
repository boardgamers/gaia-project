import Engine from "@gaia-project/engine";
import { Phase } from "@gaia-project/engine/src/enums";
import { expect } from "chai";
import { automaLastTurnPoints } from "./automa";

const moves = [
  "init 1 solo-preview",
  "p1 faction terrans",
  "p2 faction itars",
  "p1 build m 6B3",
  "itars build m 5A4",
  "itars build m 4A3",
  "p1 build m 3A5",
  "itars booster booster-lostfleet-former",
  "p1 booster booster4",
  "terrans up eco (0 ⇒ 1).",
  "itars automa 3,7 [up int]",
];

for (const [difficulty, points] of [
  ["automa", 4],
  ["alptrauma", 5],
] as const) {
  it(`shows the actual Itars faction VP on ${difficulty} difficulty`, () => {
    const engine = new Engine(moves, { lostFleet: true, automaDifficulty: difficulty });
    const player = engine.players[1];
    expect(automaLastTurnPoints(engine, player)).to.equal(0);
    engine.move("terrans pass booster5");
    engine.move("itars automa 13");
    expect(engine.automa.lastActions).to.deep.equal(["block power4", "block power5"]);
    expect(automaLastTurnPoints(engine, player)).to.equal(points);
    // It stays attached to that turn, including after saving/loading, rather than
    // picking up unrelated later VP changes or the end-game totals.
    engine.advancedLog.push({ phase: Phase.EndGame });
    engine.advancedLog.push({ player: 1, changes: { itars: { vp: 20 } } });
    const loaded = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    expect(automaLastTurnPoints(loaded, loaded.players[1])).to.equal(points);
    loaded.automa.action = undefined;
    expect(automaLastTurnPoints(loaded, loaded.players[1])).to.equal(0);
  });
}
