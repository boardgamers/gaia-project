import {
  BrainstoneDest,
  Command,
  EventSource,
  Faction,
  LogEntryChanges,
  Player,
  PlayerData,
  Resource,
  Reward,
  TechPos,
} from "@gaia-project/engine";
import { CommandObject } from "../recent";
import { chartPlayerBoard } from "./charts";
import { ExtractLog, ExtractLogArg } from "./simple-charts";

export class BrainstoneSimulator {
  private allCommands: CommandObject[];
  private data: PlayerData;
  private index = 0;

  constructor(data: PlayerData) {
    this.data = data;
    data.on("brainstone", () => {
      this.data.brainstoneDest = this.nextDest();
    });
  }

  nextDest(): BrainstoneDest {
    for (; this.index < this.allCommands.length; this.index++) {
      const command = this.allCommands[this.index];
      if (command.command == Command.BrainStone) {
        this.index++;
        return command.args[0] as BrainstoneDest;
      }
    }
    return undefined;
  }

  setTurnCommands(allCommands: CommandObject[]) {
    this.allCommands = allCommands;
    this.index = 0;
  }
}

const commandEventSource = (c: CommandObject): EventSource[] => {
  switch (c.command) {
    case Command.Action:
    case Command.ChooseTechTile:
      return [c.args[0] as EventSource];
    case Command.UpgradeResearch:
      return [c.command as EventSource, c.args[0] as EventSource];
    case Command.Build:
      return [c.command as EventSource, Faction.Gleens, Faction.Geodens, Faction.Lantids, Command.FormFederation];
  }
  return [c.command as EventSource];
};

export const resourceCounter = (
  processor: (want: Player, a: ExtractLogArg<any>, data: PlayerData, callback: () => void) => number
): ExtractLog<any> =>
  ExtractLog.new((want) => {
    const data = new PlayerData();
    data.loadPower(chartPlayerBoard(want));
    const brainstoneSimulator = new BrainstoneSimulator(data);

    let changes: LogEntryChanges = null;
    let processedChanges: Reward[] = [];

    const gainRewards = (rewards: { [resource in Resource]?: number }) => {
      for (const type in rewards) {
        const count = rewards[type];

        const processed = processedChanges.find((p) => p.type == type && p.count == count);
        if (processed) {
          processedChanges.splice(processedChanges.indexOf(processed), 1);
        } else {
          data.gainRewards([new Reward(count, type as Resource)]);
        }
      }
    };

    function consumeChanges(cmd: CommandObject) {
      const args = cmd.args;
      switch (cmd.command) {
        case Command.Spend:
          data.payCosts(Reward.parse(args[0]));
          data.gainRewards(Reward.parse(args[2]));
          delete changes.spend;
          break;
        case Command.Special:
          if (args[0] == "4pw") {
            data.gainRewards(Reward.parse("4pw"));
            for (const pos of TechPos.values()) {
              delete changes[pos];
            }
          }
          break;
        case Command.BurnPower:
          data.burnPower(Number(args[0]));
          break;
        case Command.ChooseIncome:
          const r = Reward.parse(args[0]);
          data.gainRewards(r);
          processedChanges.push(...r);
          break;
        default:
          if (changes) {
            for (const eventSource of commandEventSource(cmd)) {
              const change = changes[eventSource];
              if (change) {
                gainRewards(change);
                delete changes[eventSource];
              }
            }
          }
      }
    }

    return (a) =>
      processor(want, a, data, () => {
        if (a.log.player != want.player) {
          return;
        }
        if (a.cmdIndex == 0) {
          changes = {};
          Object.assign(changes, a.log.changes); //copy, so we can delete keys
          brainstoneSimulator.setTurnCommands(a.allCommands ?? []);
        }

        const cmd = a.cmd;
        if (cmd) {
          consumeChanges(cmd);
        }

        if (!cmd || a.cmdIndex == a.allCommands.length - 1) {
          for (const s in changes) {
            gainRewards(changes[s]);
          }
          changes = null;
          processedChanges = [];
        }
      });
  }, true);
