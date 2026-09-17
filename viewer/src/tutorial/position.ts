import Engine, { Booster, Building, Faction, Phase, Planet, Power } from "@gaia-project/engine";
import { Operator } from "@gaia-project/engine/src/enums";

export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export type GameData = ReturnType<Engine["toJSON"]>;

export function position(faction = Faction.Terrans, lostFleet = false): Engine {
  const engine = new Engine([`init 3 gaia-tutorial-1`], { lostFleet });
  const factions = [faction, faction === Faction.Ivits ? Faction.Terrans : Faction.HadschHallas, Faction.Geodens];
  engine.players.forEach((player, index) => {
    player.faction = factions[index];
    player.name = ["You", "Ada", "Leo"][index];
    player.loadFaction(null, engine.expansions);
    player.data.credits = 20;
    player.data.ores = 8;
    player.data.knowledge = 8;
    player.data.qics = faction === Faction.Ivits ? 10 : 4;
    player.data.power = new Power(6, 4, 4, 0);
  });
  prepareBoosters(engine);
  engine.phase = Phase.RoundMove;
  engine.round = 2;
  engine.turnOrder = [0, 1, 2];
  engine.currentPlayer = 0;
  return engine;
}

export function planet(engine: Engine, coords: string, type: Planet) {
  const hex = engine.map.getS(coords);
  if (!hex) throw new Error(`Missing tutorial hex ${coords}`);
  hex.data.planet = type;
  return hex;
}

export function building(engine: Engine, coords: string, kind = Building.Mine, seat = 0) {
  const player = engine.players[seat];
  const hex = engine.map.getS(coords);
  if (!hex?.hasPlanet()) throw new Error(`Missing tutorial planet ${coords}`);
  hex.data.player = seat;
  hex.data.building = kind;
  player.data.occupied.push(hex);
  const index = player.data.buildings[kind]++;
  // The position already owns these buildings; only their ongoing effects apply.
  player.loadEvents(player.board.buildings[kind].income[index].filter((event) => event.operator !== Operator.Once));
  player.federationCache = null;
  return hex;
}

export function home(faction = Faction.Terrans) {
  const engine = position(faction);
  planet(engine, "0x0", Planet.Terra);
  building(engine, "0x0");
  planet(engine, "1x0", Planet.Terra);
  planet(engine, "0x1", Planet.Oxide);
  building(engine, "0x1", Building.Mine, 1);
  planet(engine, "-1x0", Planet.Swamp);
  planet(engine, "-2x0", Planet.Transdim);
  planet(engine, "-3x0", Planet.Terra);
  return engine;
}

export function federationPosition(shortcut = false, faction = Faction.Terrans) {
  const engine = position(faction);
  for (const hex of engine.map.grid.values()) {
    if (Math.max(Math.abs(hex.q), Math.abs(hex.r), Math.abs(hex.q + hex.r)) <= 6) hex.data.planet = Planet.Empty;
  }
  for (const [coords, kind] of [
    ["-3x0", Building.PlanetaryInstitute],
    ["3x0", Building.Academy1],
    ["0x3", Building.Mine],
    ...(shortcut ? [["0x0", Building.TradingStation]] : []),
  ] as [string, Building][]) {
    planet(engine, coords, Planet.Terra);
    building(engine, coords, kind);
  }
  return engine;
}

export function ivitsOpening() {
  const engine = position(Faction.Ivits);
  engine.round = 1;
  for (const hex of engine.map.grid.values()) {
    if (Math.max(Math.abs(hex.q), Math.abs(hex.r), Math.abs(hex.q + hex.r)) <= 3) hex.data.planet = Planet.Empty;
  }
  planet(engine, "0x0", Planet.Oxide);
  building(engine, "0x0", Building.PlanetaryInstitute);
  planet(engine, "2x0", Planet.Oxide);
  planet(engine, "2x-1", Planet.Terra);
  building(engine, "2x-1", Building.Mine, 1);
  const player = engine.players[0];
  player.data.credits = 15;
  player.data.ores = 5;
  player.data.knowledge = 4;
  player.data.qics = 2;
  player.data.power = new Power(0, 4, 1, 0);
  return engine;
}

export function serialise(engine: Engine): GameData {
  engine.generateAvailableCommandsIfNeeded();
  return copy(engine.toJSON());
}

export function settleCharges(engine: Engine, learner = 0) {
  for (let guard = 0; engine.phase === Phase.RoundLeech && guard < 20; guard++) {
    if (engine.playerToMove === learner) break;
    engine.move(`${engine.players[engine.playerToMove].faction} decline`);
  }
}

export function prepareBoosters(engine: Engine) {
  if (!engine.passedPlayers) engine.passedPlayers = [];
  for (const player of engine.players) {
    if (player.data.tiles.booster) continue;
    const booster = Object.keys(engine.tiles.boosters).find((id) => engine.tiles.boosters[id]) as Booster;
    engine.tiles.boosters[booster] = false;
    player.getRoundBooster(booster);
  }
}

export function setBoosters(engine: Engine, held: Booster[], available: Booster[]) {
  engine.tiles.boosters = {} as Engine["tiles"]["boosters"];
  for (const booster of available) engine.tiles.boosters[booster] = true;
  engine.players.forEach((player, index) => {
    player.removeRoundBoosterEvents();
    player.removeRoundBoosterEvents(Operator.Income);
    engine.tiles.boosters[held[index]] = false;
    player.getRoundBooster(held[index]);
    // These lessons start after income; only the next booster pays next round.
    player.removeRoundBoosterEvents(Operator.Income);
  });
}
