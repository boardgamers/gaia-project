import { Building as BuildingEnum, Condition as ConditionEnum, Planet, Reward, Spaceship } from "@gaia-project/engine";
import { SpaceshipActionType } from "@gaia-project/engine/src/spaceships";

export const spaceshipNames: Record<Spaceship, string> = {
  [Spaceship.Twilight]: "Twilight",
  [Spaceship.Rebellion]: "Rebellion",
  [Spaceship.TFMars]: "T F Mars",
  [Spaceship.Eclipse]: "Eclipse",
};

export const spaceshipLabels: Record<Spaceship, string> = {
  [Spaceship.Twilight]: "Nautilaks",
  [Spaceship.Rebellion]: "Vo'Kron",
  [Spaceship.TFMars]: "Gaia Federation",
  [Spaceship.Eclipse]: "Eridani Empire",
};

export const spaceshipMarkers: Record<Spaceship, string> = {
  [Spaceship.Twilight]: "T",
  [Spaceship.Rebellion]: "R",
  [Spaceship.TFMars]: "M",
  [Spaceship.Eclipse]: "E",
};

export type ActionOverlay = {
  building?: BuildingEnum;
  planet?: Planet;
  resource?: string;
  condition?: ConditionEnum;
};

/**
 * Display-only icons for the ship actions whose engine effect arrays are empty because they are
 * wired via bespoke SubPhases rather than declarative rewards (see engine spaceships.ts). Composed
 * exclusively of existing base-game primitives - no new art.
 */
const shipActionOverlays: { [key in Spaceship]?: Partial<{ [key in SpaceshipActionType]: ActionOverlay }> } = {
  [Spaceship.Twilight]: {
    power: { building: BuildingEnum.ResearchLab },
  },
  [Spaceship.Rebellion]: {
    power: { building: BuildingEnum.TradingStation },
  },
  [Spaceship.TFMars]: {
    power: { resource: "instant-gaiaforming" },
    // No Building overlay here: unlike Eclipse's Asteroid credit action below, the mine itself is
    // NOT free (RULES_CLARIFICATIONS.md §C3) - the 3 credits only substitute for 1 terraforming
    // step's ore cost, so the icon must show just that step, not a (misleadingly free-looking) mine.
    credit: { resource: "step" },
  },
  [Spaceship.Eclipse]: {
    power: { condition: ConditionEnum.AdvanceResearch },
    credit: { building: BuildingEnum.Mine, planet: Planet.Asteroid },
  },
};

export function actionOverlay(ship: Spaceship, type: SpaceshipActionType): ActionOverlay | null {
  return shipActionOverlays[ship]?.[type] ?? null;
}

export function isMineBubble(overlay: ActionOverlay): boolean {
  return overlay.planet != null;
}

export function costRewards(cost: string): Reward[] {
  return Reward.parse(cost);
}

export function costKind(cost: string): string {
  return costRewards(cost)[0].type;
}

export function costNumber(cost: string): number {
  return costRewards(cost)[0].count;
}

export function extraCosts(cost: string): Reward[] {
  return costRewards(cost).slice(1);
}

export function costFill(cost: string): string {
  const fills = { pw: "#984FF1", q: "green", k: "#3b82f6", c: "#d6a23c" };
  return fills[costKind(cost)] ?? "green";
}

/**
 * The cost badge normally anchors to the octagon's top-left corner. The one action with a
 * "condition" overlay (Eclipse's Power action, a wide "advance research" icon) needs its cost
 * nudged down and right instead, so the two don't overlap.
 */
export function costBadgeTransform(ship: Spaceship, type: SpaceshipActionType): string {
  return actionOverlay(ship, type)?.condition ? "translate(-9, -14)" : "translate(-15,-15)";
}
