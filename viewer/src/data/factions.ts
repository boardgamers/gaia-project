import {
  Building,
  Event,
  Expansion,
  Faction,
  FactionBoard,
  factionBoard,
  factionPlanet,
  isShip,
  Operator,
  Planet,
  Player,
  PowerArea,
  Reward,
  terraformingStepsRequired,
} from "@gaia-project/engine";
import type { FactionBoardRaw } from "@gaia-project/engine/src/faction-boards";
import { GAIA_FORMER_COST } from "@gaia-project/engine/src/faction-boards/types";
import { factionColor, factionPiecePlanet, planetFill } from "../graphics/utils";
import { buildingName } from "./building";

export const factionData: {
  [faction in Faction]: { name: string; ability: string; PI: string; shortcut: string; strategyLink?: string };
} = {
  [Faction.Terrans]: {
    name: "Terrans",
    ability:
      "During the Gaia phase, move the power tokens in your Gaia area to area II of your power cycle instead of to area I.",
    PI: "During the Gaia phase, when you move power tokens from your Gaia area to area II of your power cycle, you may gain resources as if you were spending that much power to take free actions.",
    shortcut: "t",
  },
  [Faction.Lantids]: {
    name: "Lantids",
    ability:
      "When you take the Build a Mine action, you may build a mine on a planet colonized by an opponent (including the Lost Planet). Place your mine next to the opponent’s structure. You do not have to pay for terraforming, but you must still pay the mine’s cost. This mine counts as a normal mine in all ways except the following: this mine cannot be upgraded, and it does not count for any effects that relate to how many planet types or Gaia planets you have colonized.",
    PI: "Each time you build a mine on a planet colonized by an opponent, gain two knowledge.",
    shortcut: "l",
    // strategyLink: "https://drive.google.com/file/d/1gHzf_c1gszw-qOiy0wMpB4g00Oa2kiNm/preview",
  },
  [Faction.Xenos]: {
    name: "Xenos",
    ability: "You place a third starting mine after all other starting mines have been placed.",
    PI: "You can form federations with a total power value of six instead of seven. You gain one Q.I.C. as income instead of one power token.",
    shortcut: "x",
  },
  [Faction.Gleens]: {
    name: "Gleens",
    ability:
      "If you would ever gain Q.I.C., gain that much ore instead; once you have upgraded to the second academy, this effect no longer applies. To make a Gaia Planet habitable, pay one ore instead of one Q.I.C. Each time you build a mine on a Gaia Planet, gain two additional VP.",
    PI: "When you upgrade to the planetary institute, immediately gain the Gleens’ federation token (2 credits, 1 ore, 1 knowledge). Gaining this tile counts as forming a federation. The planetary institute itself can still be part of a federation on the board.",
    shortcut: "e",
    // strategyLink: "https://drive.google.com/file/d/1Ka1DfeeLh4JgwRZX6eEZ1CPhuhF3NfOF/preview",
  },
  [Faction.Taklons]: {
    name: "Taklons",
    ability:
      "The Brainstone counts as one power token (when starting a Gaia Project, building satellites, etc.), but you can spend it as if it were three power.",
    PI: "Each time you would charge power from “Passive Action: Charge Power,” you gain one power token. You can choose to gain the power before or after charging.",
    shortcut: "k",
  },
  [Faction.Ambas]: {
    name: "Ambas",
    ability: "-",
    PI: "Once per round, as an action, you can swap your planetary institute with one of your mines on the game board (this can help you form a new federation). This has no impact on existing federations, even if their power value becomes less than seven. The swap does not count as a build or upgrade action; no VP or power can be gained from it.",
    shortcut: "a",
  },
  [Faction.HadschHallas]: {
    name: "Hadsch Hallas",
    ability: "-",
    PI: "You can spend credits instead of power to take free actions that allow you to gain resources.",
    shortcut: "d",
  },
  [Faction.Ivits]: {
    name: "Ivits",
    ability: `During setup, do not place mines. Instead, after all other players have placed mines (including the Xenos’ third mine), place your planetary institute on any red planet.
    You can have only one federation during the whole game, but unlike other factions, you will be able to grow that federation to gain new federation tokens. After you have formed a federation,
    to take the “Form a Federation” action again, you must connect planets to that federation instead of forming a new federation. The power values of the structures on those planets must bring the total power value of that federation to at least to 7X, where X is the number of federation tokens you own plus one (not including the federation token from level 5 of “Terraforming”). All other rules for forming a federation apply, including building satellites and gaining federation tokens. To build a satellite during this action, you must spend one Q.I.C. instead of discarding one power.`,
    PI: `As a special action, place a space station on an accessible space that does not contain a planet or another space station.
    The accessibility of a space follows the same rules as the “Build a Mine” action. Like planets, a space station can
    be connected with satellites; each space station counts as having a power value of one for its federation.
    A space station is not a structure, so placing one does not allow opponents to charge power. A space station does not count as a colonized planet,
    but it can be used as a “starting point” when determining the accessibility of a planet (i.e., range can be counted from a space station).
    Your opponents can place satellites in a space containing a space station.`,
    shortcut: "v",
  },
  [Faction.Geodens]: {
    name: "Geoden",
    ability: "-",
    PI: "The first time you build a mine on each planet type, gain 3 knowledge. (You do not gain knowledge for planet types you colonized before upgrading to your planetary institute.)",
    shortcut: "o",
    // strategyLink: "https://drive.google.com/file/d/1MEww2mTrAXEIg4S7PjPxlolLsu588Wkg/preview",
  },
  [Faction.BalTaks]: {
    name: "Bal T'aks",
    ability: `You cannot advance in the “Navigation” research area, even if you take the tech tile below the “Navigation” research area. If you do take that tech tile, no advancement occurs.
    As a free action, you can move a Gaiaformer from a Gaiaformer space on your faction board to your Gaia area to gain one Q.I.C. Gaiaformers in your Gaia area are not available until the next Gaia phase. In the next Gaia phase, move any Gaiaformer in your Gaia area back to its Gaiaformer space.`,
    PI: "You can now advance in the “Navigation” research area.",
    shortcut: "'",
    // strategyLink: "https://drive.google.com/file/d/1wAAlemgqxhqwsBPE1AZd82T7feqwRx9E/preview",
  },
  [Faction.Firaks]: {
    name: "Firaks",
    ability: "-",
    PI: "As an action, you can “downgrade” a research lab into a trading station and immediately advance one level in a research area of your choice. This counts as an “Upgrade to a Trading Station” action. You can later upgrade the trading station back into a research lab using the normal rules (including gaining a new tech tile).",
    shortcut: "f",
  },
  [Faction.Bescods]: {
    name: "Bescods",
    ability: `The positions of your planetary institute and academies are swapped on your faction board, as is the income you gain for trading stations and research labs. As with the other factions, upgrading to an academy or a research lab allows you to gain a tech tile.
    Once per round, as an action, you can advance your lowest-level token in a research area (without paying knowledge). If multiple of your tokens are tied for the lowest level, choose which of
    the tied tokens to advance. To advance to level 5 this way, you must still flip a federation token as normal. Remember, only one player can reach level 5 of each research area.`,
    PI: "The power value of your structures on gray planets (your home type) is increased by one (in addition to any other effects that increase their power value).",
    shortcut: "c",
    // strategyLink: "https://drive.google.com/file/d/1wjMlRiS5T6g7t_YNOwEoHV-4AX3STOZy/preview",
  },
  [Faction.Nevlas]: {
    name: "Nevlas",
    ability:
      "As a free action, you can move one power token from area III of your power cycle to your Gaia area to gain one knowledge (these power tokens follow the normal Gaia phase rules). This does not count as spending power.",
    PI: "You can spend power tokens in area III of your power cycle as if they were each two power. Otherwise, they count as one power token (when starting a Gaia Project, building satellites, etc.). When paying for a power action with an odd power cost (1, 3, 5, etc.), the unspent power is lost.",
    shortcut: "n",
    // strategyLink: "https://drive.google.com/file/d/1IohZgoB05UgybiP2SVkKKV19OPm-jq2v/preview",
  },
  [Faction.Itars]: {
    name: "Itars",
    ability:
      "Each time you discard a power token from area II of your power cycle to move another power token to area III, place the discarded power token in your Gaia area instead of returning it to the supply.",
    PI: `During the Gaia phase, you can discard 4 power tokens from your Gaia area to immediately gain a tech tile. You may do this as many times as you can afford to.`,
    shortcut: "s",
  },
  [Faction.Tinkeroids]: {
    name: "Tinkeroids",
    ability:
      "You have no home planet type. Start with your Planetary Institute instead of two mines. Three base-game planet colors cost 3 terraforming steps and the others cost 1, determined from the Lost Fleet Terraforming board during setup. Building a mine on a Gaia Planet costs the normal one Q.I.C.",
    PI: "At the beginning of each round, choose the current round's unused Tinkering tile. Once that round, use it as an action. Rounds 1-3: terraform 1 step, charge 4 power, or gain 1 Q.I.C. Rounds 4-6: terraform 3 steps, gain 3 knowledge, or gain 2 Q.I.C.",
    shortcut: "y",
  },
  [Faction.Darkanians]: {
    name: "Darkanians",
    ability:
      "You have no home planet type. Start with one mine instead of two. Terraforming any standard planet always costs one step, regardless of color. Building a mine on a Gaia Planet costs two Q.I.C. instead of one.",
    PI: "The first time you colonize a planet in a Space or Deep Space sector, gain two credits and one knowledge. (Interspace tiles do not count as sectors for this effect.)",
    shortcut: "i",
  },
  [Faction.Moweyds]: {
    name: "Moweyds",
    ability:
      "You have no home planet type. Start with one mine instead of two, and start the game with an Exploration Shuttle already on T F Mars. Three base-game planet colors cost 3 terraforming steps and the others cost 1, determined from the Lost Fleet Terraforming board during setup. Building a mine on a Gaia Planet costs the normal one Q.I.C.",
    PI: "Once per round, place a Power Ring as an action on a planet containing one of your buildings and no Power Ring. That building's power value is increased by 2.",
    shortcut: "m",
  },
  [Faction.SpaceGiants]: {
    name: "Space Giants",
    ability:
      "You have no home planet type. Start with one mine instead of two. Terraforming any standard planet always costs two steps, regardless of color. Building a mine on a Gaia Planet costs two Q.I.C. instead of one.",
    PI: "Immediately take one tech tile of your choice (normal upgrade restrictions apply). This can only be done once.",
    shortcut: "g",
  },
};

