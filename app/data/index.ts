import {Player, AdvTechTilePos, AdvTechTile, TechTile, TechTilePos, ScoringTile, FinalTile} from "@gaia-project/engine";

export interface AugmentedPlayer extends Player {
  progress: {[key in FinalTile]: number};
}

export interface Data {
  players: AugmentedPlayer[];
  round: number;
  techTiles: {
    [key in TechTilePos]: {
      tile: TechTile,
      numTiles: number
    }
  },
  advTechTiles: {
    [key in TechTilePos]: {
      tile: AdvTechTile,
      numTiles: number
    }
  },
  roundScoringTiles: [ScoringTile, ScoringTile, ScoringTile, ScoringTile, ScoringTile, ScoringTile];
  finalScoringTiles: [FinalTile, FinalTile];
}
