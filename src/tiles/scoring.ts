import { ScoringTile, FinalTile, Condition } from "../enums";

const roundScorings =  {
  [ScoringTile.Score1]: ["step >> 2vp"],
  [ScoringTile.Score2]: ["a >> 2vp"],
  [ScoringTile.Score3]: ["m >> 2vp"],
  [ScoringTile.Score4]: ["fed >> 5vp"],
  [ScoringTile.Score5]: ["ts >> 4vp"],
  [ScoringTile.Score6]: ["mg >> 4vp"],
  [ScoringTile.Score7]: ["PA >> 5vp"],
  [ScoringTile.Score8]: ["ts >> 3vp"],
  [ScoringTile.Score9]: ["mg >> 3vp"],
  [ScoringTile.Score10]: ["PA >> 5vp"]
};

const finalScorings =  {
  [FinalTile.Structure]: Condition.Structure,
  [FinalTile.StructureFed]: Condition.StructureFed,
  [FinalTile.PlanetType]: Condition.PlanetType ,
  [FinalTile.Gaia]: Condition.Gaia,
  [FinalTile.Sector]: Condition.Sector,
  [FinalTile.Satellite]: Condition.Satellite
};

export {roundScorings, finalScorings};