export function planetsWithSteps(faction: Faction, steps: number, cost3Planets: Planet[] = []) {
  const planet = factionPlanet(faction);
  // Planets are ordered the same as in the planet wheel
  let list = [Planet.Terra, Planet.Oxide, Planet.Volcanic, Planet.Desert, Planet.Swamp, Planet.Titanium, Planet.Ice];

  // Properly rearrange the list for wheel effect
  if (list.includes(planet)) {
    list = list.slice(list.lastIndexOf(planet)).concat(list.slice(0, list.indexOf(planet)));
  }

  return list.filter((p) => terraformingStepsRequired(faction, p, cost3Planets) === steps);
}

export function factionShortcut(faction: Faction): string {
  return factionData[faction].shortcut;
}

function formatIncome(income: Event[]): string {
  return income.length == 0 ? "~" : income.join(", ");
}

function buildingStockCount(building: Building): number {
  switch (building) {
    case Building.Mine:
      return 8;
    case Building.TradingStation:
      return 4;
    case Building.ResearchLab:
      return 3;
    case Building.PlanetaryInstitute:
      return 1;
    case Building.Academy1:
    case Building.Academy2:
      return 1;
    case Building.GaiaFormer:
      return 3;
    default:
      return 0;
  }
}

function lostFleetNotes(faction: Faction, expansion: Expansion): string[] {
  if ((expansion & Expansion.LostFleet) === 0) {
    return [];
  }

  switch (faction) {
    case Faction.Xenos:
      return ["Lost Fleet adds a free action: spend 1 ore to gain 1 power directly into Area III."];
    case Faction.Gleens:
      return ["Lost Fleet adds a special action that grants +2 range, including for Explore."];
    case Faction.Tinkeroids:
      return ["Starts with the Planetary Institute already built instead of two mines."];
    case Faction.Darkanians:
      return ["Starts with one mine instead of two, and standard planets always terraform in 1 step."];
    case Faction.Moweyds:
      return ["Starts with one mine and an Exploration Shuttle already on T F Mars."];
    case Faction.SpaceGiants:
      return ["Starts with one mine instead of two, and standard planets always terraform in 2 steps."];
    default:
      return [];
  }
}

