import type Engine from "../engine";
import {
  Booster,
  Building,
  Faction,
  FinalTile,
  Phase,
  Planet,
  ResearchField,
  Resource,
  ScoringTile,
  Spaceship,
} from "../enums";
import { nextFreeExplorationSlot } from "../exploration";
import { factionPlanet } from "../factions";
import { GaiaHex } from "../gaia-hex";
import { terraformingStepsRequired } from "../planets";
import type Player from "../player";
import Reward from "../reward";
import { spaceshipBoards } from "../spaceships";
import assert from "../utils/assert";
import { shuffle } from "../utils/shuffle";
import type { AutomaCard } from "./cards";
import { cards } from "./cards";

export const automaFactions = [
  Faction.Terrans,
  Faction.Xenos,
  Faction.Taklons,
  Faction.HadschHallas,
  Faction.Geodens,
  Faction.Firaks,
  Faction.Itars,
];
export const automaDifficulties = ["automalein", "automa", "automaechtig", "ultoma", "alptrauma"] as const;
export type AutomaDifficulty = (typeof automaDifficulties)[number];
export interface AutomaState {
  difficulty: AutomaDifficulty;
  round: number;
  /** Private; removed along with the independent shuffle seed before sending to a viewer. */
  deck?: string[];
  remaining: number;
  support?: string;
  action?: string;
  discard: string[];
  boosters: Booster[];
  lastActions: string[];
}

export function initAutoma(engine: Engine) {
  const difficulty = engine.options.automaDifficulty ?? "automa";
  assert(automaDifficulties.includes(difficulty), "Invalid Automa difficulty");
  assert(
    !engine.options.automaFaction || automaFactions.includes(engine.options.automaFaction),
    "Invalid Automa faction"
  );
  engine.automa = { difficulty, round: 0, remaining: 0, discard: [], boosters: [], lastActions: [] };
  // These multiplayer setup modes have no meaning with a single human and an Automa.
  engine.options.auction = undefined;
  engine.options.banPhase = false;
  engine.options.randomFactions = false;
  engine.options.concurrentCharges = false;
  engine.options.lostFleet2pQicTech = false;
  engine.options.creator = 0;
  engine.options.layout = "standard";
}

export function setupAutoma(engine: Engine, player: Player) {
  const startingResearch = {
    [Faction.Terrans]: ResearchField.GaiaProject,
    [Faction.Xenos]: ResearchField.Intelligence,
    [Faction.HadschHallas]: ResearchField.Economy,
    [Faction.Geodens]: ResearchField.Terraforming,
  };
  const field = startingResearch[player.faction];
  if (field) player.data.research[field] = 1;
  const level = engine.automa.difficulty;
  player.data.victoryPoints =
    level === "automalein"
      ? 0
      : engine.options.lostFleet
        ? {
            automa: 15,
            automaechtig: 20,
            ultoma: 25,
            alptrauma: 10,
          }[level]
        : 10;
  player.name = "Automa";
  if (engine.options.lostFleet) {
    const ship = shuffle(
      [Spaceship.Rebellion, Spaceship.Eclipse, Spaceship.TFMars],
      `${engine.moveHistory[0]}:automa-ship`
    )[0];
    player.data.explorationShips[ship] = nextFreeExplorationSlot(engine.players, ship);
  }
}

/** Reconstruct each round's deck without storing an ever-growing random stream. */
export function startAutomaRound(engine: Engine) {
  const state = engine.automa;
  if (!state) return;
  const starters = cards
    .filter((c) => c.starter && !(state.difficulty === "automalein" && c.id === "2"))
    .map((c) => c.id);
  if (["automaechtig", "ultoma", "alptrauma"].includes(state.difficulty)) starters.push("9");
  if (["ultoma", "alptrauma"].includes(state.difficulty)) starters.push("15");
  const reserve = cards
    .filter((c) => !starters.includes(c.id) && !(state.difficulty === "automalein" && c.id === "2"))
    .map((c) => c.id);
  state.round = engine.round;
  state.support = state.action = undefined;
  state.discard = [];
  state.remaining = starters.length + engine.round;
  if (engine.options.automaSeed) {
    const additions = shuffle(reserve, `${engine.options.automaSeed}:reserve`).slice(0, engine.round);
    state.deck = shuffle([...starters, ...additions], `${engine.options.automaSeed}:round:${engine.round}`);
  } else delete state.deck;
}

