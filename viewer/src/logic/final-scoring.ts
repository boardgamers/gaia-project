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
import { ExtractLog, ExtractLogArg, planetCounter } from "./charts";
import { SimpleSource } from "./simple-charts";

type FinalScoringExtractLog = ExtractLog<SimpleSource<FinalTile>>;

export type FinalScoringSource = {
  extractLog: FinalScoringExtractLog;
  name: string;
  color: string;
};

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

export const finalScoringSources: { [key in FinalTile]: FinalScoringSource } = {
  [FinalTile.Gaia]: {
    name: "Gaia planets",
    color: "--rt-gaia",
    extractLog: planetCounter(
      () => false,
      () => false,
      (p) => p == Planet.Gaia,
      false
    ),
  },
  [FinalTile.PlanetType]: {
    name: "Planet Types",
    color: "--rt-terra",
    extractLog: planetTypes,
  },
  [FinalTile.Sector]: {
    name: "Sectors",
    color: "--tech-tile",
    extractLog: sectors,
  },
  [FinalTile.Satellite]: {
    name: "Satellites",
    color: "--current-round",
    extractLog: satellites,
  },
  [FinalTile.Structure]: {
    name: "Structures",
    color: "--terra",
    extractLog: planetCounter(
      () => true,
      () => true,
      () => true,
      false
    ),
  },
  [FinalTile.StructureFed]: {
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
