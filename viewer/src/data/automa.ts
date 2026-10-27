import type Engine from "@gaia-project/engine";
import type { Player } from "@gaia-project/engine";
import { cards } from "@gaia-project/engine/src/automa/cards";
import { FinalTile } from "@gaia-project/engine/src/enums";
import { boardActionData } from "./actions";
import { buildingData } from "./building";
import { researchData } from "./research";
import { spaceshipNames } from "./spaceships";

const miningPreferences = {
  [FinalTile.Sector]: "a sector without an Automa planet",
  [FinalTile.PlanetType]: "a planet type Automa has not colonized",
  [FinalTile.Gaia]: "a Gaia or Transdim planet",
  [FinalTile.Asteroid]: "an asteroid, or a planet closest to an asteroid",
  [FinalTile.DeepSpaceSector]: "a deep-space sector without an Automa planet, or a planet closest to one",
};

function automaMiningPreference(engine: Engine) {
  const support = cards.find((card) => card.id === engine.automa?.support);
  if (!support || support.scoringFinalTiebreaker === "none") return undefined;
  const tile = engine.tiles.scorings.final[support.scoringFinalTiebreaker === "top" ? 0 : 1];
  return miningPreferences[tile];
}

export function automaSupportUsage(engine: Engine, player: Player) {
  const state = engine.automa;
  const action = cards.find((card) => card.id === state?.action)?.action;
  const moves = state?.lastActions ?? [];
  const pass = moves.some((move) => move.startsWith("pass"));
  const mine = moves.some((move) => move.startsWith("build m "));
  return {
    pass,
    range: !pass && action === "build-mine",
    scoring: !pass && mine && !!automaMiningPreference(engine),
    direction: !pass && moves.some((move) => move.startsWith("build ")),
    numbered:
      !pass &&
      moves.some(
        (move) =>
          /^(block|explore|remove|up) /.test(move) &&
          !(action === "faction" && player.faction === "terrans" && move === "up gaia")
      ),
  };
}

export function automaSupportDescriptions(engine: Engine, player: Player) {
  const support = cards.find((card) => card.id === engine.automa?.support);
  if (!support) return {};
  const usage = automaSupportUsage(engine, player);
  const preference = automaMiningPreference(engine);
  const descriptions = {
    range: `Range ${support.range} when placing mines with a Build a Mine card. The mine must be within ${support.range} spaces of an Automa planet. Faction actions can specify a different range.`,
    scoring:
      support.scoringFinalTiebreaker === "none"
        ? "No final-scoring preference on this support card. Use the other mine-placement tiebreakers."
        : preference
          ? `When placing a mine, the ${support.scoringFinalTiebreaker} final-scoring tile gives this preference: ${preference}. Apply it before comparing terraforming steps and distance from your planets.`
          : `The ${support.scoringFinalTiebreaker} final-scoring tile does not add a mine-placement tiebreaker. Use the other placement rules.`,
    direction: `If planet choices remain tied, scan the map ${support.directionalSelection === "right-down" ? "from top left to bottom right" : "from bottom right to top left"}, row by row. Choose the first eligible planet.`,
    numbered: `Choose option ${support.numberedSelectionCount}, counting from the ${support.numberedSelection === "right" ? "left" : "right"}. Skip unavailable options and wrap around if necessary. This selects research tracks and power/Q.I.C. actions, including spaceship choices in Lost Fleet.`,
    booster: engine.isLastRound
      ? "Last round: Automa passes without taking another booster."
      : `When passing, take the ${support.roundBoosterSelection} booster from Automa's ordered row of three available boosters.`,
  };
  return Object.fromEntries(
    Object.entries(descriptions).map(([kind, description]) => [
      kind,
      `${description} ${usage[kind === "booster" ? "pass" : kind] ? "Relevant to the last action." : "Not used for the last action."}`,
    ])
  );
}

export function describeAutomaAction(action: string): string {
  const [command, target] = action.split(" ");
  switch (command) {
    case "build":
      return `${buildingData[target]?.name ?? "Structure"} built`;
    case "up":
      return `Advanced ${researchData[target]?.name ?? "research"}`;
    case "remove":
      return `Removed the advanced tech tile on ${researchData[target.replace("adv-", "")]?.name ?? "research"}`;
    case "block":
      return spaceshipNames[target]
        ? `Blocked an action on ${spaceshipNames[target]}`
        : `Blocked the ${boardActionData[target]?.name ?? "power / Q.I.C."} action`;
    case "explore":
      return `Explored ${spaceshipNames[target] ?? "a spaceship"}`;
    case "pass":
      return "Passed";
    default:
      return "Action resolved";
  }
}

export type AutomaIcon = {
  kind:
    | "vp"
    | "block"
    | "board-action"
    | "research"
    | "gaia-research"
    | "mine"
    | "upgrade"
    | "down-lab"
    | "ts"
    | "lab"
    | "newplanet";
  count?: number;
};

export function automaFactionAction(faction: string): AutomaIcon[] {
  const mine = (range: number): AutomaIcon => ({ kind: "mine", count: range });
  const vp = (count: number): AutomaIcon => ({ kind: "vp", count });
  const block: AutomaIcon = { kind: "block" };
  const research: AutomaIcon = { kind: "research" };
  const upgrade: AutomaIcon = { kind: "upgrade" };
  const actions: Record<string, AutomaIcon[]> = {
    terrans: [{ kind: "gaia-research" }, mine(4), vp(2)],
    xenos: [mine(2), block, vp(2)],
    taklons: [mine(3), block, vp(2)],
    "hadsch-hallas": [upgrade, mine(3), vp(1)],
    geodens: [research, block, vp(1)],
    firaks: [upgrade, { kind: "down-lab" }, vp(2)],
    itars: [block, block, vp(4)],
  };
  return actions[faction];
}

export const automaAbilities = {
  terrans:
    "Faction action: advance Gaia Project, then build a mine with range 4, preferring Transdim planets. Gain 2 VP.",
  xenos:
    "Faction action: build a mine with range 2, block one power/Q.I.C. action, gain 2 VP. Other power/Q.I.C. cards block two actions.",
  taklons:
    "Faction action: build a mine with range 3, preferring the closest planet to you. Block one power/Q.I.C. action and gain 2 VP.",
  "hadsch-hallas":
    "Faction action: upgrade, or build a mine with range 3 if no upgrade is possible. Gain 1 VP. Each Trading Station upgrade also scores 3 VP.",
  geodens:
    "Faction action: advance research, block one power/Q.I.C. action, gain 1 VP. Each new planet type also scores 2 VP.",
  firaks:
    "Faction action: upgrade, allowing a lab to become a Trading Station before the usual mine upgrade. Gain 2 VP. Each Research Lab upgrade also advances research.",
  itars: "Faction action: block two power/Q.I.C. actions and gain 4 VP.",
};

export const automaDifficulties = {
  automalein: "Automalein",
  automa: "Automa",
  automaechtig: "Automächtig",
  ultoma: "Ultoma",
  alptrauma: "Alptrauma",
};
