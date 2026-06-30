import { expect } from "chai";
import { factionBoard } from ".";
import { possibleSpecialActions } from "../available/actions";
import { qicForDistance, TERRAFORMING_COST } from "../cost";
import Engine from "../engine";
import { Building, Faction, Operator, Phase, Planet, Player as PlayerEnum, Resource } from "../enums";
import { GaiaHex } from "../gaia-hex";
import { moveSpecial } from "../move/actions";
import { Power } from "../player-data";

describe("Space Giants", () => {
  const board = factionBoard(Faction.SpaceGiants);
  const defaults = factionBoard(Faction.Terrans); // Terrans has no building-cost overrides

  it("should have power Area I = 4 and Area II = 4", () => {
    expect(board.power).to.deep.equal({ area1: 4, area2: 4 });
  });

  it("should use standard (non-discounted) building costs, including for the Planetary Institute", () => {
    for (const building of [
      Building.Mine,
      Building.TradingStation,
      Building.ResearchLab,
      Building.Academy1,
      Building.Academy2,
      Building.PlanetaryInstitute,
    ]) {
      expect(board.cost(building, false)).to.deep.equal(defaults.cost(building, false));
    }
  });

  it("should grant a free Navigation research step on game start", () => {
    const setupRewards = board.income[0].rewards;

    // tslint:disable-next-line no-unused-expression
    expect(setupRewards.some((r) => r.type === Resource.UpgradeNavigation)).to.be.true;
  });

  it("should grant +1 ore and +1 knowledge as recurring income", () => {
    const recurringRewards = board.income[1].rewards;

    // tslint:disable-next-line no-unused-expression
    expect(recurringRewards.some((r) => r.type === Resource.Ore && r.count === 1)).to.be.true;
    // tslint:disable-next-line no-unused-expression
    expect(recurringRewards.some((r) => r.type === Resource.Knowledge && r.count === 1)).to.be.true;
  });

  it("should grant +6 power charge instead of the standard +4 when building the Planetary Institute", () => {
    const piRewards = board.buildings[Building.PlanetaryInstitute].income[0].flatMap((event) => event.rewards);

    // tslint:disable-next-line no-unused-expression
    expect(piRewards.some((r) => r.type === Resource.ChargePower && r.count === 6)).to.be.true;
  });

  it("should grant an immediate tech tile of choice when building the Planetary Institute", () => {
    const piRewards = board.buildings[Building.PlanetaryInstitute].income[0].flatMap((event) => event.rewards);

    // tslint:disable-next-line no-unused-expression
    expect(piRewards.some((r) => r.type === Resource.TechTile && r.count === 1)).to.be.true;
  });
});

function createLostFleetRoundMoveEngine(nbPlayers: number, factions: Faction[]) {
  const engine = new Engine([`init ${nbPlayers} lost-fleet-space-giants-special-${nbPlayers}`], { lostFleet: true });

  engine.players.forEach((pl, index) => {
    pl.faction = factions[index];
    pl.loadFaction(null, engine.expansions);
    pl.data.victoryPoints = 30;
    pl.data.qics = 10;
    pl.data.credits = 20;
    pl.data.knowledge = 10;
    pl.data.ores = 10;
    pl.data.power = new Power(4, 4, 4, 0);
  });

  engine.phase = Phase.RoundMove;
  engine.round = 1;
  engine.turnOrder = engine.players.map((pl) => pl.player);
  engine.currentPlayer = PlayerEnum.Player1;

  return engine;
}

function occupyStartingHex(engine: Engine, player: PlayerEnum): GaiaHex {
  const pl = engine.player(player);
  const start = [...engine.map.grid.values()].find(
    (hex) => hex.hasPlanet() && hex.data.spaceship === undefined && !hex.occupied()
  );

  start.data.player = player;
  start.data.building = Building.Mine;
  pl.data.occupied.push(start);
  pl.data.buildings[Building.Mine] = pl.data.occupied.length;

  return start;
}

/** Cheapest unoccupied, non-Transdim/Asteroid/Gaia hex reachable at zero Q.I.C. range cost. */
function cheapestFreeRangeHex(engine: Engine, player: PlayerEnum, planet?: Planet): GaiaHex | undefined {
  const pl = engine.player(player);

  for (const hex of engine.map.grid.values()) {
    if (!hex.hasPlanet() || hex.occupied()) {
      continue;
    }
    if ([Planet.Transdim, Planet.Asteroid, Planet.Gaia].includes(hex.data.planet)) {
      continue;
    }
    if (planet && hex.data.planet !== planet) {
      continue;
    }
    const qic = qicForDistance(engine.map, hex, pl, engine.replay);
    if (qic?.amount === 0) {
      return hex;
    }
  }

  return undefined;
}

