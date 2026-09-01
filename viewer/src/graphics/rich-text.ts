import {
  ArtifactToken,
  BoardAction,
  Booster,
  Building,
  Faction,
  Planet,
  Reward,
  SpaceshipTechTile,
} from "@gaia-project/engine";
import type { AnyTechTile, AnyTechTilePos } from "@gaia-project/engine/src/enums";
import { Spaceship } from "@gaia-project/engine/src/enums";
import type { SpaceshipActionType } from "@gaia-project/engine/src/spaceships";
import type { SpecialActionIncome } from "../data";

export type RichTextBuilding = { type: Building; faction: Faction; count: number; skipResource: boolean };

export type RichTextElement = {
  text?: string;
  rewards?: Reward[];
  /** For `rewards` only: suppress the auto-"+" a "t"/"ta3" reward would otherwise get, for the
   * rare case where it represents a cost being paid rather than income being gained. */
  noPlus?: boolean;
  building?: RichTextBuilding;
  specialAction?: SpecialActionIncome;
  boardAction?: BoardAction;
  tech?: { pos?: AnyTechTilePos | Spaceship; tile?: AnyTechTile | SpaceshipTechTile; commandOverride?: string };
  booster?: Booster;
  planet?: Planet;
  spaceshipAction?: { ship: Spaceship; type: SpaceshipActionType };
  artifactToken?: ArtifactToken;
};
export type RichText = RichTextElement[];

export function richText(s: string): RichTextElement {
  return { text: s };
}

export function richTextRewards(rewards: Reward[], noPlus = false): RichTextElement {
  return noPlus ? { rewards, noPlus } : { rewards };
}

export function richTextBuilding(type: Building, faction: Faction, count = 1, skipResource = false): RichTextElement {
  return {
    building: {
      type,
      faction,
      count,
      skipResource,
    },
  };
}

export function richTextPlanet(planet: Planet): RichTextElement {
  return { planet };
}

export const richTextArrow = richText("arrow");
