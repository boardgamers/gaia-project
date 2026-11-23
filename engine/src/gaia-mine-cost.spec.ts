import { expect } from "chai";
import "mocha";
import Engine from "./engine";
import { Building, Command, Faction, Phase, Planet, Player as PlayerEnum, Resource } from "./enums";
import Reward from "./reward";

// Synthetic round-move positions: exercise the real command availability and payment path,
// without relying on faction setup income or a particular map's planet distribution.
function position(faction: Faction, lostFleet: boolean, rangeQic: number, gaiaformer = false) {
  const engine = new Engine(["init 2 gaia-mine-cost"], { lostFleet });
  engine.players.forEach((player, index) => {
    player.faction = index === 0 ? faction : Faction.Xenos;
    player.loadFaction(null, engine.expansions);
    player.data.credits = 10;
    player.data.ores = 10;
  });
  const player = engine.players[0];
  const hexes = [...engine.map.grid.values()].filter((hex) => !hex.hasSpaceship());
  const start = hexes[0];
  const target = hexes.find((hex) => engine.map.distance(start, hex) === 3);
  expect(target, "need a target at distance 3").not.to.equal(undefined);
  start.data.planet = Planet.Terra;
  start.data.player = PlayerEnum.Player1;
  start.data.building = Building.Mine;
  player.data.occupied.push(start);
  player.data.buildings[Building.Mine] = 1;
  player.data.range = rangeQic ? 1 : 3;
  target.data.planet = Planet.Gaia;
  if (gaiaformer) {
    target.data.player = PlayerEnum.Player1;
    target.data.building = Building.GaiaFormer;
    player.data.buildings[Building.GaiaFormer] = 1;
  }
  engine.phase = Phase.RoundMove;
  engine.round = 1;
  engine.turnOrder = [PlayerEnum.Player1, PlayerEnum.Player2];
  engine.currentPlayer = PlayerEnum.Player1;
  const offered = () => {
    engine.clearAvailableCommands();
    return engine
      .findAvailableCommand(PlayerEnum.Player1, Command.Build)
      ?.data.buildings.find((build) => build.coordinates === target.toString() && build.building === Building.Mine);
  };
  return { engine, player, target, offered };
}

const cases: [Faction, number, Resource][] = [
  [Faction.Tinkeroids, 2, Resource.Qic],
  [Faction.Darkanians, 2, Resource.Qic],
  [Faction.SpaceGiants, 2, Resource.Qic],
  [Faction.Moweyds, 1, Resource.Qic],
  [Faction.Terrans, 1, Resource.Qic],
  [Faction.Gleens, 1, Resource.Ore],
];

describe("Gaia mine habitability costs", () => {
  for (const [faction, surcharge, resource] of cases) {
    for (const lostFleet of [false, true]) {
      for (const rangeQic of [0, 1]) {
        it(`${faction}: faction-specific cost with Lost Fleet=${lostFleet}, range QIC=${rangeQic}`, () => {
          const { engine, player, target, offered } = position(faction, lostFleet, rangeQic);
          const qics = rangeQic + (resource === Resource.Qic ? surcharge : 0);
          const ores = 1 + (resource === Resource.Ore ? surcharge : 0);
          player.data.qics = qics;
          player.data.ores = ores;
          const build = offered();
          expect(build).not.to.equal(undefined);
          expect(
            Reward.match(Reward.parse(`2c,${ores}o${qics ? `,${qics}q` : ""}`), Reward.parse(build.cost))
          ).to.equal(true);

          if (qics > 0) {
            player.data.qics = qics - 1;
          } else {
            player.data.ores = ores - 1;
          }
          expect(offered(), "one resource short must not offer the mine").to.equal(undefined);
          expect(() => engine.move(`${faction} build m ${target}`)).to.throw();
          player.data.qics = qics;
          player.data.ores = ores;
          offered();
          engine.move(`${faction} build m ${target}`);
          expect(target.data.building).to.equal(Building.Mine);
          expect(player.data.qics).to.equal(0);
          expect(player.data.ores).to.equal(0);
          expect(player.data.credits).to.equal(8);
        });
      }
    }

    it(`${faction}: a mine replacing its Gaiaformer waives habitability and range QIC`, () => {
      const { engine, player, target, offered } = position(faction, true, 1, true);
      player.data.qics = 0;
      player.data.ores = 1;
      const build = offered();
      expect(build).not.to.equal(undefined);
      expect(Reward.match(Reward.parse("2c,o"), Reward.parse(build.cost))).to.equal(true);
      engine.move(`${faction} build m ${target}`);
      expect(target.data.building).to.equal(Building.Mine);
      expect(player.data.qics).to.equal(0);
      expect(player.data.ores).to.equal(0);
      expect(player.data.buildings[Building.GaiaFormer]).to.equal(0);
    });
  }
});
