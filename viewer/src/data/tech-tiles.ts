import { AdvTechTile, TechTile } from "@gaia-project/engine";
import { colorCodes } from "../logic/color-codes";

export type TileTileData = {
  name: string;
  color: string;
  shortcut: string;
};

export const baseTechTileData: {
  [key in TechTile]: TileTileData;
} = {
  [TechTile.Tech1]: { name: "o,q", color: "--res-qic", shortcut: "q" },
  [TechTile.Tech2]: colorCodes.planetType.add({ name: "k for planet types" }),
  [TechTile.Tech3]: { name: "power value 4 for PI / academy", color: "--recent", shortcut: "b" },
  [TechTile.Tech4]: { name: "7 VP", color: "--res-vp", shortcut: "v" },
  [TechTile.Tech5]: { name: "1o,1pw income", color: "--res-ore", shortcut: "o" },
  [TechTile.Tech6]: { name: "1k,1c income", color: "--res-knowledge", shortcut: "k" },
  [TechTile.Tech7]: colorCodes.gaia.add({ name: "3 VP / build mine on gaia" }),
  [TechTile.Tech8]: { name: "4c income", color: "--res-credit", shortcut: "c" },
  [TechTile.Tech9]: { name: "4pw special action", color: "--res-power", shortcut: "p" },
};

export const advancedTechTileData: {
  [key in AdvTechTile]: TileTileData;
} = {
  [AdvTechTile.AdvTech1]: colorCodes.federation.add({ name: "3 VP / federation when passing" }, "3"),
  [AdvTechTile.AdvTech2]: colorCodes.researchStep.add({ name: "2 VP when researching" }, "2"),
  [AdvTechTile.AdvTech3]: { name: "q,5c special action", color: "--specialAction", shortcut: "5c" },
  [AdvTechTile.AdvTech4]: { name: "2 VP / mine", color: "--res-ore", shortcut: "2m" },
  [AdvTechTile.AdvTech5]: { name: "3 VP / lab when passing", color: "--res-knowledge", shortcut: "3l" },
  [AdvTechTile.AdvTech6]: { name: "1 ore / sector", color: "--lost", shortcut: "os" },
  [AdvTechTile.AdvTech7]: colorCodes.planetType.add({ name: "1 VP / planet type when passing" }, "1"),
  [AdvTechTile.AdvTech8]: { name: "2 VP / gaia planet", color: "--gaia", shortcut: "2g" },
  [AdvTechTile.AdvTech9]: { name: "4 VP / ts", color: "--res-credit", shortcut: "4t" },
  [AdvTechTile.AdvTech10]: colorCodes.sector.add({ name: "2 VP / sector" }, "2"),
  [AdvTechTile.AdvTech11]: { name: "3o special action", color: "--specialAction", shortcut: "3o" },
  [AdvTechTile.AdvTech12]: colorCodes.federation.add({ name: "5 VP / federation" }, "5"),
  [AdvTechTile.AdvTech13]: { name: "3k special action", color: "--specialAction", shortcut: "3k" },
  [AdvTechTile.AdvTech14]: { name: "3 VP when building a mine", color: "--res-ore", shortcut: "3m" },
  [AdvTechTile.AdvTech15]: { name: "3 VP when building ts", color: "--res-credit", shortcut: "3t" },
};

export function techTileData(tile: TechTile | AdvTechTile): TileTileData {
  return baseTechTileData[tile] ?? advancedTechTileData[tile];
}
