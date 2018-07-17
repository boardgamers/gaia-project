import {Player, AdvTechTile, TechTile, TechTilePos, ScoringTile, FinalTile, AvailableCommand} from "@gaia-project/engine";

export interface AugmentedPlayer extends Player {
  progress: {[key in FinalTile]: number};
}

export interface Data {
  availableCommands: AvailableCommand[];
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
