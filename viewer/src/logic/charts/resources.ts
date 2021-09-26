import {
  BoardAction,
  Booster,
  Building,
  Command,
  EventSource,
  Faction,
  LogEntryChanges,
  Planet,
  PlayerData,
  PowerArea,
  Resource,
  Reward,
  TechPos,
} from "@gaia-project/engine";
import { BrainstoneDest } from "@gaia-project/engine/src/player-data";
import { sum } from "lodash";
import { boardActionNames } from "../../data/actions";
import { boosterNames } from "../../data/boosters";
import { resourceNames } from "../../data/resources";
import { CommandObject } from "../recent";
import { ChartKind } from "./chart-factory";
import { chartPlayerBoard, ChartSource, extractChanges } from "./charts";
import { commandCounter, ExtractLog, ExtractLogArg, planetCounter, SimpleSourceFactory } from "./simple-charts";

const range = "range";
const powerLeverage = "powerLeverage";

class BaseResourceSource<T extends ChartKind> extends ChartSource<T> {
  inverseOf?: Resource;
}

type ResourceSource = BaseResourceSource<Resource | "powerLeverage">;
type FreeActionSource = BaseResourceSource<Resource | "range">;

type ResourceWeight = { type: Resource; color: string; weight: number; inverseOf?: Resource };
const resourceWeights: ResourceWeight[] = [
  {
    type: Resource.Credit,
    color: "--res-credit",
    weight: 1,
  },
  {
    type: Resource.Ore,
    color: "--res-ore",
    weight: 3,
  },
  {
    type: Resource.Knowledge,
    color: "--res-knowledge",
    weight: 4,
  },
  {
    type: Resource.Qic,
    color: "--res-qic",
    weight: 4,
  },
  {
    type: Resource.ChargePower,
    color: "--res-power",
    weight: 0,
  },
  {
    type: Resource.PayPower,
    inverseOf: Resource.ChargePower,
    color: "--lost",
    weight: 0,
  },
  {
    type: Resource.GainToken,
    color: "--recent",
    weight: 0,
  },
  {
    type: Resource.BurnToken,
    color: "--current-round",
    weight: 0,
  },
];

export const resourceSources: ResourceSource[] = resourceWeights
  .map((w) => {
    const n = resourceNames.find((n) => n.type == w.type);
    return {
      type: w.type,
      weight: w.weight,
      color: w.color,
      inverseOf: w.inverseOf,
      label: n.plural,
    } as ResourceSource;
  })
  .concat({
    type: powerLeverage,
    label: "Power Leverage",
    description: "Additional spend power due to Brainstone or Nevla tokens with Planetary Institute",
    weight: 0,
    color: "--tech-tile",
  });

const freeActionSources = (resourceSources as FreeActionSource[])
  .filter((s) => s.weight > 0 || s.type == Resource.GainToken)
  .concat({
    type: range,
    label: "Range +2",
    color: "--rt-nav",
    weight: 0,
  })
  .concat({
    type: Resource.TechTile,
    label: "Tech Tile (Itars)",
    color: "--tech-tile",
    weight: 0,
  });

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