function card(id: string): AutomaCard {
  const found = cards.find((c) => c.id === id);
  assert(found, `Unknown Automa card ${id}`);
  return found;
}

function setupCard(engine: Engine): AutomaCard {
  return shuffle(cards, `${engine.moveHistory[0]}:automa-setup:${engine.moveHistory.length}`)[0];
}

export function nextAutomaMove(engine: Engine): string | undefined {
  if (!engine.automa || !engine.player(engine.playerToMove)?.isAutoma || engine.ended) return;
  const pl = engine.player(engine.playerToMove);
  const prefix = pl.faction ?? `p${pl.player + 1}`;
  switch (engine.phase) {
    case Phase.SetupFaction: {
      const available = automaFactions.filter((f) =>
        engine.setup.every((other) => factionPlanet(other) !== factionPlanet(f))
      );
      const faction = engine.options.automaFaction ?? shuffle(available, `${engine.moveHistory[0]}:automa-faction`)[0];
      assert(available.includes(faction), "The Automa needs a different faction colour");
      return `${prefix} faction ${faction}`;
    }
    case Phase.SetupBuilding: {
      const options = [...engine.map.grid.values()].filter((h) => !h.occupied() && h.data.planet === pl.planet);
      const chosen = selectHex(options, [(h) => distance(h, { q: 0, r: 0 })], setupCard(engine));
      assert(chosen, "No home planet for Automa setup");
      return `${prefix} build m ${chosen.toString()}`;
    }
    case Phase.SetupBooster: {
      const index = Number(setupCard(engine).initialRoundBoosterSelection.slice(-1)) - 1;
      return `${prefix} booster ${engine.automa.boosters[index]}`;
    }
    case Phase.RoundMove: {
      // A browser/simulation never has a future deck and must never invent Automa draws.
      if (!engine.automa.deck) return;
      const count = engine.automa.action ? 1 : 2;
      return `${prefix} automa ${engine.automa.deck.slice(0, count).join(",") || "pass"}`;
    }
  }
}

function distance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
}
function nearest(hex: GaiaHex, others: GaiaHex[]): number {
  return others.length ? Math.min(...others.map((other) => distance(hex, other))) : 0;
}
function selectHex(
  options: GaiaHex[],
  criteria: Array<(hex: GaiaHex) => number>,
  support: AutomaCard
): GaiaHex | undefined {
  // Rotate the board to the solo rulebook's horizontal rows. Read forward, or in reverse.
  const sign = support.directionalSelection === "right-down" ? 1 : -1;
  const order = [...criteria, (h) => sign * -h.q, (h) => sign * (h.q + 2 * h.r)];
  return options.slice().sort((a, b) => {
    for (const value of order) {
      const diff = value(a) - value(b);
      if (diff) return diff;
    }
    return 0;
  })[0];
}
function numbered<T>(options: T[], support: AutomaCard): T | undefined {
  if (!options.length) return;
  const ordered = support.numberedSelection === "right" ? options : options.slice().reverse();
  return ordered[(support.numberedSelectionCount - 1) % ordered.length];
}
function award(engine: Engine, points: number, source: "automa" | Faction = "automa") {
  if (points <= 0) return;
  const extra = engine.automa.difficulty === "alptrauma" ? 1 : 0;
  engine.players[1].gainRewards([new Reward(points + extra, Resource.VictoryPoint)], source);
}

