import { AdvTechTile, Event, SpaceshipTechTile, TechTile } from "@gaia-project/engine";
import type { AnyTechTile } from "@gaia-project/engine/src/enums";
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
  [TechTile.TechFrontiers1]: colorCodes.tradeShip.add({ name: "2c per trade" }),
};

export const advancedTechTileData: {
  [key in AdvTechTile]: TileTileData;
} = {
  [AdvTechTile.AdvTech1]: colorCodes.federation.add({ name: "3 VP / federation when passing" }, "3"),
  [AdvTechTile.AdvTech2]: colorCodes.researchStep.add({ name: "2 VP when researching" }, "2"),
  [AdvTechTile.AdvTech3]: { name: "q,5c special action", color: "--specialAction", shortcut: "5c" },
  [AdvTechTile.AdvTech4]: { name: "2 VP / mine", color: "--res-ore", shortcut: "2m" },
  [AdvTechTile.AdvTech5]: { name: "3 VP / lab when passing", color: "--res-knowledge", shortcut: "3l" },
  [AdvTechTile.AdvTech6]: colorCodes.sector.add({ name: "1 ore / sector" }, "o"),
  [AdvTechTile.AdvTech7]: colorCodes.planetType.add({ name: "1 VP / planet type when passing" }, "1"),
  [AdvTechTile.AdvTech8]: { name: "2 VP / gaia planet", color: "--gaia", shortcut: "2g" },
  [AdvTechTile.AdvTech9]: { name: "4 VP / ts", color: "--res-credit", shortcut: "4t" },
  [AdvTechTile.AdvTech10]: colorCodes.sector.add({ name: "2 VP / sector" }, "2"),
  [AdvTechTile.AdvTech11]: { name: "3o special action", color: "--specialAction", shortcut: "3o" },
  [AdvTechTile.AdvTech12]: colorCodes.federation.add({ name: "5 VP / federation" }, "5"),
  [AdvTechTile.AdvTech13]: { name: "3k special action", color: "--specialAction", shortcut: "3k" },
  [AdvTechTile.AdvTech14]: { name: "3 VP when building a mine", color: "--res-ore", shortcut: "3m" },
  [AdvTechTile.AdvTech15]: { name: "3 VP when building ts", color: "--res-credit", shortcut: "3t" },

  // Lost Fleet, see RULES_CLARIFICATIONS.md §G2
  [AdvTechTile.AsteroidPass]: { name: "2 VP / asteroid when passing", color: "--titanium", shortcut: "2a" },
  [AdvTechTile.Big]: { name: "6 VP / PI or academy (max 18)", color: "--recent", shortcut: "6b" },
  [AdvTechTile.Deep]: { name: "4 VP / deep space sector", color: "--lost", shortcut: "4d" },
  [AdvTechTile.DeepPass]: { name: "2 VP / deep space sector when passing", color: "--lost", shortcut: "2d" },
  [AdvTechTile.QAction]: { name: "4 VP / QIC action", color: "--res-qic", shortcut: "4q" },
  [AdvTechTile.Terra]: colorCodes.terraformingStep.add({ name: "2 VP / terraforming step" }, "2"),
};

// The 3 Standard Tech tiles seeded on spaceship boards, see RULES_CLARIFICATIONS.md §G1
export const spaceshipTechTileData: {
  [key in SpaceshipTechTile]: TileTileData;
} = {
  [SpaceshipTechTile.Range]: colorCodes.range.add({ name: "Range +1 (while uncovered)" }, "+1"),
  [SpaceshipTechTile.Terraform]: colorCodes.terraformingStep.add(
    { name: "Once: free mine with up to 2 free terraforming steps" },
    "2"
  ),
  [SpaceshipTechTile.Resource]: { name: "1 ore, 3 knowledge", color: "--res-knowledge", shortcut: "1o3k" },
};

export function techTileData(tile: AnyTechTile | SpaceshipTechTile): TileTileData {
  return baseTechTileData[tile] ?? advancedTechTileData[tile] ?? spaceshipTechTileData[tile];
}

/**
 * Display-only events so the 3 spaceship Standard Tech tiles render through TechContent's icon
 * system like every base-game tile, instead of TechTile.vue's old text fallback. The engine has
 * no Event grammar for these tiles yet (their execution is bespoke), so these exist purely for
 * the viewer; tooltips still show the exact rules text from spaceshipTechSpec.
 */
const spaceshipTechDisplayEvents: { [key in SpaceshipTechTile]: string } = {
  [SpaceshipTechTile.Range]: "+r",
  // "Once" (one-time immediate), not "Activate" (repeatable special action) - the rulebook grants
  // this exactly once, unlike the base game's Power2 board action or Space Giants' "=> 2step"
  // faction ability, which both reuse the same "2step" reward but ARE repeatable each round.
  [SpaceshipTechTile.Terraform]: "> 2step",
  [SpaceshipTechTile.Resource]: "o,3k",
};

export function spaceshipTechDisplayEvent(tile: SpaceshipTechTile): Event {
  return new Event(spaceshipTechDisplayEvents[tile]);
}
