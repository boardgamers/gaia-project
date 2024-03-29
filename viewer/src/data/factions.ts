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
  terraformingStepsRequired,
} from "@gaia-project/engine";
import { FactionBoardRaw } from "@gaia-project/engine/src/faction-boards";
import { GAIA_FORMER_COST } from "@gaia-project/engine/src/faction-boards/types";
import { factionColor, planetFill } from "../graphics/utils";
import { allBuildings, buildingName } from "./building";

export const factionData: {
  [faction in Faction]: { name: string; ability: string; PI: string; shortcut: string; strategyLink?: string };
} = {
  [Faction.Terrans]: {
    name: "Terrans",
    ability:
      "During the Gaia phase, move the power tokens in your Gaia area to area II of your power cycle instead of to area I.",
    PI:
      "During the Gaia phase, when you move power tokens from your Gaia area to area II of your power cycle, you may gain resources as if you were spending that much power to take free actions.",
    shortcut: "t",
  },
  [Faction.Lantids]: {
    name: "Lantids",
    ability:
      "When you take the Build a Mine action, you may build a mine on a planet colonized by an opponent (including the Lost Planet). Place your mine next to the opponent’s structure. You do not have to pay for terraforming, but you must still pay the mine’s cost. This mine counts as a normal mine in all ways except the following: this mine cannot be upgraded, and it does not count for any effects that relate to how many planet types or Gaia planets you have colonized.",
    PI: "Each time you build a mine on a planet colonized by an opponent, gain two knowledge.",
    shortcut: "l",
    strategyLink: "https://drive.google.com/file/d/1gHzf_c1gszw-qOiy0wMpB4g00Oa2kiNm/preview",
  },
  [Faction.Xenos]: {
    name: "Xenos",
    ability: "You place a third starting mine after all other starting mines have been placed.",
    PI:
      "You can form federations with a total power value of six instead of seven. You gain one Q.I.C. as income instead of one power token.",
    shortcut: "x",
  },
  [Faction.Gleens]: {
    name: "Gleens",
    ability:
      "If you would ever gain Q.I.C., gain that much ore instead; once you have upgraded to the second academy, this effect no longer applies. To make a Gaia Planet habitable, pay one ore instead of one Q.I.C. Each time you build a mine on a Gaia Planet, gain two additional VP.",
    PI:
      "When you upgrade to the planetary institute, immediately gain the Gleens’ federation token (2 credits, 1 ore, 1 knowledge). Gaining this tile counts as forming a federation. The planetary institute itself can still be part of a federation on the board.",
    shortcut: "e",
    strategyLink: "https://drive.google.com/file/d/1Ka1DfeeLh4JgwRZX6eEZ1CPhuhF3NfOF/preview",
  },
  [Faction.Taklons]: {
    name: "Taklons",
    ability:
      "The Brainstone counts as one power token (when starting a Gaia Project, building satellites, etc.), but you can spend it as if it were three power.",
    PI:
      "Each time you would charge power from “Passive Action: Charge Power,” you gain one power token. You can choose to gain the power before or after charging.",
    shortcut: "k",
  },
  [Faction.Ambas]: {
    name: "Ambas",
    ability: "-",
    PI:
      "Once per round, as an action, you can swap your planetary institute with one of your mines on the game board (this can help you form a new federation). This has no impact on existing federations, even if their power value becomes less than seven. The swap does not count as a build or upgrade action; no VP or power can be gained from it.",
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
    PI:
      "The first time you build a mine on each planet type, gain 3 knowledge. (You do not gain knowledge for planet types you colonized before upgrading to your planetary institute.)",
    shortcut: "o",
    strategyLink: "https://drive.google.com/file/d/1MEww2mTrAXEIg4S7PjPxlolLsu588Wkg/preview",
  },
  [Faction.BalTaks]: {
    name: "Bal T'aks",
    ability: `You cannot advance in the “Navigation” research area, even if you take the tech tile below the “Navigation” research area. If you do take that tech tile, no advancement occurs.
    As a free action, you can move a Gaiaformer from a Gaiaformer space on your faction board to your Gaia area to gain one Q.I.C. Gaiaformers in your Gaia area are not available until the next Gaia phase. In the next Gaia phase, move any Gaiaformer in your Gaia area back to its Gaiaformer space.`,
    PI: "You can now advance in the “Navigation” research area.",
    shortcut: "'",
    strategyLink: "https://drive.google.com/file/d/1wAAlemgqxhqwsBPE1AZd82T7feqwRx9E/preview",
  },
  [Faction.Firaks]: {
    name: "Firaks",
    ability: "-",
    PI:
      "As an action, you can “downgrade” a research lab into a trading station and immediately advance one level in a research area of your choice. This counts as an “Upgrade to a Trading Station” action. You can later upgrade the trading station back into a research lab using the normal rules (including gaining a new tech tile).",
    shortcut: "f",
  },
  [Faction.Bescods]: {
    name: "Bescods",
    ability: `The positions of your planetary institute and academies are swapped on your faction board, as is the income you gain for trading stations and research labs. As with the other factions, upgrading to an academy or a research lab allows you to gain a tech tile.
    Once per round, as an action, you can advance your lowest-level token in a research area (without paying knowledge). If multiple of your tokens are tied for the lowest level, choose which of
    the tied tokens to advance. To advance to level 5 this way, you must still flip a federation token as normal. Remember, only one player can reach level 5 of each research area.`,
    PI:
      "The power value of your structures on gray planets (your home type) is increased by one (in addition to any other effects that increase their power value).",
    shortcut: "c",
    strategyLink: "https://drive.google.com/file/d/1wjMlRiS5T6g7t_YNOwEoHV-4AX3STOZy/preview",
  },
  [Faction.Nevlas]: {
    name: "Nevlas",
    ability:
      "As a free action, you can move one power token from area III of your power cycle to your Gaia area to gain one knowledge (these power tokens follow the normal Gaia phase rules). This does not count as spending power.",
    PI:
      "You can spend power tokens in area III of your power cycle as if they were each two power. Otherwise, they count as one power token (when starting a Gaia Project, building satellites, etc.). When paying for a power action with an odd power cost (1, 3, 5, etc.), the unspent power is lost.",
    shortcut: "n",
    strategyLink: "https://drive.google.com/file/d/1IohZgoB05UgybiP2SVkKKV19OPm-jq2v/preview",
  },
  [Faction.Itars]: {
    name: "Itars",
    ability:
      "Each time you discard a power token from area II of your power cycle to move another power token to area III, place the discarded power token in your Gaia area instead of returning it to the supply.",
    PI: `During the Gaia phase, you can discard 4 power tokens from your Gaia area to immediately gain a tech tile. You may do this as many times as you can afford to.`,
    shortcut: "s",
  },
};