export function placeAutomaBuilding(engine: Engine, hex: GaiaHex, building: Building) {
  const pl = engine.players[1];
  const old = hex.data.building;
  const oldTypes = new Set(pl.ownedPlanets.map((h) => h.data.planet));
  if (old) pl.data.buildings[old]--;
  else {
    if (engine.round > 0 && !pl.ownedPlanets.some((h) => distance(h, hex) === 1)) pl.data.satellites++;
    pl.data.occupied.push(hex);
  }
  if (hex.data.planet === Planet.Transdim) hex.data.planet = Planet.Gaia;
  hex.data.player = pl.player;
  hex.data.building = building;
  pl.data.buildings[building]++;
  engine.players.forEach((p) => {
    p.federationCache = null;
  });
  if (engine.phase === Phase.RoundMove) {
    engine.leechSources.push({ player: pl.player, coordinates: hex.toString() });
    engine.automa.lastActions.push(`build ${building} ${hex.toString()}`);
    if (pl.faction === Faction.Geodens && !oldTypes.has(hex.data.planet)) award(engine, 2, pl.faction);
    if (pl.faction === Faction.HadschHallas && building === Building.TradingStation) award(engine, 3, pl.faction);
    if (pl.faction === Faction.Firaks && building === Building.ResearchLab)
      research(engine, card(engine.automa.support));
  }
}

function mine(
  engine: Engine,
  support: AutomaCard,
  range = support.range,
  factionAction = false,
  fallback = true
): boolean {
  const pl = engine.players[1];
  const human = engine.players[0];
  const owned = pl.ownedPlanets;
  const planets = [...engine.map.grid.values()].filter((h) => h.hasPlanet() && !h.occupied());
  const possible =
    pl.data.buildings[Building.Mine] < pl.maxBuildings(Building.Mine)
      ? planets.filter((h) => nearest(h, owned) <= range)
      : [];
  const criteria: Array<(h: GaiaHex) => number> = [];
  if (factionAction && pl.faction === Faction.Terrans)
    criteria.push((h) => (h.data.planet === Planet.Transdim ? 0 : 1));
  if (factionAction && pl.faction === Faction.Taklons) criteria.push((h) => nearest(h, human.ownedPlanets));
  const tile =
    support.scoringFinalTiebreaker === "none"
      ? undefined
      : engine.tiles.scorings.final[support.scoringFinalTiebreaker === "top" ? 0 : 1];
  const sector = (h: GaiaHex) => h.data.sector.split("_")[0];
  const sectors = new Set(owned.map(sector));
  const types = new Set(owned.map((h) => h.data.planet));
  const deep = (h: GaiaHex) => h.data.sector.startsWith("DS");
  switch (tile) {
    case FinalTile.Sector:
      criteria.push((h) =>
        !deep(h) && !h.hasSpaceship() && !h.data.sector.startsWith("IS") && !sectors.has(sector(h)) ? 0 : 1
      );
      break;
    case FinalTile.PlanetType:
      criteria.push((h) => (types.has(h.data.planet === Planet.Transdim ? Planet.Gaia : h.data.planet) ? 1 : 0));
      break;
    case FinalTile.Gaia:
      criteria.push((h) => ([Planet.Gaia, Planet.Transdim].includes(h.data.planet) ? 0 : 1));
      break;
    case FinalTile.Asteroid:
      criteria.push(
        (h) => (h.data.planet === Planet.Asteroid ? 0 : 1),
        (h) =>
          nearest(
            h,
            planets.filter((p) => p.data.planet === Planet.Asteroid)
          )
      );
      break;
    case FinalTile.DeepSpaceSector:
      criteria.push(
        (h) => (deep(h) && !sectors.has(sector(h)) ? 0 : 1),
        (h) =>
          nearest(
            h,
            planets.filter((p) => deep(p) && !sectors.has(sector(p)))
          )
      );
      break;
  }
  criteria.push((h) =>
    h.data.planet === Planet.Gaia
      ? 1
      : [Planet.Transdim, Planet.Asteroid].includes(h.data.planet)
        ? 2
        : terraformingStepsRequired(pl.faction, h.data.planet)
  );
  criteria.push((h) => nearest(h, human.ownedPlanets));
  const chosen = selectHex(possible, criteria, support);
  if (!chosen) return fallback && upgrade(engine, support, false, false);
  placeAutomaBuilding(engine, chosen, Building.Mine);
  return true;
}

