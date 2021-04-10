import {
  Building,
  Command,
  Faction,
  FinalTile,
  GaiaHex,
  parseLocation,
  Planet,
  SpaceMap,
  stdBuildingValue,
} from "@gaia-project/engine";
import { Grid } from "hexagrid";
import { ColorVar, ExtractLog, ExtractLogArg, planetCounter } from "./charts";
import { SimpleSource } from "./simple-charts";
import { cellStyle, rowHeaderCell } from "./table";

type FinalScoringExtractLog = ExtractLog<SimpleSource<FinalTile>>;

type FinalScoringContributor =
  | "Regular Building"
  | "Lost Planet"
  | "Satellite"
  | "Space Station"
  | "Lantids Guest Mine"
  | "Gaia Former";

export type FinalScoringTableRow = {
  contributors: FinalScoringContributor[];
  name: string;
  color: string;
};

export type FinalScoringSource = FinalScoringTableRow & { extractLog: FinalScoringExtractLog };

const structureFed: FinalScoringExtractLog = (wantPlayer) => {
  let map = null;

  function hasBuildingValue(h: GaiaHex) {
    return h.data.building != null && stdBuildingValue(h.data.building) > 0;
  }

  function addBuilding(location: string, building: Building): number {
    const { q, r } = map.parse(location);
    const hex = map.grid.get({ q, r });

    hex.data.building = building;
    hex.data.player = wantPlayer;

    return wantPlayer.addBuildingToNearbyFederation(building, hex, map).filter((h) => hasBuildingValue(h)).length;
  }

  return (e) => {
    if (e.cmd.faction != wantPlayer.faction) {
      return 0;
    }
    if (map == null) {
      map = new SpaceMap();
      map.grid = new Grid<GaiaHex>();
      map.placement = e.data.map.placement;
      map.grid.push(
        ...Array.from(e.data.map.grid.values()).map((hex) => {
          return new GaiaHex(hex.q, hex.r, {
            planet: hex.data.planet,
            sector: hex.data.sector,
          });
        })
      );
    }
    switch (e.cmd.command) {
      case Command.FormFederation:
        const hexes = wantPlayer.hexesForFederationLocation(e.cmd.args[0], map);
        const gaiaHexes = hexes.filter((h) => h.addToFederationOf(wantPlayer.player) && hasBuildingValue(h));
        return gaiaHexes.length;
      case Command.Build:
        return addBuilding(e.cmd.args[1], e.cmd.args[0] as Building);
      case Command.PlaceLostPlanet:
        return addBuilding(e.cmd.args[0], Building.Mine);
    }
    return 0;
  };
};

const satellites: FinalScoringExtractLog = (wantPlayer) => {
  let last = 0;

  function subtractLast(s: number) {
    if (wantPlayer.faction != Faction.Ivits) {
      return s;
    }
    const result = s - last;
    last = s;
    return result;
  }

  return (e) => {
    if (e.cmd.faction != wantPlayer.faction) {
      return 0;
    }

    switch (e.cmd.command) {
      case Command.FormFederation:
        const hexes = wantPlayer.hexesForFederationLocation(e.cmd.args[0], e.data.map);
        return subtractLast(hexes.filter((h) => h.data.building == null).length);
      case Command.Build:
        const building = e.cmd.args[0] as Building;
        return building == Building.SpaceStation ? 1 : 0;
    }
    return 0;
  };
};

const planetTypes: FinalScoringExtractLog = (wantPlayer) => {
  const settled = new Set<string>();

  return planetCounter(
    () => false,
    () => true,
    () => true,
    false,
    (cmd, log, planet) => {
      if (settled.has(planet)) {
        return 0;
      }
      settled.add(planet);
      return 1;
    }
  )(wantPlayer);
};

const sectors: FinalScoringExtractLog = (wantPlayer) => {
  const sectors = new Set<string>();

  return planetCounter(
    () => true,
    () => true,
    () => true,
    false,
    (cmd, log, planet, location) => {
      const l = parseLocation(location);
      if (sectors.has(l.sector)) {
        return 0;
      }
      sectors.add(l.sector);
      return 1;
    }
  )(wantPlayer);
};

export const finalScoringContributorColors: { [key in FinalScoringContributor]: string } = {
  "Regular Building": "--res-ore",
  "Lantids Guest Mine": "--recent",
  "Lost Planet": "--lost",
  Satellite: "--current-round",
  "Space Station": "--oxide",
  "Gaia Former": "--rt-gaia",
};

export const finalScoringSources: { [key in FinalTile]: FinalScoringSource } = {
  [FinalTile.Gaia]: {
    name: "Gaia planets",
    contributors: ["Regular Building"],
    color: "--rt-gaia",
    extractLog: planetCounter(
      () => false,
      () => false,
      (p) => p == Planet.Gaia,
      false
    ),
  },
  [FinalTile.PlanetType]: {
    contributors: ["Regular Building", "Lost Planet"],
    name: "Planet Types",
    color: "--rt-terra",
    extractLog: planetTypes,
  },
  [FinalTile.Sector]: {
    contributors: ["Regular Building", "Lost Planet", "Lantids Guest Mine"],
    name: "Sectors",
    color: "--tech-tile",
    extractLog: sectors,
  },
  [FinalTile.Satellite]: {
    contributors: ["Satellite", "Space Station"],
    name: "Satellites",
    color: "--current-round",
    extractLog: satellites,
  },
  [FinalTile.Structure]: {
    contributors: ["Regular Building", "Lost Planet", "Lantids Guest Mine"],
    name: "Structures",
    color: "--recent",
    extractLog: planetCounter(
      () => true,
      () => true,
      () => true,
      false
    ),
  },
  [FinalTile.StructureFed]: {
    contributors: ["Regular Building", "Lost Planet", "Lantids Guest Mine"],
    name: "Structures in federations",
    color: "--federation",
    extractLog: structureFed,
  },
};

export const finalScoringExtractLog: ExtractLog<SimpleSource<FinalTile>> = (p) => {
  const map = new Map<FinalTile, (a: ExtractLogArg<SimpleSource<FinalTile>>) => number>();
  for (const key of Object.keys(finalScoringSources)) {
    map.set(key as FinalTile, finalScoringSources[key as FinalTile].extractLog(p));
  }
  return (e) => map.get(e.source.type)(e);
};

const finalScoringTableRows: FinalScoringTableRow[] = Object.keys(finalScoringSources)
  .map((s) => finalScoringSources[s] as FinalScoringTableRow)
  .concat(
    {
      name: "(Starting Point for navigation)",
      color: "--rt-nav",
      contributors: ["Regular Building", "Lost Planet", "Lantids Guest Mine", "Space Station"],
    },
    {
      name: "(Power value for federations)",
      color: "--res-power",
      contributors: ["Regular Building", "Lost Planet", "Space Station", "Lantids Guest Mine"],
    }
  );

export function finalScoringFields(canvas: HTMLElement): any[] {
  return [{ key: "Name", sortable: true, isRowHeader: true } as { key: string }].concat(
    ...Object.keys(finalScoringContributorColors).map((c) => {
      return {
        key: c,
        sortable: true,
        thStyle: cellStyle(canvas as HTMLCanvasElement, new ColorVar(finalScoringContributorColors[c])),
      };
    })
  );
}

export function finalScoringItems(canvas: HTMLElement): any[] {
  return finalScoringTableRows.map((r) => {
    const row = { Name: rowHeaderCell(cellStyle(canvas, new ColorVar(r.color)), r.name) };

    for (const contributor of r.contributors) {
      row[contributor] = true;
    }
    return row;
  });
}
