import Engine from "../../engine";
import {
  BoardAction,
  Building,
  Command,
  Faction,
  FinalTile,
  Phase,
  Player,
  ResearchField,
  Resource,
  RoundScoring,
} from "../../enums";
import { CommittedTurnMacro } from "../actions/turn-builder";

export const FULL_GAME_REPORT_SCHEMA = "gaia-ai-full-game-report/v1" as const;

export interface FullGameRoundPlayerReport {
  round: number;
  rawScoreAfterRound: number;
  roundTileVp: number;
  federationVp: number;
  researchTrackVp: number;
  otherImmediateVp: number;
  ordinaryActions: number;
  passes: number;
  passOnTurn: number | null;
  actionCounts: { [command: string]: number };
  actionLines: string[];
}

export interface FinalScoringCategoryReport {
  tile: FinalTile;
  count: number;
  victoryPoints: number;
}

export interface FullGameScoreBreakdown {
  startingVp: number;
  roundTileVp: number;
  federationVp: number;
  researchTrackEndgameVp: number;
  finalScoring: [FinalScoringCategoryReport, FinalScoringCategoryReport];
  endgameResourceVp: number;
  bidVp: number;
  otherImmediateVp: number;
  otherEndgameVp: number;
  finalScore: number;
  accountedFinalScore: number;
}

export interface FullGameDevelopmentReport {
  buildings: { [building: string]: number };
  research: { [field: string]: number };
  federationTokens: number;
  techTiles: number;
  exploredShips: number;
  credits: number;
  ores: number;
  knowledge: number;
  qics: number;
}

export interface FullGamePlayerReport {
  seat: Player;
  faction: Faction;
  rounds: FullGameRoundPlayerReport[];
  totalOrdinaryActions: number;
  totalPasses: number;
  actionCounts: { [command: string]: number };
  score: FullGameScoreBreakdown;
  finalDevelopment: FullGameDevelopmentReport;
}

export interface FullGameReport {
  schemaVersion: typeof FULL_GAME_REPORT_SCHEMA;
  players: [FullGamePlayerReport, FullGamePlayerReport];
}

interface MutableRoundActions {
  ordinaryActions: number;
  passes: number;
  passOnTurn: number | null;
  actionCounts: { [command: string]: number };
  actionLines: string[];
}

interface VpBuckets {
  roundTile: number[];
  federation: number[];
  research: number[];
  otherImmediate: number[];
  finalScoring: [number, number];
  endgameResource: number;
  bid: number;
  otherEndgame: number;
}

function emptyRoundActions(): MutableRoundActions {
  return {
    ordinaryActions: 0,
    passes: 0,
    passOnTurn: null,
    actionCounts: {},
    actionLines: [],
  };
}

function emptyBuckets(): VpBuckets {
  return {
    roundTile: [0, 0, 0, 0, 0, 0],
    federation: [0, 0, 0, 0, 0, 0],
    research: [0, 0, 0, 0, 0, 0],
    otherImmediate: [0, 0, 0, 0, 0, 0],
    finalScoring: [0, 0],
    endgameResource: 0,
    bid: 0,
    otherEndgame: 0,
  };
}

