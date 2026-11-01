import Engine, { Expansion, Faction, FinalTile, Planet, Player } from "@gaia-project/engine";
import { expect } from "chai";
import { parseCommands } from "../recent";
import { ChartSource } from "./charts";
import { finalScoringExtractLog, finalScoringSources } from "./final-scoring";
import { planetsSourceFactory } from "./plantets";
import { ExtractLog } from "./simple-charts";

function fixture() {
  const engine = new Engine(["init 2 lantids-chart-audit"], { lostFleet: true });
  engine.players.forEach((p, i) => {
    p.faction = i ? Faction.Xenos : Faction.Lantids;
    p.loadFaction(null, Expansion.LostFleet);
  });
  // Charts read the final board while walking the full move log.
  for (const [location, planet] of [
    ["DS11_0", Planet.Terra],
    ["DS11_1", Planet.Protoplanet],
    ["DS12_0", Planet.Gaia],
    ["DS13_0", Planet.Lost],
    ["DS14_0", Planet.Gaia],
  ] as const) {
    engine.map.getS(location).data.planet = planet;
  }
  return engine;
}

function walk<T extends FinalTile | Planet>(
  engine: Engine,
  player: Player,
  extract: ExtractLog<ChartSource<T>>,
  type: T,
  moves: string[]
) {
  const source = { type, label: type, color: "black", weight: 1 };
  const process = extract.processor(player, source, engine);
  return moves.map((move) => {
    const commands = parseCommands(move);
    return commands.reduce(
      (n, cmd, cmdIndex) => n + process({ cmd, allCommands: commands, cmdIndex, source, data: engine, log: {} }),
      0
    );
  });
}

describe("Lantids scoring charts", () => {
  it("counts own and shared deep sectors once, including Lost Planets and completed Gaia projects", () => {
    const engine = fixture();
    const moves = [
      `lantids build m ${engine.map.getS("DS11_0").toString()}`,
      "xenos build m DS11_1",
      "lantids build m DS11_1",
      `xenos build m ${engine.map.getS("DS12_0").toString()}`,
      "lantids build m DS12_0",
      "xenos lostPlanet DS13_0",
      "lantids build m DS13_0",
      "lantids build gf DS14_0",
      "lantids build m DS14_0",
      "lantids build ts DS11_0",
    ];
    const counts = () => walk(engine, engine.players[0], finalScoringExtractLog, FinalTile.DeepSpaceSector, moves);
    expect(counts()).to.deep.equal([1, 0, 0, 0, 1, 0, 1, 0, 1, 0]);
    expect(counts()).to.deep.equal([1, 0, 0, 0, 1, 0, 1, 0, 1, 0]);
    expect(finalScoringSources[FinalTile.DeepSpaceSector].contributors).to.include("Lantids Guest Mine");
  });

  it("distinguishes independent colonization from sharing, including on the Lost Planet", () => {
    const engine = fixture();
    const moves = [
      `lantids build m ${engine.map.getS("DS11_0").toString()}`,
      `xenos build m ${engine.map.getS("DS12_0").toString()}`,
      "lantids build m DS12_0",
      "xenos lostPlanet DS13_0",
      "lantids build m DS13_0",
      "lantids build gf DS14_0",
      "lantids build m DS14_0",
    ];
    const count = (tile: FinalTile) => walk(engine, engine.players[0], finalScoringExtractLog, tile, moves);
    expect(count(FinalTile.PlanetType)).to.deep.equal([1, 0, 0, 0, 0, 0, 1]);
    expect(count(FinalTile.Gaia)).to.deep.equal([0, 0, 0, 0, 0, 0, 1]);
    expect(count(FinalTile.Structure)).to.deep.equal([1, 0, 1, 0, 1, 0, 1]);
  });

  it("keeps planet-chart state separate between players, sources and rebuilds", () => {
    const engine = fixture();
    const moves = [
      `lantids build m ${engine.map.getS("DS11_0").toString()}`,
      `xenos build m ${engine.map.getS("DS12_0").toString()}`,
      "lantids build m DS12_0",
      "xenos lostPlanet DS13_0",
      "lantids build m DS13_0",
      "lantids build gf DS14_0",
      "lantids build m DS14_0",
    ];
    for (let repeat = 0; repeat < 2; repeat++) {
      for (const p of engine.players) {
        const guest = walk(engine, p, planetsSourceFactory.extractLog, Planet.Empty, moves);
        expect(guest.reduce((a, b) => a + b, 0)).to.equal(p.faction === Faction.Lantids ? 2 : 0);
        const terra = walk(engine, p, planetsSourceFactory.extractLog, Planet.Terra, moves);
        expect(terra.reduce((a, b) => a + b, 0)).to.equal(p.faction === Faction.Lantids ? 1 : 0);
        const transdim = walk(engine, p, planetsSourceFactory.extractLog, Planet.Transdim, moves);
        expect(transdim.reduce((a, b) => a + b, 0)).to.equal(p.faction === Faction.Lantids ? 1 : 0);
      }
    }
  });
});