function upgrade(engine: Engine, support: AutomaCard, firaks = false, hadschFallback = false): boolean {
  const pl = engine.players[1];
  const priorities: Array<[Building, Building]> = [[Building.TradingStation, Building.PlanetaryInstitute]];
  if (firaks) priorities.push([Building.ResearchLab, Building.TradingStation]);
  priorities.push(
    [Building.Mine, Building.TradingStation],
    [Building.ResearchLab, Building.Academy1],
    [Building.ResearchLab, Building.Academy2],
    [Building.TradingStation, Building.ResearchLab]
  );
  for (const [from, to] of priorities) {
    if (pl.data.buildings[to] >= pl.maxBuildings(to)) continue;
    const candidates = pl.ownedPlanets.filter((h) => h.data.building === from);
    const criteria: Array<(h: GaiaHex) => number> = [];
    const pi = pl.ownedPlanets.find((h) => h.data.building === Building.PlanetaryInstitute);
    if (
      engine.tiles.scorings.final.includes(FinalTile.PlanetaryInstituteAcademyDistance) &&
      pi &&
      (to === Building.ResearchLab ||
        (from === Building.Mine && !pl.data.buildings[Building.Academy1] && !pl.data.buildings[Building.Academy2]))
    ) {
      criteria.push((h) => -distance(h, pi));
    }
    criteria.push((h) => nearest(h, engine.players[0].ownedPlanets));
    const chosen = selectHex(candidates, criteria, support);
    if (chosen) {
      placeAutomaBuilding(engine, chosen, to);
      return true;
    }
  }
  return hadschFallback && mine(engine, support, 3, false, false);
}

function research(engine: Engine, support: AutomaCard, highest = false, fixed?: ResearchField) {
  const pl = engine.players[1];
  let fields = (fixed ? [fixed] : ResearchField.values(engine.expansions)).filter((field) => {
    const level = pl.data.research[field];
    return (
      level < 5 &&
      (level < 4 ||
        engine.tiles.techs[`adv-${field}`]?.count > 0 ||
        !engine.players.some((p) => p.data.research[field] === 5))
    );
  });
  if (highest && fields.length) {
    const level = Math.max(...fields.map((f) => pl.data.research[f]));
    fields = fields.filter((f) => pl.data.research[f] === level);
  }
  const field = numbered(fields, support);
  if (!field) return;
  const tile = engine.tiles.techs[`adv-${field}`];
  if (pl.data.research[field] === 4 && tile?.count > 0) {
    tile.count = 0;
    engine.automa.lastActions.push(`remove adv-${field}`);
  } else {
    pl.data.research[field]++;
    engine.automa.lastActions.push(`up ${field}`);
    if (field === ResearchField.Terraforming && pl.data.research[field] === 5)
      engine.terraformingFederation = undefined;
  }
}

function power(engine: Engine, support: AutomaCard) {
  const pl = engine.players[1];
  const options: Array<() => void> = engine.boardActionTypes
    .filter((action) => engine.boardActions[action] === null || engine.boardActions[action] === undefined)
    .map((action) => () => {
      engine.boardActions[action] = pl.player;
      engine.automa.lastActions.push(`block ${action}`);
    });
  if (engine.options.lostFleet) {
    for (const ship of [Spaceship.Rebellion, Spaceship.Eclipse, Spaceship.TFMars]) {
      if (pl.data.explorationShips[ship] === undefined) {
        options.push(() => {
          pl.data.explorationShips[ship] = nextFreeExplorationSlot(engine.players, ship);
          engine.automa.lastActions.push(`explore ${ship}`);
        });
      } else {
        const actions = spaceshipBoards[ship].actions;
        actions.forEach((action, i) => {
          const key = action.type;
          if (engine.spaceshipActions[ship]?.[key] !== undefined) return;
          options.push(() => {
            engine.spaceshipActions[ship] = { ...engine.spaceshipActions[ship], [key]: pl.player };
            const left = actions[i - 1];
            if (left && engine.spaceshipActions[ship][left.type] === undefined)
              engine.spaceshipActions[ship][left.type] = pl.player;
            engine.automa.lastActions.push(`block ${ship} ${action.type}`);
          });
        });
      }
    }
  }
  numbered(options, support)?.();
}