function addCount(counts: { [key: string]: number }, key: string, amount = 1): void {
  counts[key] = (counts[key] ?? 0) + amount;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function isResearchSource(source: string): boolean {
  return ResearchField.values(4).some((field) => field === source);
}

function isRoundScoringSource(source: string): boolean {
  return RoundScoring.values().some((round) => round === source);
}

function mainActionLine(macro: CommittedTurnMacro): string {
  const main = macro.decisions.find((decision) => decision.kind === "main");
  return main ? main.moveFragments.join(". ") : macro.moveFragments.join(". ");
}

/**
 * Records committed macro choices while leaving the shared engine and bot contracts untouched.
 * VP attribution is reconstructed from the engine's existing advanced log after EndGame.
 */
export class FullGameReportCollector {
  private readonly initialAdvancedLogLength: number;
  private readonly startingScores: [number, number];
  private readonly roundActions: [MutableRoundActions[], MutableRoundActions[]];
  private readonly observedRoundScores: [Array<number | null>, Array<number | null>];

  constructor(initialEngine: Engine) {
    this.initialAdvancedLogLength = initialEngine.advancedLog.length;
    this.startingScores = [
      initialEngine.player(Player.Player1).data.victoryPoints,
      initialEngine.player(Player.Player2).data.victoryPoints,
    ];
    this.roundActions = [[], []];
    this.observedRoundScores = [
      [null, null, null, null, null, null],
      [null, null, null, null, null, null],
    ];
    for (let seat = 0; seat < 2; seat += 1) {
      for (let round = 0; round < 6; round += 1) {
        this.roundActions[seat][round] = emptyRoundActions();
      }
    }
  }

  record(source: Engine, macro: CommittedTurnMacro, destination: Engine): void {
    if (source.phase === Phase.RoundMove && source.round >= 1 && source.round <= 6) {
      const seat = macro.actor as 0 | 1;
      const round = source.round - 1;
      const report = this.roundActions[seat][round];
      addCount(report.actionCounts, macro.mainCommand);
      report.actionLines.push(mainActionLine(macro));
      if (macro.mainCommand === Command.Pass) {
        report.passes += 1;
        report.passOnTurn = report.ordinaryActions + 1;
      } else {
        report.ordinaryActions += 1;
      }
    }

    if (source.round >= 1 && source.round <= 6 && (destination.round > source.round || destination.ended)) {
      for (let seat = 0; seat < 2; seat += 1) {
        if (!destination.ended) {
          this.observedRoundScores[seat][source.round - 1] = destination.player(seat).data.victoryPoints;
        }
      }
    }
  }

  finish(finalEngine: Engine): FullGameReport {
    if (!finalEngine.ended) {
      throw new Error("Full-game report requires an EndGame engine");
    }
    const buckets: [VpBuckets, VpBuckets] = [emptyBuckets(), emptyBuckets()];
    let currentRound = 0;
    let endgame = false;
    for (const entry of finalEngine.advancedLog.slice(this.initialAdvancedLogLength)) {
      if (entry.round !== undefined) {
        currentRound = entry.round;
      }
      if (entry.phase === Phase.EndGame) {
        endgame = true;
      }
      if (entry.player !== Player.Player1 && entry.player !== Player.Player2) {
        continue;
      }
      const seat = entry.player as 0 | 1;
      for (const source of Object.keys(entry.changes ?? {})) {
        const victoryPoints = entry.changes[source]?.[Resource.VictoryPoint] ?? 0;
        if (victoryPoints === 0) {
          continue;
        }
        if (endgame) {
          if (source === "final1" || source === "final2") {
            buckets[seat].finalScoring[source === "final1" ? 0 : 1] += victoryPoints;
          } else if (isResearchSource(source)) {
            buckets[seat].research[Math.max(currentRound - 1, 0)] += victoryPoints;
          } else if (source === Command.Spend) {
            buckets[seat].endgameResource += victoryPoints;
          } else if (source === Command.Bid) {
            buckets[seat].bid += victoryPoints;
          } else {
            buckets[seat].otherEndgame += victoryPoints;
          }
        } else if (isRoundScoringSource(source)) {
          buckets[seat].roundTile[Math.max(currentRound - 1, 0)] += victoryPoints;
        } else if (source === Command.FormFederation || source === BoardAction.Qic2) {
          buckets[seat].federation[Math.max(currentRound - 1, 0)] += victoryPoints;
        } else if (isResearchSource(source)) {
          buckets[seat].research[Math.max(currentRound - 1, 0)] += victoryPoints;
        } else {
          buckets[seat].otherImmediate[Math.max(currentRound - 1, 0)] += victoryPoints;
        }
      }
    }

    const players = [Player.Player1, Player.Player2].map((seatValue): FullGamePlayerReport => {
      const seat = seatValue as 0 | 1;
      const bucket = buckets[seat];
      let rawScore = this.startingScores[seat];
      const totalActionCounts: { [command: string]: number } = {};
      const rounds = this.roundActions[seat].map((actions, index): FullGameRoundPlayerReport => {
        rawScore +=
          bucket.roundTile[index] + bucket.federation[index] + bucket.research[index] + bucket.otherImmediate[index];
        const observed = this.observedRoundScores[seat][index];
        if (observed !== null && observed !== rawScore) {
          throw new Error(
            `Round ${index + 1} raw-score attribution mismatch for seat ${seat}: ${rawScore} versus ${observed}`
          );
        }
        for (const command of Object.keys(actions.actionCounts)) {
          addCount(totalActionCounts, command, actions.actionCounts[command]);
        }
        return {
          round: index + 1,
          rawScoreAfterRound: rawScore,
          roundTileVp: bucket.roundTile[index],
          federationVp: bucket.federation[index],
          researchTrackVp: bucket.research[index],
          otherImmediateVp: bucket.otherImmediate[index],
          ordinaryActions: actions.ordinaryActions,
          passes: actions.passes,
          passOnTurn: actions.passOnTurn,
          actionCounts: { ...actions.actionCounts },
          actionLines: [...actions.actionLines],
        };
      });
      const finalPlayer = finalEngine.player(seat);
      const finalTiles = finalEngine.tiles.scorings.final;
      if (finalTiles.length !== 2) {
        throw new Error(`Expected two final-scoring tiles, got ${finalTiles.length}`);
      }
      const finalScoring: [FinalScoringCategoryReport, FinalScoringCategoryReport] = [0, 1].map(
        (index): FinalScoringCategoryReport => ({
          tile: finalTiles[index],
          count: finalPlayer.finalCount(finalTiles[index]),
          victoryPoints: bucket.finalScoring[index],
        })
      ) as [FinalScoringCategoryReport, FinalScoringCategoryReport];
      const finalScore = finalPlayer.data.victoryPoints;
      const accountedFinalScore =
        this.startingScores[seat] +
        sum(bucket.roundTile) +
        sum(bucket.federation) +
        sum(bucket.research) +
        bucket.finalScoring[0] +
        bucket.finalScoring[1] +
        bucket.endgameResource +
        bucket.bid +
        sum(bucket.otherImmediate) +
        bucket.otherEndgame;
      if (accountedFinalScore !== finalScore) {
        throw new Error(
          `Final-score attribution mismatch for seat ${seat}: ${accountedFinalScore} versus ${finalScore}`
        );
      }
      const buildings: { [building: string]: number } = {};
      for (const building of Building.values(finalEngine.expansions)) {
        buildings[building] = finalPlayer.data.buildings[building] ?? 0;
      }
      const research: { [field: string]: number } = {};
      for (const field of ResearchField.values(finalEngine.expansions)) {
        research[field] = finalPlayer.data.research[field] ?? 0;
      }
      return {
        seat: seatValue,
        faction: finalPlayer.faction,
        rounds,
        totalOrdinaryActions: rounds.reduce((total, round) => total + round.ordinaryActions, 0),
        totalPasses: rounds.reduce((total, round) => total + round.passes, 0),
        actionCounts: totalActionCounts,
        score: {
          startingVp: this.startingScores[seat],
          roundTileVp: sum(bucket.roundTile),
          federationVp: sum(bucket.federation),
          researchTrackEndgameVp: sum(bucket.research),
          finalScoring,
          endgameResourceVp: bucket.endgameResource,
          bidVp: bucket.bid,
          otherImmediateVp: sum(bucket.otherImmediate),
          otherEndgameVp: bucket.otherEndgame,
          finalScore,
          accountedFinalScore,
        },
        finalDevelopment: {
          buildings,
          research,
          federationTokens: finalPlayer.data.tiles.federations.length + finalPlayer.data.spaceshipFederations.length,
          techTiles: finalPlayer.data.tiles.techs.length,
          exploredShips: Object.keys(finalPlayer.data.explorationShips).length,
          credits: finalPlayer.data.credits,
          ores: finalPlayer.data.ores,
          knowledge: finalPlayer.data.knowledge,
          qics: finalPlayer.data.qics,
        },
      };
    }) as [FullGamePlayerReport, FullGamePlayerReport];

    return {
      schemaVersion: FULL_GAME_REPORT_SCHEMA,
      players,
    };
  }
}
