import {
  Command,
  Expansion,
  LogEntry,
  Player,
  PlayerData,
  researchEvents,
  ResearchField,
  Resource,
} from "@gaia-project/engine";
import { sum } from "lodash";
import { researchColorVar, researchData } from "../../data/research";
import { CommandObject } from "../recent";
import { chartPlayerBoard, ChartSource } from "./charts";
import { ChartSummary, commandCounterArg0EqualsSource, logEntryProcessor, SimpleSourceFactory } from "./simple-charts";

export class ResearchCounter {
  player: Player;
  playerData: PlayerData;

  constructor(player: Player, playerData: PlayerData = new PlayerData()) {
    this.player = player;
    this.playerData = playerData;

    chartPlayerBoard(player).income[0].rewards.forEach((r) => {
      if (r.type.startsWith("up-")) {
        this.advance(r.type.slice(3) as ResearchField);
      }
    });
  }

  processCommand(cmd: CommandObject) {
    if (cmd?.faction == this.player.faction && cmd.command == Command.UpgradeResearch) {
      const field = cmd.args[0] as ResearchField;
      this.advance(field);
    }
  }

  private advance(field: ResearchField) {
    this.playerData.research[field]++;
    for (const r of researchEvents(field, this.playerData.research[field], Expansion.None)
      .flatMap((e) => e.rewards)
      .filter((r) => r.type === Resource.GaiaFormer)) {
      //workaround because gaia formers don't appear in advanced log
      this.playerData.gaiaformers += r.count;
    }
  }
}

export function countResearch(player: Player): (moveHistory: string[], log: LogEntry) => number {
  const research = new ResearchCounter(player);

  return logEntryProcessor((cmd) => {
    research.processCommand(cmd);
    if (cmd) {
      if (cmd.faction == player.faction && cmd.command == Command.UpgradeResearch) {
        if (research.playerData.research[cmd.args[0] as ResearchField] >= 3) {
          return 4;
        }
      } else if (cmd.command == Command.ChooseFaction && cmd.args[0] == player.faction) {
        return sum(
          Array.from(Object.values(research.playerData.research)).map((level) => Math.max(0, (level - 2) * 4))
        );
      }
    }
    return 0;
  });
}

export const researchSourceFactory = (expansion: Expansion): SimpleSourceFactory<ChartSource<ResearchField>> => ({
  name: "Research",
  playerSummaryLineChartTitle: "Research steps of all players",
  summary: ChartSummary.total,
  initialValue: (player, source) => new ResearchCounter(player).playerData.research[source.type] ?? 0,
  extractLog: commandCounterArg0EqualsSource(Command.UpgradeResearch),
  sources: ResearchField.values(expansion).map((field) => {
    return {
      type: field as ResearchField,
      label: researchData[field].name,
      color: researchColorVar(field),
      weight: 1,
    };
  }),
});
