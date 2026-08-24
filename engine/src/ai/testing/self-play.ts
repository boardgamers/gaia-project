import Engine from "../../engine";
import { Faction, Player } from "../../enums";
import { applyMacroHostStyle, MacroBotError } from "../bots/common";
import { MacroBot } from "../bots/types";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "../challenge";
import { terminalUtility } from "../evaluation";
import { FullGameReport, FullGameReportCollector } from "./full-game-report";

export const BASELINE_SELF_PLAY_SCHEMA = "gaia-ai-baseline-self-play/v1" as const;

export interface BaselineGameResult {
  schemaVersion: typeof BASELINE_SELF_PLAY_SCHEMA;
  seat0Bot: string;
  seat1Bot: string;
  seat0Faction: Faction;
  seat1Faction: Faction;
  committedLines: number;
  finalSeat0Score: number;
  finalSeat1Score: number;
  finalMargin: number;
  moveHistory: string[];
  fullGameReport: FullGameReport;
  finalEngine: Engine;
}

export interface PairedBaselineResult {
  schemaVersion: typeof BASELINE_SELF_PLAY_SCHEMA;
  botA: string;
  botB: string;
  aAsXenos: BaselineGameResult;
  aAsHadschHallas: BaselineGameResult;
  aMargins: [number, number];
  pairedMarginSum: number;
  pairedMarginMean: number;
  aWins: number;
  draws: number;
  bWins: number;
}

export type BotFactory = (seat: Player, gameLabel: string) => MacroBot;

export function playBaselineGame(seat0Bot: MacroBot, seat1Bot: MacroBot, maxCommittedLines = 800): BaselineGameResult {
  let engine = new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
  const reportCollector = new FullGameReportCollector(engine);
  let committedLines = 0;
  while (!engine.ended) {
    if (committedLines >= maxCommittedLines) {
      throw new MacroBotError(
        `Baseline game ${seat0Bot.name}/${seat1Bot.name} did not finish within ${maxCommittedLines} committed lines`
      );
    }
    const actor = engine.playerToMove;
    const bot = actor === Player.Player1 ? seat0Bot : seat1Bot;
    const selection = bot.select(engine);
    if (
      selection.macro.actor !== actor ||
      !selection.macroSet.macros.some((macro) => macro.key === selection.macro.key)
    ) {
      throw new MacroBotError(`${bot.name} selected a macro outside its Phase 1.4 committed set`);
    }
    const source = engine;
    engine = applyMacroHostStyle(source, selection.macro);
    reportCollector.record(source, selection.macro, engine);
    committedLines += 1;
  }
  const finalSeat0Score = engine.player(Player.Player1).data.victoryPoints;
  const finalSeat1Score = engine.player(Player.Player2).data.victoryPoints;
  return {
    schemaVersion: BASELINE_SELF_PLAY_SCHEMA,
    seat0Bot: seat0Bot.name,
    seat1Bot: seat1Bot.name,
    seat0Faction: Faction.Xenos,
    seat1Faction: Faction.HadschHallas,
    committedLines,
    finalSeat0Score,
    finalSeat1Score,
    finalMargin: terminalUtility(engine),
    moveHistory: [...engine.moveHistory],
    fullGameReport: reportCollector.finish(engine),
    finalEngine: engine,
  };
}

export function playPairedBaselineMatchup(
  botAFactory: BotFactory,
  botBFactory: BotFactory,
  label: string
): PairedBaselineResult {
  const aAsXenos = playBaselineGame(
    botAFactory(Player.Player1, `${label}-a-xenos`),
    botBFactory(Player.Player2, `${label}-b-hadsch-hallas`)
  );
  const aAsHadschHallas = playBaselineGame(
    botBFactory(Player.Player1, `${label}-b-xenos`),
    botAFactory(Player.Player2, `${label}-a-hadsch-hallas`)
  );
  const aMargins: [number, number] = [aAsXenos.finalMargin, -aAsHadschHallas.finalMargin];
  const pairedMarginSum = aMargins[0] + aMargins[1];
  const botA = aAsXenos.seat0Bot;
  const botB = aAsXenos.seat1Bot;
  return {
    schemaVersion: BASELINE_SELF_PLAY_SCHEMA,
    botA,
    botB,
    aAsXenos,
    aAsHadschHallas,
    aMargins,
    pairedMarginSum,
    pairedMarginMean: pairedMarginSum / 2,
    aWins: aMargins.filter((margin) => margin > 0).length,
    draws: aMargins.filter((margin) => margin === 0).length,
    bWins: aMargins.filter((margin) => margin < 0).length,
  };
}
