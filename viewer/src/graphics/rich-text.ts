import { BoardAction, Building, Faction, Reward } from "@gaia-project/engine";
import { SpecialActionIncome } from "../data";

export type RichTextBuilding = { type: Building; faction: Faction; count: number; skipResource: boolean };

export type RichTextElement = {
  text?: string;
  rewards?: Reward[];
  building?: RichTextBuilding;
  specialAction?: SpecialActionIncome;
  boardAction?: BoardAction;
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