function findSpecialAction(engine: Engine, player: PlayerEnum, income: string) {
  const [command] = possibleSpecialActions(engine, player);
  const specialact = command?.data.specialacts.find((sa) => sa.income === income);
  return { command, specialact };
}

describe("Space Giants - Exploration board special action", () => {
  it("should offer a once-per-round 'Build a Mine' special action granting exactly 2 free terraforming steps", () => {
    const engine = createLostFleetRoundMoveEngine(2, [Faction.SpaceGiants, Faction.Terrans]);
    occupyStartingHex(engine, PlayerEnum.Player1);
    const player = engine.player(PlayerEnum.Player1);

    const { command, specialact } = findSpecialAction(engine, PlayerEnum.Player1, "2step");
    expect(specialact, "Space Giants should be offered the 2-free-step special action").to.not.equal(undefined);

    const target = cheapestFreeRangeHex(engine, PlayerEnum.Player1);
    expect(target, "need a free-range planet to terraform").to.not.equal(undefined);

    const mineCost = player.board.cost(Building.Mine, false);
    const beforeOres = player.data.ores;
    const beforeCredits = player.data.credits;

    engine.turnMoves = [`build m ${target.toString()}`];
    moveSpecial(engine, command, PlayerEnum.Player1, "2step");

    // Space Giants require a flat 2 terraforming steps, fully covered by the granted free steps.
    expect(target.data.building).to.equal(Building.Mine);
    expect(target.data.player).to.equal(PlayerEnum.Player1);
    expect(player.data.ores).to.equal(beforeOres - (mineCost.find((r) => r.type === Resource.Ore)?.count ?? 0));
    expect(player.data.credits).to.equal(
      beforeCredits - (mineCost.find((r) => r.type === Resource.Credit)?.count ?? 0)
    );

    const activatedEvent = player.events[Operator.Activate].find((ev) => ev.spec === "=> 2step");
    // tslint:disable-next-line no-unused-expression
    expect(activatedEvent.activated).to.be.true;

    // Locked for the rest of the round.
    const { specialact: relocked } = findSpecialAction(engine, PlayerEnum.Player1, "2step");
    expect(relocked).to.equal(undefined);
  });

  it("should still charge ore for a 3rd terraforming step beyond the 2 free ones (e.g. a Protoplanet)", () => {
    const engine = createLostFleetRoundMoveEngine(2, [Faction.SpaceGiants, Faction.Terrans]);
    occupyStartingHex(engine, PlayerEnum.Player1);
    const player = engine.player(PlayerEnum.Player1);

    const { command, specialact } = findSpecialAction(engine, PlayerEnum.Player1, "2step");
    expect(specialact).to.not.equal(undefined);

    const target = cheapestFreeRangeHex(engine, PlayerEnum.Player1, Planet.Protoplanet);
    expect(target, "need a free-range Protoplanet hex").to.not.equal(undefined);

    const mineCost = player.board.cost(Building.Mine, false);
    const baseOreCost = mineCost.find((r) => r.type === Resource.Ore)?.count ?? 0;
    const beforeOres = player.data.ores;
    const beforeVp = player.data.victoryPoints;

    engine.turnMoves = [`build m ${target.toString()}`];
    moveSpecial(engine, command, PlayerEnum.Player1, "2step");

    // Protoplanet always requires 3 steps; 2 are free, so exactly 1 extra step's worth of ore is owed
    // on top of the mine's normal ore cost (no terraform research discount in this setup). Because
    // Protoplanet is Space Giants' home planet, this setup build does NOT get the +6 VP bonus.
    expect(target.data.building).to.equal(Building.Mine);
    expect(player.data.ores).to.equal(beforeOres - baseOreCost - TERRAFORMING_COST);
    expect(player.data.victoryPoints).to.equal(beforeVp);
  });

  it("should not offer the special action to factions other than Space Giants", () => {
    const engine = createLostFleetRoundMoveEngine(2, [Faction.Terrans, Faction.SpaceGiants]);

    const { specialact } = findSpecialAction(engine, PlayerEnum.Player1, "2step");
    expect(specialact).to.equal(undefined);
  });
});
