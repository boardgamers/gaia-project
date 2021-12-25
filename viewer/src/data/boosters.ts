import { Booster } from "@gaia-project/engine";
import { colorCodes } from "../logic/color-codes";

type BoosterData = {
  name: string;
  color: string;
  shortcut: string;
};

export const boosterData: {
  [key in Booster]: BoosterData;
} = {
  [Booster.Booster1]: { name: "1k, 1o", color: "--titanium", shortcut: "k" },
  [Booster.Booster2]: { name: "1o, 2 tokens", color: "--swamp", shortcut: "o" },
  [Booster.Booster3]: { name: "q, 2c", color: "--res-qic", shortcut: "q" },
  [Booster.Booster4]: colorCodes.terraformingStep.add({ name: "2c, 1 step" }),
  [Booster.Booster5]: colorCodes.range.add({ name: "2pw, range+3" }),
  [Booster.Booster6]: { name: "1o, 1 VP / mine", color: "--res-ore", shortcut: "m" },
  [Booster.Booster7]: { name: "1o, 2 VP / ts", color: "--res-credit", shortcut: "t" },
  [Booster.Booster8]: { name: "1k, 3 VP / lab", color: "--res-knowledge", shortcut: "l" },
  [Booster.Booster9]: { name: "4pw, 4 VP / PI or academy", color: "--recent", shortcut: "b" },
  [Booster.Booster10]: colorCodes.gaia.add({ name: "4c, 1 VP / gaia planet" }),
};
