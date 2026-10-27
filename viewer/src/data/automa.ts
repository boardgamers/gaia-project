import { boardActionData } from "./actions";
import { buildingData } from "./building";
import { researchData } from "./research";
import { spaceshipNames } from "./spaceships";

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
