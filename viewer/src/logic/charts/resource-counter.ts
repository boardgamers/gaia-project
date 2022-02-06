import {
  BrainstoneDest,
  Building,
  Command,
  EventSource,
  Expansion,
  Faction,
  LogEntryChanges,
  Phase,
  Player,
  PlayerData,
  Resource,
  Reward,
  TechPos,
} from "@gaia-project/engine";
import { tradeCostSource, tradeSource } from "@gaia-project/engine/src/events";
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

export type ResourceSimulator = {
  simulateResources: (a: ExtractLogArg<any>) => Reward[];
  playerData: PlayerData;
};

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
    case Command.MoveShip:
      return [tradeCostSource, tradeSource, Command.Build];
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

export function newResourceSimulator(want: Player, expansions: Expansion): ResourceSimulator {
  const simulationPlayer = new Player();
  const playerData = simulationPlayer.data;

  const brainstoneSimulator = want.faction == Faction.Taklons ? new BrainstoneSimulator(playerData) : null;

  let changes: LogEntryChanges = null;
  let processedChanges: Map<EventSource, Reward[]> = null;
  let commandChanges: Reward[] = [];

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

  function gainRewards(rewards: Reward[]) {
    playerData.gainRewards(rewards);
    commandChanges = Reward.merge(rewards.concat(commandChanges));
  }

  const gainRewardsBySource = (source: EventSource, rewards: { [resource in Resource]?: number }) => {
    const processed = processedChanges?.get(source);
    for (const type in rewards) {
      let count = rewards[type];

      const p = processed?.find((p) => p.type == type);
      if (p) {
        count -= p.count;
      }

      gainRewards([new Reward(count, type as Resource)]);
    }
  };

  const payPowerUsage = (cmd: CommandObject, type: Resource, source?: EventSource) => {
    const powerUsage = parsePowerUsage(cmd);
    if (powerUsage) {
      const r = [new Reward(-sum(Object.values(powerUsage)), type)];
      gainRewards(r);
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
          payPowerUsage(cmd, Resource.MoveTokenToGaiaArea);
        } else if (building == Building.PlanetaryInstitute && want.faction == Faction.Nevlas) {
          playerData.tokenModifier = 2;
        }
        break;
      case Command.FormFederation:
        payPowerUsage(cmd, Resource.GainToken, Command.FormFederation);
        break;
    }

    //gain or use changes
    switch (cmd.command) {
      case Command.Spend:
        gainRewards(Reward.parse(args[0]).map((r) => new Reward(-r.count, r.type)));
        gainRewards(Reward.parse(args[2]));
        delete changes.spend;
        break;
      case Command.Special:
        if (args[0] == "4pw") {
          gainRewards(Reward.parse("4pw"));
          for (const pos of TechPos.values(expansions)) {
            delete changes[pos];
          }
        }
        break;
      case Command.BurnPower:
        playerData.burnPower(Number(args[0]));
        break;
      case Command.ChooseIncome:
        const r = Reward.parse(args[0]);
        gainRewards(r);
        addProcessedChange(r, Command.ChooseIncome);
        //all event sources might be reduced by this command
        changes = flattenChanges(changes, Command.ChooseIncome);
        break;
      default:
        if (changes) {
          for (const eventSource of commandEventSource(cmd)) {
            const change = changes[eventSource];
            if (change) {
              gainRewardsBySource(eventSource, change);
              delete changes[eventSource];
            }
          }
        }
    }
  };

  let gaiaPhase = false;

  const simulateResources = (a: ExtractLogArg<any>) => {
    commandChanges = [];
    if (a.log.phase == Phase.RoundGaia) {
      gaiaPhase = true;
      return [];
    }
    if (gaiaPhase && !isGaiaMove(a.allCommands)) {
      gaiaPhase = false;
      simulationPlayer.gaiaPhase();
    }

    if (a.log.player != want.player) {
      return [];
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
        gainRewardsBySource(s as EventSource, changes[s]);
      }
      changes = null;
      processedChanges = null;
    }
    return commandChanges;
  };

  const board = chartPlayerBoard(want);
  simulationPlayer.loadBoard(board, 0, true);
  return { playerData, simulateResources };
}

export const resourceCounter = (
  processor: (want: Player, a: ExtractLogArg<any>, data: PlayerData, simulateResources: () => Reward[]) => number
): ExtractLog<any> =>
  ExtractLog.new((want, s, engine) => {
    const simulator = newResourceSimulator(want, engine.expansions);

    return (a) => processor(want, a, simulator.playerData, () => simulator.simulateResources(a));
  });
