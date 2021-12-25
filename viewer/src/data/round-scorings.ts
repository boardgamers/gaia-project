import { ScoringTile } from "@gaia-project/engine";
import { colorCodes } from "../logic/color-codes";

export const roundScoringData: { [key in ScoringTile]: { name: string; shortcut: string; color: string } } = {
  [ScoringTile.Score1]: colorCodes.terraformingStep.add({ name: "2 VP / terraforming step" }, "2"),
  [ScoringTile.Score2]: colorCodes.researchStep.add({ name: "2 VP when researching " }, "2"),
  [ScoringTile.Score3]: { name: "2 VP / mine", shortcut: "2m", color: "--res-ore" },
  [ScoringTile.Score4]: colorCodes.federation.add({ name: "5 VP / federation" }, "5"),
  [ScoringTile.Score5]: { name: "4 VP / trading station", shortcut: "4t", color: "--res-credit" },
  [ScoringTile.Score6]: { name: "4 VP / mine on gaia", shortcut: "4g", color: "--gaia" },
  [ScoringTile.Score7]: { name: "5 VP / PI or academy", shortcut: "5b", color: "--current-round" },
  [ScoringTile.Score8]: { name: "3 VP / trading station", shortcut: "3t", color: "--res-credit" },
  [ScoringTile.Score9]: { name: "3 VP / mine on gaia", shortcut: "3g", color: "--gaia" },
  [ScoringTile.Score10]: { name: "5 VP / PI or academy", shortcut: "5b", color: "--current-round" },
};
