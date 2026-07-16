import { GreedyMacroBot } from "../bots/greedy";
import { HeuristicMacroBot } from "../bots/heuristic";
import { EngineSearchDomain } from "../search/engine-domain";
import { FullGamePlayerReport } from "./full-game-report";
import { PairedBaselineResult, playPairedBaselineMatchup } from "./self-play";
import { buildCuratedSearchPositions } from "./strength";

function compactPlayer(player: FullGamePlayerReport): object {
  return {
    faction: player.faction,
    finalScore: player.score.finalScore,
    rawScoresAfterRounds: player.rounds.map((round) => round.rawScoreAfterRound),
    ordinaryActionsByRound: player.rounds.map((round) => round.ordinaryActions),
    passTurns: player.rounds.map((round) => round.passOnTurn),
    roundTileVpByRound: player.rounds.map((round) => round.roundTileVp),
    federationVp: player.score.federationVp,
    researchTrackEndgameVp: player.score.researchTrackEndgameVp,
    finalScoring: player.score.finalScoring,
    endgameResourceVp: player.score.endgameResourceVp,
    otherImmediateVp: player.score.otherImmediateVp,
    actionCounts: player.actionCounts,
    finalDevelopment: player.finalDevelopment,
  };
}

function run(): void {
  const incomeNormalized = process.argv.includes("--income-normalized");
  if (process.argv.includes("--curated-values")) {
    const measurements = buildCuratedSearchPositions().map((position) => {
      const domains = ["immediate", "income-normalized"].map((mode) => {
        const domain = new EngineSearchDomain({
          leafGreedyMix: 1,
          greedyValueMode: mode as "immediate" | "income-normalized",
          prior: { greedyMix: 1 },
        });
        domain.expand(position.engine);
        const macros = domain.macroSet(position.stateHash);
        const orientation = position.actor === 0 ? 1 : -1;
        const entries = domain
          .priorReport(position.stateHash)
          .entries.slice()
          .sort(
            (left, right) =>
              orientation * (right.greedyFixedFrameValue - left.greedyFixedFrameValue) ||
              left.macroKey.localeCompare(right.macroKey)
          );
        const entryReport = (entry: (typeof entries)[number]) => {
          const macro = macros.macros.find((candidate) => candidate.key === entry.macroKey);
          return { moveLine: macro?.moveLine, value: entry.greedyFixedFrameValue };
        };
        const bestPass = entries.find((entry) =>
          macros.macros.some((macro) => macro.key === entry.macroKey && macro.mainCommand === "pass")
        );
        const bestOrdinary = entries.find((entry) =>
          macros.macros.some((macro) => macro.key === entry.macroKey && macro.mainCommand !== "pass")
        );
        return {
          mode,
          passAdvantage:
            bestPass && bestOrdinary
              ? orientation * (bestPass.greedyFixedFrameValue - bestOrdinary.greedyFixedFrameValue)
              : null,
          bestPass: bestPass ? entryReport(bestPass) : null,
          bestOrdinary: bestOrdinary ? entryReport(bestOrdinary) : null,
          top: entries.slice(0, 3).map(entryReport),
        };
      });
      return { label: position.label, actor: position.actor, domains };
    });
    console.log(JSON.stringify({ schemaVersion: "gaia-ai-7-productivity-curated-values/v1", measurements }, null, 2));
    return;
  }
  const matchups: PairedBaselineResult[] = incomeNormalized
    ? [
        playPairedBaselineMatchup(
          () => new GreedyMacroBot({ valueMode: "income-normalized" }),
          () => new GreedyMacroBot(),
          "ai-7-income-normalized-v-greedy"
        ),
        playPairedBaselineMatchup(
          () => new GreedyMacroBot({ valueMode: "income-normalized" }),
          () => new HeuristicMacroBot(),
          "ai-7-income-normalized-v-heuristic"
        ),
      ]
    : [
        playPairedBaselineMatchup(
          () => new HeuristicMacroBot(),
          () => new GreedyMacroBot(),
          "ai-7-productivity-diagnostic"
        ),
      ];
  console.log(
    JSON.stringify(
      {
        schemaVersion: "gaia-ai-7-productivity-diagnostic/v1",
        incomeNormalized,
        matchups: matchups.map((paired) => ({
          matchup: `${paired.botA}-vs-${paired.botB}`,
          candidateMargins: paired.aMargins,
          games: [paired.aAsXenos, paired.aAsHadschHallas].map((game) => ({
            players: game.fullGameReport.players.map(compactPlayer),
          })),
        })),
      },
      null,
      2
    )
  );
}

run();
