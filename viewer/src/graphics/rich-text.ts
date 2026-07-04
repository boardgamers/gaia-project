import { ArtifactToken, BoardAction, Booster, Building, Faction, Planet, Reward, SpaceshipTechTile } from "@gaia-project/engine";
import { AnyTechTile, AnyTechTilePos, Spaceship } from "@gaia-project/engine/src/enums";
import { SpaceshipActionType } from "@gaia-project/engine/src/spaceships";
import { SpecialActionIncome } from "../data";

export type RichTextBuilding = { type: Building; faction: Faction; count: number; skipResource: boolean };

export type RichTextElement = {
  text?: string;
  rewards?: Reward[];
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

export function richTextRewards(rewards: Reward[]): RichTextElement {
  return { rewards };
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
