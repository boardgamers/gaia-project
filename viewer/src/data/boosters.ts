import { Booster } from "@gaia-project/engine";

type BoosterData = {
  name: string;
  color: string;
  abbreviation: string;
};

export const boosterData: {
  [key in Booster]: BoosterData;
} = {
  [Booster.Booster1]: { name: "1k, 1o", color: "--titanium", abbreviation: "k" },
  [Booster.Booster2]: { name: "1o, 2 tokens", color: "--swamp", abbreviation: "o" },
  [Booster.Booster3]: { name: "q, 2c", color: "--res-qic", abbreviation: "q" },
  [Booster.Booster4]: { name: "2c, 1 step", color: "--dig", abbreviation: "s" },
  [Booster.Booster5]: { name: "2pw, range+3", color: "--rt-nav", abbreviation: "r" },
  [Booster.Booster6]: { name: "1o, 1 VP / mine", color: "--res-ore", abbreviation: "m" },
  [Booster.Booster7]: { name: "1o, 2 VP / ts", color: "--res-credit", abbreviation: "t" },
  [Booster.Booster8]: { name: "1k, 3 VP / lab", color: "--res-knowledge", abbreviation: "l" },
  [Booster.Booster9]: { name: "4pw, 4 VP / PI or academy", color: "--recent", abbreviation: "b" },
  [Booster.Booster10]: { name: "4c, 1 VP / gaia planet", color: "--rt-gaia", abbreviation: "g" },
};