const passPoints: Record<ScoringTile, [number, number]> = {
  score1: [4, 6],
  score2: [2, 4],
  score3: [4, 6],
  score4: [0, 5],
  score5: [3, 6],
  score6: [2, 2],
  score7: [0, 5],
  score8: [3, 6],
  score9: [2, 2],
  score10: [0, 5],
  lflab4: [4, 8],
  lfsector3: [3, 6],
  lfplanet3: [4, 6],
};

/** Execute recorded, revealed cards. Public replays need no private shuffle seed. */
export function playAutomaTurn(engine: Engine, move: string): boolean {
  const state = engine.automa;
  const match = /^(?:p2|\S+) automa (pass|[0-9]+(?:,[0-9]+)?)(?: \[.*\])?$/.exec(move.trim());
  assert(
    match && (move.startsWith("p2 ") || move.startsWith(`${engine.players[1].faction} `)),
    "Expected an Automa turn"
  );
  const drawn = match[1] === "pass" ? [] : match[1].split(",");
  const count = Math.min(state.remaining, state.action ? 1 : 2);
  assert(drawn.length === count, "Wrong number of Automa cards");
  if (state.deck) {
    assert(drawn.join(",") === state.deck.slice(0, count).join(","), "Unexpected Automa draw");
    state.deck.splice(0, count);
  }
  drawn.forEach(card);
  if (state.support) state.discard.push(state.support);
  state.support = state.action ?? drawn.shift();
  state.action = drawn.shift();
  state.remaining -= count;
  state.lastActions = [];
  const support = card(state.support);
  const action = state.action && card(state.action);
  const pass = !action || (action.pass && state.remaining < 3);
  if (pass) {
    award(engine, passPoints[engine.tiles.scorings.round[engine.round - 1]][engine.round > 3 ? 1 : 0]);
    const pl = engine.players[1];
    const old = pl.data.tiles.booster;
    if (!engine.isLastRound) {
      const i = { left: 0, middle: 1, right: 2 }[support.roundBoosterSelection];
      const booster = state.boosters.splice(i, 1)[0];
      assert(booster && engine.tiles.boosters[booster], "Automa booster unavailable");
      engine.tiles.boosters[booster] = false;
      pl.getRoundBooster(booster);
      state.lastActions.push(`pass ${booster}`);
    } else {
      pl.data.tiles.booster = undefined;
      state.lastActions.push("pass");
    }
    engine.tiles.boosters[old] = true;
    state.boosters.push(old);
    engine.passedPlayers.push(pl.player);
    engine.turnOrder.splice(engine.turnOrder.indexOf(pl.player), 1);
    return true;
  }
  switch (action.action) {
    case "build-mine":
      mine(engine, support);
      break;
    case "upgrade":
      upgrade(engine, support);
      break;
    case "research-area-highest":
      research(engine, support, true);
      break;
    case "research-area-random":
      research(engine, support);
      break;
    case "power-qic":
      power(engine, support);
      if (engine.players[1].faction === Faction.Xenos) power(engine, support);
      break;
    case "faction": {
      const faction = engine.players[1].faction;
      switch (faction) {
        case Faction.Terrans:
          research(engine, support, false, ResearchField.GaiaProject);
          mine(engine, support, 4, true);
          break;
        case Faction.Xenos:
          mine(engine, support, 2, true);
          power(engine, support);
          break;
        case Faction.Taklons:
          mine(engine, support, 3, true);
          power(engine, support);
          break;
        case Faction.HadschHallas:
          upgrade(engine, support, false, true);
          break;
        case Faction.Geodens:
          research(engine, support);
          power(engine, support);
          break;
        case Faction.Firaks:
          upgrade(engine, support, true);
          break;
        case Faction.Itars:
          power(engine, support);
          power(engine, support);
          break;
      }
      award(
        engine,
        faction === Faction.Itars ? 4 : [Faction.HadschHallas, Faction.Geodens].includes(faction) ? 1 : 2,
        faction
      );
      return false;
    }
  }
  award(engine, action.victoryPoints);
  return false;
}
