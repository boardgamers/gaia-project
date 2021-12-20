import { ScoringTile } from "@gaia-project/engine";

export const roundScoringData: { [key in ScoringTile]: { name: string; abbreviation: string; color: string } } = {
  [ScoringTile.Score1]: { name: "2 VP / terraforming step", abbreviation: "2s", color: "--dig" },
  [ScoringTile.Score2]: { name: "2 VP when researching ", abbreviation: "2r", color: "--rt-sci" },
  [ScoringTile.Score3]: { name: "2 VP / mine", abbreviation: "2m", color: "--res-ore" },
  [ScoringTile.Score4]: { name: "5 VP / federation", abbreviation: "5f", color: "--federation" },
  [ScoringTile.Score5]: { name: "4 VP / trading station", abbreviation: "4t", color: "--res-credit" },
  [ScoringTile.Score6]: { name: "4 VP / mine on gaia", abbreviation: "4g", color: "--gaia" },
  [ScoringTile.Score7]: { name: "5 VP / PI or academy", abbreviation: "5b", color: "--current-round" },
  [ScoringTile.Score8]: { name: "3 VP / trading station", abbreviation: "3t", color: "--res-credit" },
  [ScoringTile.Score9]: { name: "3 VP / mine on gaia", abbreviation: "3g", color: "--gaia" },
  [ScoringTile.Score10]: { name: "5 VP / PI or academy", abbreviation: "5b", color: "--current-round" },
};