const resourceCounter = (
  processor: (a: ExtractLogArg<ResourceSource>, data: PlayerData, callback: () => void) => number
): ExtractLog<ResourceSource> =>
  ExtractLog.new((want) => {
    const data = new PlayerData();
    data.loadPower(chartPlayerBoard(want));
    const brainstoneSimulator = new BrainstoneSimulator(data);

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

    return (a) => {
      if (a.log.player == want.player) {
        return processor(a, data, () => {
          if (a.cmdIndex == 0) {
            changes = {};
            Object.assign(changes, a.log.changes); //copy, so we can delete keys
            brainstoneSimulator.setTurnCommands(a.allCommands ?? []);
          }

          const cmd = a.cmd;
          if (cmd) {
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

          if (!cmd || a.cmdIndex == a.allCommands.length - 1) {
            for (const s in changes) {
              gainRewards(changes[s]);
            }
            changes = null;
            processedChanges = [];
          }
        });
      } else {
        return 0;
      }
    };
  }, true);

const powerLeverageExtractLog: ExtractLog<ResourceSource> = ExtractLog.wrapper((want, source) => {
  if (source.type == powerLeverage) {
    switch (want.faction) {
      case Faction.Taklons:
        return resourceCounter((a, data, callback) => {
          const old = data.brainstone;
          callback();
          if (old == PowerArea.Area3 && data.brainstone == PowerArea.Area1) {
            return 2;
          }
          return 0;
        });
      case Faction.Nevlas:
        let pi = false;
        return resourceCounter((a, data, callback) => {
          if (a.cmd?.command == Command.Build && a.cmd.args[0] == Building.PlanetaryInstitute) {
            pi = true;
          }

          const area1 = data.power.area1;
          const area3 = data.power.area3;

          callback();

          if (pi && data.power.area3 < area3 && data.power.area1 > area1) {
            return Math.floor((area3 - data.power.area3) / 2);
          }

          return 0;
        });
    }
  }
  return ExtractLog.new(() => () => 0);
});

export const resourceSourceFactory: SimpleSourceFactory<ResourceSource> = {
  name: "Resources",
  playerSummaryLineChartTitle: "Resources of all players as if bought with power",
  showWeightedTotal: true,
  extractChange: (wantPlayer, source) =>
    extractChanges(wantPlayer.player, (player, eventSource, resource, round, change) =>
      (resource == source.type && change > 0) || (resource == source.inverseOf && change < 0) ? Math.abs(change) : 0
    ),
  extractLog: ExtractLog.mux([
    {
      commandFilter: [Command.BurnPower],
      extractLog: ExtractLog.stateless((e) =>
        e.source.type == Resource.BurnToken || e.source.type == Resource.ChargePower ? Number(e.cmd.args[0]) : 0
      ),
    },
    {
      extractLog: powerLeverageExtractLog,
    },
  ]),
  sources: resourceSources,
};

export const freeActionSourceFactory: SimpleSourceFactory<FreeActionSource> = {
  name: "Free actions",
  playerSummaryLineChartTitle:
    "Resources bought with free actions by all players (paid with power, credits, ore, QIC, and gaia formers)",
  showWeightedTotal: true,
  extractLog: ExtractLog.mux([
    {
      commandFilter: [Command.Spend],
      extractLog: ExtractLog.stateless((e) =>
        sum(
          Reward.merge(Reward.parse(e.cmd.args[2]))
            .filter((i) => i.type == e.source.type)
            .map((i) => i.count)
        )
      ),
    },
    {
      commandFilter: [Command.Build],
      extractLog: planetCounter(
        () => false,
        () => false,
        (p, t) => t == range,
        true,
        (cmd, log, planet) =>
          -(log.changes?.[Command.Build]?.[Resource.Qic] ?? 0) -
          (planet == Planet.Gaia && cmd.faction != Faction.Gleens ? 1 : 0)
      ),
    },
  ]),
  sources: freeActionSources,
};

export const boardActionSourceFactory: SimpleSourceFactory<ChartSource<BoardAction>> = {
  name: "Board actions",
  playerSummaryLineChartTitle: `Board actions taken by all players`,
  showWeightedTotal: false,
  extractLog: commandCounter(Command.Action),
  sources: BoardAction.values().map((action) => ({
    type: action,
    label: boardActionNames[action].name,
    color: boardActionNames[action].color,
    weight: 1,
  })),
};

export const boosterSourceFactory = (boosters: Booster[]): SimpleSourceFactory<ChartSource<Booster>> => ({
  name: "Boosters",
  showWeightedTotal: false,
  playerSummaryLineChartTitle: "Boosters taken by all players",
  extractLog: commandCounter(Command.Pass, Command.ChooseRoundBooster),
  sources: boosters.map((b) => ({
    type: b,
    label: boosterNames[b].name,
    color: boosterNames[b].color,
    weight: 1,
  })),
});
