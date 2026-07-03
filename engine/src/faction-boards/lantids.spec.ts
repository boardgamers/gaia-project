import { expect } from "chai";
import Engine from "../engine";
import { Building, Command, Expansion, Faction, Operator, Planet, Player as PlayerEnum, Resource } from "../enums";
import SpaceMap from "../map";
import Player from "../player";
import { Power } from "../player-data";

const parseMoves = Engine.parseMoves;

describe("Lantids", () => {
  it("should be able to build a mine on other players' planets", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction xenos
      p1 build m -3x4
      p2 build m -2x2
      p2 build m -5x5
      p1 build m -1x2
      p2 build m 1x2
      p2 booster booster3
      p1 booster booster7
      p1 build m -2x2.
      p2 charge 1pw
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should gain knowledge when having a PI and building on someone else's planet", () => {
    const engine = new Engine(
      parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction xenos
      p1 build m -3x4
      p2 build m -2x2
      p2 build m -5x5
      p1 build m -1x2
      p2 build m 1x2
      p2 booster booster3
      p1 booster booster7
    `)
    );

    engine.player(PlayerEnum.Player1).data.buildings[Building.PlanetaryInstitute] = 1;
    const k = engine.player(PlayerEnum.Player1).data.knowledge;
    engine.move("p1 build m -2x2.");
    expect(engine.player(PlayerEnum.Player1).data.knowledge).to.equal(k + 2);
  });

  it("should gain only 1 knowledge when getting pt | vp", () => {
    const engine = new Engine(
      parseMoves(`
    init 2 randomSeed
    p1 faction lantids
    p2 faction hadsch-hallas
    lantids build m -4x-1
    hadsch-hallas build m -5x0
    hadsch-hallas build m -2x-4
    lantids build m -4x2
    hadsch-hallas booster booster3
    lantids booster booster4
    lantids pass booster5
    hadsch-hallas build m -4x0.
    lantids decline
    hadsch-hallas pass booster4
    lantids build m -5x0.
    hadsch-hallas decline
    hadsch-hallas pass booster3
    lantids build ts -4x-1.
    hadsch-hallas decline
    `)
    );

    const pl = engine.player(PlayerEnum.Player1);
    const k = pl.data.knowledge;
    engine.move("lantids build lab -4x-1. tech gaia. up gaia.");
    expect(pl.data.knowledge).to.equal(k + 1);
  });

  it("should not get the option to build a federation using other players' buildings", () => {
    const moves = parseMoves(`
      init 2 zadbd
      p1 faction geodens
      p2 faction lantids
      geodens build m 2x-1
      lantids build m 3x-1
      lantids build m 1x-3
      geodens build m 4x-5
      lantids booster booster1
      geodens booster booster4
      geodens build ts 2x-1.
      lantids charge 1pw
      lantids build ts 3x-1.
      geodens charge 2pw
      geodens build PI 2x-1.
      lantids charge 2pw
      lantids build PI 3x-1.
      geodens charge 3pw
      geodens special step. build m 3x-2.
      lantids charge 3pw
      lantids build m 3x-2.
      geodens charge 3pw
      geodens action power5.
      lantids build m 2x-1.
      geodens charge 3pw
      geodens up terra.
    `);

    const engine = new Engine(moves);

    const commands = engine.generateAvailableCommands();

    // tslint:disable-next-line no-unused-expression
    expect(commands.some((cmd) => cmd.name === Command.FormFederation)).to.be.false;
  });

  it("should not get token income from planetary institute", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction xenos
      lantids build m -1x2
      xenos build m -2x2
      xenos build m 1x2
      lantids build m -4x2
      xenos build m -5x5
      xenos booster booster5
      lantids booster booster4
      lantids build ts -1x2.
      xenos charge 1pw
      xenos build ts -2x2.
      lantids charge 2pw
      lantids build PI -1x2.
    `);

    const engine = new Engine(moves);
    const player = engine.player(PlayerEnum.Player1);
    expect(player.resourceIncome(Resource.ChargePower)).to.equal(4);
    expect(player.resourceIncome(Resource.GainToken)).to.equal(0);
  });

  it("should allow to place a mine in the Lost Planet", () => {
    const engine = new Engine(
      parseMoves(`
      init 2 randomSeed
      p1 faction lantids
      p2 faction ivits
      lantids build m 1B0
      lantids build m 4A4
      ivits build PI 1A8
      ivits booster booster3
      lantids booster booster4
      ivits income 1t
      lantids build m 6B4.
      ivits pass booster5
    `)
    );

    const hex = engine.map.getS("1B5");
    hex.data.planet = Planet.Lost;
    hex.data.building = Building.Mine;
    hex.data.player = PlayerEnum.Player2;
    const mines = engine.player(PlayerEnum.Player1).data.buildings[Building.Mine];
    const events = engine.player(PlayerEnum.Player1).events[Operator.Income].length;
    engine.move("p1 build m 1B5.");
    expect(engine.player(PlayerEnum.Player1).data.buildings[Building.Mine]).to.equal(mines + 1);
    expect(engine.player(PlayerEnum.Player1).events[Operator.Income].length).to.equal(events + 1);
  });
});

