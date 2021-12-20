import { AdvTechTile, TechTile } from "@gaia-project/engine";

export type TileTileData = {
  name: string;
  color: string;
  abbreviation: string;
};

export const baseTechTileData: {
  [key in TechTile]: TileTileData;
} = {
  [TechTile.Tech1]: { name: "o,q", color: "--res-qic", abbreviation: "q" },
  [TechTile.Tech2]: { name: "k for planet types", color: "--dig", abbreviation: "t" },
  [TechTile.Tech3]: { name: "power value 4 for PI / academy", color: "--recent", abbreviation: "b" },
  [TechTile.Tech4]: { name: "7 VP", color: "--res-vp", abbreviation: "v" },
  [TechTile.Tech5]: { name: "1o,1pw income", color: "--ore", abbreviation: "o" },
  [TechTile.Tech6]: { name: "1k,1c income", color: "--res-knowledge", abbreviation: "k" },
  [TechTile.Tech7]: { name: "3 VP / build mine on gaia", color: "--gaia", abbreviation: "g" },
  [TechTile.Tech8]: { name: "4c income", color: "--res-credit", abbreviation: "c" },
  [TechTile.Tech9]: { name: "4pw special action", color: "--res-power", abbreviation: "p" },
};

export const advancedTechTileData: {
  [key in AdvTechTile]: TileTileData;
} = {
  [AdvTechTile.AdvTech1]: { name: "3 VP / federation when passing", color: "--federation", abbreviation: "3f" },
  [AdvTechTile.AdvTech2]: { name: "2 VP when researching", color: "--rt-science", abbreviation: "2r" },
  [AdvTechTile.AdvTech3]: { name: "q,5c special action", color: "--specialAction", abbreviation: "5c" },
  [AdvTechTile.AdvTech4]: { name: "2 VP / mine", color: "--res-ore", abbreviation: "2m" },
  [AdvTechTile.AdvTech5]: { name: "3 VP / lab when passing", color: "--res-knowledge", abbreviation: "3l" },
  [AdvTechTile.AdvTech6]: { name: "1 ore / sector", color: "--lost", abbreviation: "os" },
  [AdvTechTile.AdvTech7]: { name: "1 VP / planet type when passing", color: "--dig", abbreviation: "1t" },
  [AdvTechTile.AdvTech8]: { name: "2 VP / gaia planet", color: "--gaia", abbreviation: "2g" },
  [AdvTechTile.AdvTech9]: { name: "4 VP / ts", color: "--res-credit", abbreviation: "4t" },
  [AdvTechTile.AdvTech10]: { name: "2 VP / sector", color: "--current-round", abbreviation: "2s" },
  [AdvTechTile.AdvTech11]: { name: "3o special action", color: "--specialAction", abbreviation: "3o" },
  [AdvTechTile.AdvTech12]: { name: "5 VP / federation", color: "--federation", abbreviation: "5f" },
  [AdvTechTile.AdvTech13]: { name: "3k special action", color: "--specialAction", abbreviation: "3k" },
  [AdvTechTile.AdvTech14]: { name: "3 VP when building a mine", color: "--res-ore", abbreviation: "3m" },
  [AdvTechTile.AdvTech15]: { name: "3 VP when building ts", color: "--res-credit", abbreviation: "3t" },
};

export function techTileData(tile: TechTile | AdvTechTile): TileTileData {
  return baseTechTileData[tile] ?? advancedTechTileData[tile];
}
