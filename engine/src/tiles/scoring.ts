import { ScoringTile, FinalTile, Condition } from "../enums";

const roundScorings = {
  [ScoringTile.Score1]: ["step >> 2vp"],
  [ScoringTile.Score2]: ["a >> 2vp"],
  [ScoringTile.Score3]: ["m >> 2vp"],
  [ScoringTile.Score4]: ["fed >> 5vp"],
  [ScoringTile.Score5]: ["ts >> 4vp"],
  [ScoringTile.Score6]: ["mg >> 4vp"],
  [ScoringTile.Score7]: ["PA >> 5vp"],
  [ScoringTile.Score8]: ["ts >> 3vp"],
  [ScoringTile.Score9]: ["mg >> 3vp"],
  [ScoringTile.Score10]: ["PA >> 5vp"],
};

const finalScorings = {
  [FinalTile.Structure]: { condition: Condition.Structure, neutralPlayer: 11 },
  [FinalTile.StructureFed]: { condition: Condition.StructureFed, neutralPlayer: 10 },
  [FinalTile.PlanetType]: { condition: Condition.PlanetType, neutralPlayer: 5 },
  [FinalTile.Gaia]: { condition: Condition.Gaia, neutralPlayer: 4 },
  [FinalTile.Sector]: { condition: Condition.Sector, neutralPlayer: 6 },
  [FinalTile.Satellite]: { condition: Condition.Satellite, neutralPlayer: 8 },
};

export { roundScorings, finalScorings };
