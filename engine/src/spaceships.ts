import { Expansion, Spaceship, SpaceshipFederation, SpaceshipTechTile } from "./enums";

export type SpaceshipActionType = "qic" | "power" | "knowledge" | "credit";

export interface SpaceshipAction {
  type: SpaceshipActionType;
  /** Reward.parse-compatible cost string, e.g. "3q" or "3pw,2o" */
  cost: string;
  /** Human-readable effect description; not yet wired to any execution logic */
  effect: string;
}

export interface SpaceshipBoardSpec {
  actions: [SpaceshipAction, SpaceshipAction, SpaceshipAction];
  hasStandardTechSlot: boolean;
}

/**
 * Reward.parse/Event.parse-compatible income strings for ship board actions whose effect maps
 * directly onto existing engine grammar. An empty array marks an action as wired but executed with
 * bespoke logic in move/spaceship-actions.ts rather than through this declarative table (e.g. Eclipse's
 * Power action triggers the UpgradeResearch subphase directly, and TF Mars's Power action triggers the
 * InstantGaiaforming subphase directly). Actions absent from this table (every ship's Credit/Power
 * "bypass normal build" actions) are not yet wired and stay unavailable in possibleSpaceshipActions.
 */
export const spaceshipActionEffects: { [key in Spaceship]?: Partial<{ [key in SpaceshipActionType]: string[] }> } = {
  [Spaceship.Twilight]: {
    qic: [">fed"],
    knowledge: ["3range"],
  },
  [Spaceship.Rebellion]: {
    qic: ["tech"],
    knowledge: ["2c,1q"],
  },
  [Spaceship.TFMars]: {
    qic: ["2vp", "tt > vp"],
    power: [],
  },
  [Spaceship.Eclipse]: {
    qic: ["2vp", "pt > vp"],
    power: [],
  },
};

export interface ClaimableSpaceshipFederation {
  ship: Spaceship;
  federation: SpaceshipFederation;
}

export interface ClaimableSpaceshipTech {
  ship: Spaceship;
  tile: SpaceshipTechTile;
}

export interface SeededSpaceshipTech {
  tile: SpaceshipTechTile;
  /** Remaining claimable copies on this ship; equal to player count at setup. */
  count: number;
}

export const spaceshipBoards: { [key in Spaceship]: SpaceshipBoardSpec } = {
  [Spaceship.Twilight]: {
    hasStandardTechSlot: false,
    actions: [
      { type: "qic", cost: "3q", effect: "Re-score (re-trigger) a Federation token you already own" },
      { type: "power", cost: "3pw,2o", effect: "Build a Research Lab" },
      { type: "knowledge", cost: "1k", effect: "+3 range for Build a Mine, Gaiaforming, or Exploring a spaceship" },
    ],
  },
  [Spaceship.Rebellion]: {
    hasStandardTechSlot: true,
    actions: [
      { type: "qic", cost: "3q", effect: "Claim a Tech tile" },
      {
        type: "power",
        cost: "3pw,1o",
        effect: "Build a Trading Station, ignoring the usual adjacent-mine requirement",
      },
      { type: "knowledge", cost: "2k", effect: "Gain 2 credits and 1 Q.I.C." },
    ],
  },
  [Spaceship.TFMars]: {
    hasStandardTechSlot: true,
    actions: [
      { type: "qic", cost: "2q", effect: "Gain 2 VP plus 1 VP per Tech tile owned" },
      {
        type: "power",
        cost: "2pw",
        effect: "Instant Gaiaforming: convert a transdim planet in range into a Gaia planet",
      },
      { type: "credit", cost: "3c", effect: "Terraform 1 step and build a mine" },
    ],
  },
  [Spaceship.Eclipse]: {
    hasStandardTechSlot: true,
    actions: [
      { type: "qic", cost: "2q", effect: "Gain 2 VP plus 1 VP per planet type colonized" },
      { type: "power", cost: "3pw,2k", effect: "Advance 1 level on any Research track" },
      { type: "credit", cost: "6c", effect: "Place a free Mine on an Asteroid in range" },
    ],
  },
};

/** Charge cost (power) for landing on exploration-track spaces 1-4 of any spaceship. Same track on every ship. */
export const EXPLORATION_CHARGE_TRACK: readonly number[] = [0, 2, 2, 4];

/** Artifact slots only exist on Twilight, one per player. */
export function artifactSlotCount(ship: Spaceship, nbPlayers: number): number {
  return ship === Spaceship.Twilight ? nbPlayers : 0;
}

/** Rebellion is removed from the game entirely in 2-player games. */
export function shipsInPlay(expansions: Expansion, nbPlayers: number): Spaceship[] {
  return Spaceship.values(expansions).filter((ship) => nbPlayers > 2 || ship !== Spaceship.Rebellion);
}

export function claimableSpaceshipFederations(
  explorationShips: { [key in Spaceship]?: number },
  spaceshipFederations: { [key in Spaceship]?: SpaceshipFederation }
): ClaimableSpaceshipFederation[] {
  return Spaceship.values(Expansion.LostFleet)
    .filter((ship) => explorationShips[ship] !== undefined && spaceshipFederations[ship] !== undefined)
    .map((ship) => ({
      ship,
      federation: spaceshipFederations[ship],
    }));
}

export function claimableSpaceshipTechs(
  explorationShips: { [key in Spaceship]?: number },
  spaceshipTechs: { [key in Spaceship]?: SeededSpaceshipTech }
): ClaimableSpaceshipTech[] {
  return Spaceship.values(Expansion.LostFleet)
    .filter((ship) => explorationShips[ship] !== undefined && (spaceshipTechs[ship]?.count ?? 0) > 0)
    .map((ship) => ({
      ship,
      tile: spaceshipTechs[ship].tile,
    }));
}
