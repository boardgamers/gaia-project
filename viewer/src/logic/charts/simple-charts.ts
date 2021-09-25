import Engine, { Building, Command, Faction, LogEntry, Planet, Player } from "@gaia-project/engine";
import { sum } from "lodash";
import { CommandObject, parseCommands } from "../recent";
import { ChartKind } from "./chart-factory";
import { ChartFamily, ChartSource } from "./charts";

export type SimpleSourceFactory<Source extends ChartSource<any>> = {
  name: ChartFamily;
  playerSummaryLineChartTitle: string;
  sources: Source[];
  showWeightedTotal: boolean;
  initialValue?: (player: Player, source: Source) => number;
  extractChange?: (player: Player, source: Source) => (entry: LogEntry) => number;
  extractLog?: ExtractLog<Source>;
};

export function logEntryProcessor(
  processor: (cmd: CommandObject | null, log: LogEntry, allCommands: CommandObject[], cmdIndex: number) => number
): (moveHistory: string[], log: LogEntry) => number {
  return (moveHistory: string[], log: LogEntry): number => {
    if (log.move != null) {
      let res = 0;

      const move = moveHistory[log.move]; // current move isn't added yet
      if (move != null) {
        const commands = parseCommands(move);
        commands.forEach((cmd, index) => {
          res += processor(cmd, log, commands, index);
        });
      }
      return res;
    } else {
      return processor(null, log, [], 0);
    }
  };
}

type ExtractLogArgProcessor<Source> = (a: ExtractLogArg<Source>) => number;

type ExtractLogFunction<Source> = (p: Player, s: Source) => ExtractLogArgProcessor<Source>;

export class ExtractLog<Source> {
  private readonly fn: ExtractLogFunction<Source>;

  private constructor(fn: ExtractLogFunction<Source>) {
    this.fn = fn;
  }

  static new<Source>(fn: ExtractLogFunction<Source>, processEmptyCommands?: boolean): ExtractLog<Source> {
    if (processEmptyCommands) {
      return new ExtractLog<Source>(fn);
    }
    return new ExtractLog<Source>((p, s) => {
      const f = fn(p, s);
      return (a) => {
        return a.cmd ? f(a) : 0;
      };
    });
  }

  static wrapper<Source>(supplier: (p: Player, s: Source) => ExtractLog<Source>): ExtractLog<Source> {
    return ExtractLog.new((p, s) => supplier(p, s).processor(p, s), true);
  }

  static stateless<Source>(e: (a: ExtractLogArg<Source>) => number): ExtractLog<Source> {
    return ExtractLog.new((p) => (a) => (a.cmd.faction == p.faction ? e(a) : 0));
  }

  static mux<T extends ChartKind>(
    entries: { extractLog: ExtractLog<ChartSource<T>>; commandFilter?: Command[] }[]
  ): ExtractLog<ChartSource<T>> {
    return ExtractLog.wrapper((p, s) => {
      const logs = entries.map((e) => ({
        extractLog: e.extractLog.processor(p, s),
        commandFilter: e.commandFilter,
      }));

      return ExtractLog.new<ChartSource<T>>(
        () => (a) => {
          return sum(
            logs
              .filter((e) => !e.commandFilter || (a.cmd && e.commandFilter.includes(a.cmd.command)))
              .map((e) => e.extractLog(a))
          );
        },
        true
      );
    });
  }

  processor(p: Player, s: Source): ExtractLogArgProcessor<Source> {
    return this.fn(p, s);
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

export function commandCounter<T extends ChartKind>(...want: Command[]): ExtractLog<ChartSource<T>> {
  return ExtractLog.stateless((e) => (want.includes(e.cmd.command) && (e.cmd.args[0] as any) == e.source.type ? 1 : 0));
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
