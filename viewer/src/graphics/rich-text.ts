import { BoardAction, Booster, Building, Faction, Reward } from "@gaia-project/engine";
import { AnyTechTile, AnyTechTilePos } from "@gaia-project/engine/src/enums";
import { SpecialActionIncome } from "../data";

export type RichTextBuilding = { type: Building; faction: Faction; count: number; skipResource: boolean };

export type RichTextElement = {
  text?: string;
  rewards?: Reward[];
  building?: RichTextBuilding;
  specialAction?: SpecialActionIncome;
  boardAction?: BoardAction;
  tech?: { pos?: AnyTechTilePos; tile?: AnyTechTile; commandOverride?: string };
  booster?: Booster;
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

export const richTextArrow = richText("arrow");
