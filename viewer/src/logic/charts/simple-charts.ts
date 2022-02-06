import Engine, { Building, Command, Faction, LogEntry, Planet, Player } from "@gaia-project/engine";
import { sum } from "lodash";
import { CommandObject, parseCommands } from "../recent";
import { ChartKind } from "./chart-factory";
import { ChartFamily, ChartSource } from "./charts";

export type ExtractChange<Source extends ChartSource<any>> = (
  player: Player,
  source: Source
) => (entry: LogEntry, logIndex: number) => number;

export type SimpleSourceFactory<Source extends ChartSource<any>> = {
  name: ChartFamily;
  playerSummaryLineChartTitle: string;
  sources: Source[];
  showWeightedTotal: boolean;
  initialValue?: (player: Player, source: Source) => number;
  extractChange?: ExtractChange<Source>;
  extractLog?: ExtractLog<Source>;
};

export function processLogEntry(
  log: LogEntry,
  commands: CommandObject[] | null,
  processor: (cmd: CommandObject | null, log: LogEntry, allCommands: CommandObject[], cmdIndex: number) => number
): number {
  if (commands != null) {
    let res = 0;

    commands.forEach((cmd, index) => {
      res += processor(cmd, log, commands, index);
    });
    return res;
  } else {
    return processor(null, log, [], 0);
  }
}

export function logEntryProcessor(
  processor: (cmd: CommandObject | null, log: LogEntry, allCommands: CommandObject[], cmdIndex: number) => number
): (moveHistory: string[], log: LogEntry) => number {
  return (moveHistory: string[], log: LogEntry): number => {
    if (log.move != null) {
      const move = moveHistory[log.move]; // current move isn't added yet
      if (move != null) {
        return processLogEntry(log, parseCommands(move), processor);
      }
      return 0;
    } else {
      return processLogEntry(log, null, processor);
    }
  };
}

type ExtractLogArgProcessor<Source> = (a: ExtractLogArg<Source>) => number;

type ExtractLogFunction<Source> = (p: Player, s: Source, engine: Engine) => ExtractLogArgProcessor<Source>;

export type ExtractLogEntry<T extends ChartKind> = {
  extractLog: ExtractLog<ChartSource<T>>;
  commandFilter?: Command[];
  sourceTypeFilter?: any[];
  factionFilter?: Faction[];
};

export class ExtractLog<Source> {
  private readonly fn: ExtractLogFunction<Source>;

  private constructor(fn: ExtractLogFunction<Source>) {
    this.fn = fn;
  }

  static new<Source>(fn: ExtractLogFunction<Source>): ExtractLog<Source> {
    return new ExtractLog<Source>(fn);
  }

  static wrapper<Source>(supplier: (p: Player, s: Source, engine: Engine) => ExtractLog<Source>): ExtractLog<Source> {
    return ExtractLog.new((p, s, engine) => supplier(p, s, engine).processor(p, s, engine));
  }

  static filterPlayer<Source>(e: (a: ExtractLogArg<Source>) => number): ExtractLog<Source> {
    return ExtractLog.new((p) => (a) => (a.cmd && a.cmd.faction == p.faction ? e(a) : 0));
  }

  static filterPlayerChanges<Source>(e: (a: ExtractLogArg<Source>) => number): ExtractLog<Source> {
    return ExtractLog.filterPlayer((a) => (a.cmdIndex == 0 ? e(a) : 0));
  }

  static mux<T extends ChartKind>(entries: ExtractLogEntry<T>[]): ExtractLog<ChartSource<T>> {
    return ExtractLog.wrapper((p, s, engine) => {
      const logs = entries
        .filter(
          (e) => (!e.sourceTypeFilter || e.sourceTypeFilter.includes(s.type)) && this.matchesFaction(e.factionFilter, p)
        )
        .map((e) => ({
          extractLog: e.extractLog.processor(p, s, engine),
          commandFilter: e.commandFilter,
          factionFilter: e.factionFilter,
        }));

      return ExtractLog.new<ChartSource<T>>(() => (a) => {
        return sum(
          logs
            .filter(
              (e) =>
                (!e.commandFilter || (a.cmd && e.commandFilter.includes(a.cmd.command))) &&
                (!a.log.player || this.matchesFaction(e.factionFilter, a.data.player(a.log.player)))
            )
            .map((e) => e.extractLog(a))
        );
      });
    });
  }

  private static matchesFaction<T extends ChartKind>(filter: Faction[] | null, p: Player) {
    return !filter || (p && filter.includes(p.faction));
  }

  processor(p: Player, s: Source, engine: Engine): ExtractLogArgProcessor<Source> {
    return this.fn(p, s, engine);
  }
}

export type ExtractLogArg<Source> = {
  cmd: CommandObject;
  allCommands: CommandObject[];
  cmdIndex: number;
  source: Source;
  data: Engine;
  log: LogEntry;
};

export function commandCounter<T extends ChartKind>(
  command: Command,
  arg0: string,
  scorer: (a: ExtractLogArg<any>) => number = () => 1
): ExtractLog<ChartSource<T>> {
  return ExtractLog.filterPlayer((a) => (command == a.cmd.command && a.cmd.args[0] == arg0 ? scorer(a) : 0));
}

export function commandCounterArg0EqualsSource<T extends ChartKind>(...want: Command[]): ExtractLog<ChartSource<T>> {
  return ExtractLog.filterPlayer((a) =>
    want.includes(a.cmd.command) && (a.cmd.args[0] as any) == a.source.type ? 1 : 0
  );
}

export function planetCounter<T extends ChartKind>(
  includeLantidsGuestMine: (s: ChartSource<T>) => boolean,
  includeLostPlanet: (s: ChartSource<T>) => boolean,
  includeRegularPlanet: (planet: Planet, type: T, player: Player) => boolean,
  countTransdim = true,
  value: (cmd: CommandObject, log: LogEntry, planet: Planet, location: string) => number = () => 1
): ExtractLog<ChartSource<T>> {
  const transdim = new Set<string>();
  const owners: { [key: string]: Faction } = {};

  return ExtractLog.new((want) => {
    return (e) => {
      const cmd = e.cmd;
      if (!cmd) {
        return 0;
      }
      const data = e.data;
      const source = e.source;
      switch (cmd.command) {
        case Command.PlaceLostPlanet:
          return cmd.faction == want.faction && includeLostPlanet(source)
            ? value(cmd, e.log, Planet.Lost, cmd.args[0])
            : 0;
        case Command.Build:
          const building = cmd.args[0] as Building;
          const location = cmd.args[1];
          const { q, r } = data.map.parse(location);
          const hex = data.map.grid.get({ q, r });
          const planet = hex.data.planet;

          const owner = owners[location];
          if (owner == null) {
            owners[location] = cmd.faction;
          }
          if (cmd.faction != want.faction) {
            return 0;
          }

          if (owner != want.faction && want.faction == Faction.Lantids) {
            return includeLantidsGuestMine(source) ? value(cmd, e.log, planet, location) : 0;
          }

          if (building == Building.GaiaFormer && countTransdim) {
            transdim.add(location);

            if (includeRegularPlanet(Planet.Transdim, source.type, want)) {
              return value(cmd, e.log, Planet.Transdim, location);
            }
          }

          if (
            includeRegularPlanet(planet, source.type, want) &&
            (building == Building.Mine || (building == Building.PlanetaryInstitute && want.faction == Faction.Ivits)) &&
            !transdim.has(location)
          ) {
            return value(cmd, e.log, planet, location);
          }
      }
      return 0;
    };
  });
}