export function planetsWithSteps(planet: Planet, steps: number) {
  // Planets are ordered the same as in the planet wheel
  let list = [Planet.Terra, Planet.Oxide, Planet.Volcanic, Planet.Desert, Planet.Swamp, Planet.Titanium, Planet.Ice];

  // Properly rearrange the list for wheel effect
  if (list.includes(planet)) {
    list = list.slice(list.lastIndexOf(planet)).concat(list.slice(0, list.indexOf(planet)));
  }

  return list.filter((p) => terraformingStepsRequired(planet, p) === steps);
}

export function factionShortcut(faction: Faction): string {
  return factionData[faction].shortcut;
}

function formatIncome(income: Event[]): string {
  return income.length == 0 ? "~" : income.join(", ");
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

export function factionDesc(faction: Faction, variant: FactionBoardRaw | null, expansion: Expansion) {
  const board = factionBoard(faction, variant);
  const p = factionPlanet(faction);

  const buildingDescription =
    "<ul>" +
    allBuildings(expansion, false)
      .map((bld) => `<li><b>${buildingName(bld, faction)}</b> - ${buildingDesc(bld, faction, board)}</li>`)
      .join("\n") +
    "</ul>";
  const startingIncome = board.income.filter((ev) => ev.operator === Operator.Once);
  const roundIncome = board.income.filter((ev) => ev.operator === Operator.Income);

  const data = factionData[faction];
  const strategy = data.strategyLink
    ? `<iframe sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox" src="${data.strategyLink}" width="640" height="480" allow="autoplay"></iframe>`
    : "";

  return `
  <div class="faction-desc" style="background-color: ${factionColor(faction)}; color: ${planetFill(
    factionPlanet(faction)
  )}; padding: 1rem">
    <b>Ability: </b> ${data.ability} </br>
    <b>Planetary Institute: </b> ${data.PI}<br/>
    <b>Buildings:</b> ${buildingDescription}
    <b>Starting Power:</b> area 1: ${board.power.area1}${
    board.brainstone == PowerArea.Area1 ? ", brainstone" : ""
  }, area 2: ${board.power.area2} </br>
    <b>Starting Income:</b> ${startingIncome.toString().replace(/,/g, ", ")} </br>
    <b>Round Income:</b> ${roundIncome} </br>
    <span style="white-space: nowrap; line-height: 1em">
      <b>Steps:</b>
      ${[0, 1, 2, 3]
        .map(
          (i) =>
            `<span class="ml-2">${planetsWithSteps(p, i)
              .map(
                (p) =>
                  `<svg width="15" height="20" viewbox="0 0 15 15" >
          <circle cx="7" cy="6" r="6"  class="player-token planet-fill ${p}" />
        </svg>`
              )
              .join("")} ${i}</span>`
        )
        .join("")}
    </span> </br>
    ${strategy}
  </div>
  `;
}

export function factionName(faction: Faction) {
  return factionData[faction].name;
}
