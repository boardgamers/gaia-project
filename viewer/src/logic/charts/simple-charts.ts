import Engine, { Building, Command, Faction, LogEntry, Planet, Player } from "@gaia-project/engine";
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
  processor: (cmd: CommandObject, log: LogEntry, allCommands: CommandObject[]) => number
): (moveHistory: string[], log: LogEntry) => number {
  return (moveHistory: string[], log: LogEntry): number => {
    let res = 0;

    if (log.move != null) {
      const move = moveHistory[log.move]; // current move isn't added yet
      if (move != null) {
        const commands = parseCommands(move);
        for (const cmd of commands) {
          res += processor(cmd, log, commands);
        }
      }
    }

    return res;
  };
}

export type ExtractLog<Source> = (p: Player) => (a: ExtractLogArg<Source>) => number;

export type ExtractLogArg<Source> = {
  cmd: CommandObject;
  allCommands: CommandObject[];
  source: Source;
  data: Engine;
  log: LogEntry;
};

export function statelessExtractLog<Source>(e: (a: ExtractLogArg<Source>) => number): ExtractLog<Source> {
  return (p) => (a) => (a.cmd.faction == p.faction ? e(a) : 0);
}

export function extractLogMux<T extends ChartKind>(
  mux: { [key in Command]?: ExtractLog<ChartSource<T>> }
): ExtractLog<ChartSource<T>> {
  return (p) => {
    const map = new Map<Command, (a: ExtractLogArg<ChartSource<T>>) => number>();
    for (const key of Object.keys(mux)) {
      map.set(key as Command, mux[key as Command](p));
    }
    return (e) => {
      return map.get(e.cmd.command)?.(e) ?? 0;
    };
  };
}

export function commandCounter<T extends ChartKind>(...want: Command[]): ExtractLog<ChartSource<T>> {
  return statelessExtractLog((e) => (want.includes(e.cmd.command) && (e.cmd.args[0] as any) == e.source.type ? 1 : 0));
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

  return (want) => {
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
  };
}