export function buildingDesc(b: Building, faction: Faction, board: FactionBoard, player?: Player) {
  const cost = board.buildings[b].cost;
  const income = " -> " + board.buildings[b].income.map((i) => formatIncome(i)).join(" / ");
  return (
    (player && b === Building.GaiaFormer
      ? cost.toString().replace(String(GAIA_FORMER_COST), String(GAIA_FORMER_COST - player.data.gaiaFormingDiscount()))
      : cost) + (b === Building.GaiaFormer || isShip(b) ? "" : income)
  );
}

export const FACTION_INFO_BUILDINGS = [
  Building.Mine,
  Building.TradingStation,
  Building.ResearchLab,
  Building.Academy1,
  Building.Academy2,
  Building.PlanetaryInstitute,
];

export type FactionInfoBuilding = {
  building: Building;
  name: string;
  stock: number;
  cost: Reward[];
  income: Event[][];
};

export type FactionInfoData = {
  faction: Faction;
  name: string;
  color: string;
  textColor: string;
  startingResources: Reward[];
  power: { area1: number; area2: number; brainstone: boolean };
  roundIncome: Reward[];
  buildings: FactionInfoBuilding[];
  lostFleetChanges: string[];
  ability: string;
  pi: string;
};

/** Structured faction-info data (starting resources, round income, board, abilities) for
 * `FactionInfoCard.vue` to render with real icon components - the data-only successor to the old
 * HTML-string `factionDesc()`. Drops nothing that the old popup showed. */
export function factionInfoData(
  faction: Faction,
  variant: FactionBoardRaw | null,
  expansion: Expansion
): FactionInfoData {
  const board = factionBoard(faction, variant);
  const data = factionData[faction];

  return {
    faction,
    name: data.name,
    color: factionColor(faction),
    textColor: planetFill(factionPiecePlanet(faction)),
    startingResources: board.income.filter((ev) => ev.operator === Operator.Once).flatMap((ev) => ev.rewards),
    power: { area1: board.power.area1, area2: board.power.area2, brainstone: board.brainstone === PowerArea.Area1 },
    roundIncome: board.income.filter((ev) => ev.operator === Operator.Income).flatMap((ev) => ev.rewards),
    buildings: FACTION_INFO_BUILDINGS.map((building) => ({
      building,
      name: buildingName(building, faction),
      stock: buildingStockCount(building),
      cost: board.buildings[building].cost,
      income: board.buildings[building].income,
    })),
    lostFleetChanges: lostFleetNotes(faction, expansion),
    ability: data.ability,
    pi: data.PI,
  };
}

export function factionName(faction: Faction) {
  return factionData[faction].name;
}