// RULES_CLARIFICATIONS.md §I2: below 4 players, Lantids use an adjusted PI tile. The base (4p) "gain
// 2 knowledge for an additional mine on an already-colonized planet" ability is unchanged on every
// side (already covered above and directly in player.ts) - these tests only cover what the adjusted
// tile changes on top of it: a 2p/solo Terra-mine trigger, and a 3p extra power charge.
describe("Lantids - Lost Fleet adjusted PI tile (§I2)", () => {
  function terraHex(map: SpaceMap) {
    return [...map.grid.values()].find((hex) => hex.data.planet === Planet.Terra && !hex.data.building);
  }

  function lantidsPlayer(nbPlayers: number, expansions = Expansion.LostFleet) {
    const player = new Player(expansions, PlayerEnum.Player1);
    player.faction = Faction.Lantids;
    player.loadFaction(null, expansions, false, nbPlayers);
    return player;
  }

  it("should grant 2 knowledge for a mine on Terra in 2-player games, even for a normal (non-additional) mine", () => {
    const map = new SpaceMap(2, "lantids-adjusted-pi-2p", false, "standard", true);
    const player = lantidsPlayer(2);
    player.data.buildings[Building.PlanetaryInstitute] = 1;

    const hex = terraHex(map);
    expect(hex, "need an unbuilt Terra hex").to.not.equal(undefined);

    const before = player.data.knowledge;
    player.build(Building.Mine, hex, [], map);
    expect(player.data.knowledge).to.equal(before + 2);
  });

  it("should not grant the Terra-mine bonus without a Planetary Institute", () => {
    const map = new SpaceMap(2, "lantids-adjusted-pi-2p-no-pi", false, "standard", true);
    const player = lantidsPlayer(2);

    const hex = terraHex(map);
    const before = player.data.knowledge;
    player.build(Building.Mine, hex, [], map);
    expect(player.data.knowledge).to.equal(before);
  });

  it("should charge 1 additional power for an additional mine on an already-colonized planet in 3-player games", () => {
    const map = new SpaceMap(3, "lantids-adjusted-pi-3p", false, "standard", true);
    const occupiedHex = [...map.grid.values()].find((hex) => hex.hasPlanet() && !hex.data.building);
    occupiedHex.data.player = PlayerEnum.Player2;
    occupiedHex.data.building = Building.Mine;

    const player = lantidsPlayer(3);
    player.data.buildings[Building.PlanetaryInstitute] = 1;
    player.data.power = new Power(4, 2, 1, 0);

    const beforeKnowledge = player.data.knowledge;
    const beforeSpendablePower = player.data.power.area2 + player.data.power.area3;

    player.build(Building.Mine, occupiedHex, [], map);

    // The base tile's 2-knowledge grant for an additional mine is unchanged; the 3p adjusted tile
    // adds a 1-power charge on top of it.
    expect(player.data.knowledge).to.equal(beforeKnowledge + 2);
    expect(player.data.power.area2 + player.data.power.area3).to.equal(beforeSpendablePower + 1);
  });

  it("should not grant either Lost Fleet bonus in 4-player games (unadjusted base tile)", () => {
    const map = new SpaceMap(4, "lantids-adjusted-pi-4p", false, "standard", true);
    const occupiedHex = [...map.grid.values()].find((hex) => hex.hasPlanet() && !hex.data.building);
    occupiedHex.data.player = PlayerEnum.Player2;
    occupiedHex.data.building = Building.Mine;

    const player = lantidsPlayer(4);
    player.data.buildings[Building.PlanetaryInstitute] = 1;
    player.data.power = new Power(4, 2, 1, 0);

    const beforeKnowledge = player.data.knowledge;
    const beforeSpendablePower = player.data.power.area2 + player.data.power.area3;

    player.build(Building.Mine, occupiedHex, [], map);

    // Base tile's own 2-knowledge grant still applies, but no extra power charge is added at 4p.
    expect(player.data.knowledge).to.equal(beforeKnowledge + 2);
    expect(player.data.power.area2 + player.data.power.area3).to.equal(beforeSpendablePower);
  });

  it("should not grant either Lost Fleet bonus without the Lost Fleet expansion", () => {
    const map = new SpaceMap(2, "lantids-adjusted-pi-no-expansion", false, "standard", false);
    const player = lantidsPlayer(2, Expansion.None);
    player.data.buildings[Building.PlanetaryInstitute] = 1;

    const hex = [...map.grid.values()].find((h) => h.data.planet === Planet.Terra && !h.data.building);
    expect(hex, "need an unbuilt Terra hex").to.not.equal(undefined);

    const before = player.data.knowledge;
    player.build(Building.Mine, hex, [], map);
    expect(player.data.knowledge).to.equal(before);
  });
});
