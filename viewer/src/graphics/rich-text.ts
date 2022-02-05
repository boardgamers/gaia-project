import { Building, Faction, Reward } from "@gaia-project/engine";

export type RichTextBuilding = { type: Building; faction: Faction; count: number };

export type RichTextElement = {
  text?: string;
  rewards?: Reward[];
  building?: RichTextBuilding;
};
export type RichText = RichTextElement[];

export function richText(s: string): RichTextElement {
  return { text: s };
}

export function richTextRewards(rewards: Reward[]): RichTextElement {
  return { rewards };
}

export function richTextBuilding(type: Building, faction: Faction, count = 1): RichTextElement {
  return {
    building: {
      type,
      faction,
      count,
    },
  };
}

export const richTextArrow = richText("arrow");
