import {
  BrainstoneDest,
  Building,
  Command,
  EventSource,
  Faction,
  LogEntryChanges,
  Phase,
  Player,
  PlayerData,
  Resource,
  Reward,
  TechPos,
} from "@gaia-project/engine";
import { MoveTokens } from "@gaia-project/engine/src/player-data";
import { sum } from "lodash";
import { isGaiaMove } from "../../data/log";
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

export function parsePowerUsage(command: CommandObject): MoveTokens | null {
  let offset = command.args.indexOf("using");
  if (offset < 0) {
    return null;
  }
  offset++;
  const res = {
    area1: 0,
    area2: 0,
    area3: 0,
  } as MoveTokens;
  const args = command.args;
  const areas = (args.length - offset) / 2;
  for (let i = 0; i < areas; i++) {
    res[args[2 * i + offset].replace(":", "")] = Number(args[2 * i + offset + 1].replace(",", ""));
  }
  return res;
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

export function isLastChange(a: ExtractLogArg<any>) {
  return !a.cmd || a.cmdIndex == a.allCommands.length - 1;
}

export function flattenChanges(changes: LogEntryChanges, source: EventSource): LogEntryChanges {
  const values: Reward[] = Object.values(changes).flatMap((map) =>
    Object.keys(map).map((k) => new Reward(map[k], k as Resource))
  );
  const c = {};
  for (const r of Reward.merge(values)) {
    c[r.type] = r.count;
  }
  return { [source]: c };
}

export const resourceCounter = (
  processor: (want: Player, a: ExtractLogArg<any>, data: PlayerData, simulateResources: () => void) => number
): ExtractLog<any> =>
  ExtractLog.new((want) => {
    const simulationPlayer = new Player();
    const data = simulationPlayer.data;

    const brainstoneSimulator = want.faction == Faction.Taklons ? new BrainstoneSimulator(data) : null;

    let changes: LogEntryChanges = null;
    let processedChanges: Map<EventSource, Reward[]> = null;

    function addProcessedChange(change: Reward[], source: EventSource) {
      if (processedChanges == null) {
        processedChanges = new Map<EventSource, Reward[]>();
      }
      const last = processedChanges.get(source);
      if (last) {
        change = Reward.merge(last, change);
      }
      processedChanges.set(source, change);
    }

    const gainRewards = (source: EventSource, rewards: { [resource in Resource]?: number }) => {
      const processed = processedChanges?.get(source);
      for (const type in rewards) {
        let count = rewards[type];

        const p = processed?.find((p) => p.type == type);
        if (p) {
          count -= p.count;
        }

        data.gainRewards([new Reward(count, type as Resource)]);
      }
    };

    const payPowerUsage = (cmd: CommandObject, data: PlayerData, type: Resource, source?: EventSource) => {
      const powerUsage = parsePowerUsage(cmd);
      if (powerUsage) {
        const r = [new Reward(-sum(Object.values(powerUsage)), type)];
        data.gainRewards(r);
        if (source) {
          addProcessedChange(r, source);
        }
      }
    };

    const consumeChanges = (cmd: CommandObject) => {
      const args = cmd.args;
      //gain on top of changes
      switch (cmd.command) {
        case Command.Build:
          const building = cmd.args[0] as Building;
          if (building == Building.GaiaFormer) {
            payPowerUsage(cmd, data, Resource.MoveTokenToGaiaArea);
          } else if (building == Building.PlanetaryInstitute && want.faction == Faction.Nevlas) {
            data.tokenModifier = 2;
          }
          break;
        case Command.FormFederation:
          payPowerUsage(cmd, data, Resource.GainToken, Command.FormFederation);
          break;
      }

      //gain or use changes
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
          addProcessedChange(r, Command.ChooseIncome);
          //all event sources might be reduced by this command
          changes = flattenChanges(changes, Command.ChooseIncome);
          break;
        default:
          if (changes) {
            for (const eventSource of commandEventSource(cmd)) {
              const change = changes[eventSource];
              if (change) {
                gainRewards(eventSource, change);
                delete changes[eventSource];
              }
            }
          }
      }
    };

    let gaiaPhase = false;

    const process = (a: ExtractLogArg<any>) =>
      processor(want, a, data, () => {
        if (a.log.phase == Phase.RoundGaia) {
          gaiaPhase = true;
          return false;
        }
        if (gaiaPhase && !isGaiaMove(a.allCommands)) {
          gaiaPhase = false;
          simulationPlayer.gaiaPhase();
        }

        if (a.log.player != want.player) {
          return;
        }
        if (a.cmdIndex == 0) {
          changes = {};
          Object.assign(changes, a.log.changes); //copy, so we can delete keys
          brainstoneSimulator?.setTurnCommands(a.allCommands ?? []);
        }

        const cmd = a.cmd;
        if (cmd) {
          consumeChanges(cmd);
        }

        if (isLastChange(a)) {
          for (const s in changes) {
            gainRewards(s as EventSource, changes[s]);
          }
          changes = null;
          processedChanges = null;
        }
        return;
      });

    const board = chartPlayerBoard(want);
    simulationPlayer.loadBoard(board, 0, true);

    return (a) => process(a);
  });
