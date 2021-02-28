import { sortBy, sum } from "lodash";
import { FinalTile, Resource } from "../enums";
import Player from "../player";
import Reward from "../reward";
import { finalScorings } from "../tiles/scoring";

export type FinalScoreRankings = Array<Array<{ player: Player; count: number }>>;

export function finalRankings(finalTiles: FinalTile[], collection: Player[]) {
  const allRankings: FinalScoreRankings = [];

  for (const tile of finalTiles) {
    const players = sortBy(collection, (player) => player.finalCount(tile)).reverse();

    const rankings = players.map((pl) => ({
      player: pl,
      count: pl.finalCount(tile),
    }));

    if (collection.length === 2) {
      rankings.push({
        player: null,
        count: finalScorings[tile].neutralPlayer,
      });
      rankings.sort((pl1, pl2) => pl2.count - pl1.count);
    }

    allRankings.push(rankings);
  }
  return allRankings;
}

export function gainFinalScoringVictoryPoints(allRankings: FinalScoreRankings, player: Player) {
  // Gain points from final scoring
  allRankings.forEach((rankings, index) => {
    const ranking = rankings.find((rnk) => rnk.player === player);

    const count = ranking.count;
    // index of the first player with that score
    const first = rankings.findIndex((pl) => pl.count === count);
    // number of other players with the same score
    const ties = rankings.filter((pl) => pl.count === count).length;

    // only players that advanced are getting VPs
    // see https://boardgamegeek.com/thread/1929227/0-end-score-0-vp
    if (ranking.player && count > 0) {
      const VPs = [18, 12, 6, 0, 0, 0];

      player.gainRewards(
        [new Reward(Math.floor(sum(VPs.slice(first, first + ties)) / ties), Resource.VictoryPoint)],
        `final${index + 1}` as "final1" | "final2"
      );
    }
  });
}
