import { ScoringTile, FinalTile } from "../enums";

const roundScorings =  {
  [ScoringTile.Score1]: ["step >> 2vp"],
  [ScoringTile.Score2]: ["a >> 2vp"],
  [ScoringTile.Score3]: ["m >> 2vp"],
  [ScoringTile.Score4]: ["fed >> 5vp"],
  [ScoringTile.Score5]: ["ts >> 4vp"],
  [ScoringTile.Score6]: ["mg >> 4vp"],
  [ScoringTile.Score7]: ["PA >> 5vp"],
  [ScoringTile.Score8]: ["ts >> 3vp"],
  [ScoringTile.Score9]: ["d >> 3vp"],
  [ScoringTile.Score10]: ["PA >> 5vp"]
}

const finalScoring =  {
  [FinalTile.FinScore1]: ["st > 18vp"],
  [FinalTile.FinScore2]: ["stfed > 18vp"],
  [FinalTile.FinScore3]: ["pt > 18vp"],
  [FinalTile.FinScore4]: ["g > 18vp"],
  [FinalTile.FinScore5]: ["s > 18vp"],
  [FinalTile.FinScore6]: ["sat > 18vp"]
}


export {roundScorings};
