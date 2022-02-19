import {
  Building,
  Command,
  Faction,
  FinalTile,
  GaiaHex,
  parseLocation,
  Planet,
  Player,
  SpaceMap,
  stdBuildingValue,
} from "@gaia-project/engine";
import { Grid } from "hexagrid";
import { colorCodes } from "../color-codes";
import { ChartSource } from "./charts";
import { ChartSummary, ExtractLog, ExtractLogArg, planetCounter, SimpleSourceFactory } from "./simple-charts";

type FinalScoringExtractLog = ExtractLog<ChartSource<FinalTile>>;

export type FinalScoringContributor =
  | "Regular Building"
  | "Lost Planet"
  | "Satellite"
  | "Space Station"
  | "Lantids Guest Mine"
  | "Gaia Former";

export class FinalScoringTableRow {
  contributors: FinalScoringContributor[];
  name: string;
  color: string;
}

class FinalScoringSource extends FinalScoringTableRow {
  extractLog: FinalScoringExtractLog;
  shortcut: string;
}

class FederationSimulator {
  map: SpaceMap;
  private wantPlayer: Player;

  constructor(wantPlayer: Player) {
    this.wantPlayer = wantPlayer;
  }

  hasBuildingValue(h: GaiaHex) {
    const building = h.data.building;
    return building != null && stdBuildingValue(building) > 0 && building !== Building.CustomsPost;
  }

  addBuilding(location: string, building: Building): number {
    const hex = this.map.getS(location);

    hex.data.building = building;
    hex.data.player = this.wantPlayer.player;

    return this.wantPlayer
      .addBuildingToNearbyFederation(building, hex, this.map)
      .filter((h) => this.hasBuildingValue(h)).length;
  }

  process(e: ExtractLogArg<any>): number {
    if (this.map == null) {
      this.map = new SpaceMap();
      this.map.grid = new Grid<GaiaHex>();
      this.map.placement = e.data.map.placement;
      this.map.grid.push(
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
        const hexes = this.wantPlayer.hexesForFederationLocation(e.cmd.args[0], this.map);
        const gaiaHexes = hexes.filter((h) => h.addToFederationOf(this.wantPlayer.player) && this.hasBuildingValue(h));
        return gaiaHexes.length;
      case Command.Build:
        return this.addBuilding(e.cmd.args[1], e.cmd.args[0] as Building);
      case Command.PlaceLostPlanet:
        return this.addBuilding(e.cmd.args[0], Building.Mine);
    }
    return 0;
  }
}

const structureFed: FinalScoringExtractLog = ExtractLog.wrapper((wantPlayer) => {
  const simulator = new FederationSimulator(wantPlayer);

  return ExtractLog.filterPlayer((e) => {
    return simulator.process(e);
  });
});

const satellites: FinalScoringExtractLog = ExtractLog.wrapper((wantPlayer) => {
  let last = 0;

  function subtractLast(s: number) {
    if (wantPlayer.faction != Faction.Ivits) {
      return s;
    }
    const result = s - last;
    last = s;
    return result;
  }

  const simulator = new FederationSimulator(wantPlayer);

  return ExtractLog.filterPlayer((e) => {
    simulator.process(e);

    switch (e.cmd.command) {
      case Command.FormFederation:
        const hexes = wantPlayer.hexesForFederationLocation(e.cmd.args[0], simulator.map);
        return subtractLast(
          hexes.filter((h) => !h.colonizedBy(wantPlayer.player) && h.data.building !== Building.SpaceStation).length
        );
      case Command.Build:
        const building = e.cmd.args[0] as Building;
        return building == Building.SpaceStation ? 1 : 0;
    }
    return 0;
  });
});

const planetTypes: FinalScoringExtractLog = ExtractLog.wrapper(() => {
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
  );
});

const sectors: FinalScoringExtractLog = ExtractLog.wrapper(() => {
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
  );
});

export const finalScoringSources: { [key in FinalTile]: FinalScoringSource } = {
  [FinalTile.Gaia]: colorCodes.gaia.add({
    name: "Gaia planets",
    contributors: ["Regular Building"],
    extractLog: planetCounter(
      () => false,
      () => false,
      (p) => p == Planet.Gaia,
      false
    ),
  }),
  [FinalTile.PlanetType]: colorCodes.planetType.add({
    contributors: ["Regular Building", "Lost Planet"],
    name: "Planet Types",
    extractLog: planetTypes,
  }),
  [FinalTile.Sector]: colorCodes.sector.add({
    contributors: ["Regular Building", "Lost Planet", "Lantids Guest Mine"],
    name: "Sectors",
    extractLog: sectors,
  }),
  [FinalTile.Satellite]: colorCodes.satellite.add({
    contributors: ["Satellite", "Space Station"],
    name: "Satellites",
    extractLog: satellites,
  }),
  [FinalTile.Structure]: {
    contributors: ["Regular Building", "Lost Planet", "Lantids Guest Mine"],
    shortcut: "R",
    name: "Structures",
    color: "--recent",
    extractLog: planetCounter(
      () => true,
      () => true,
      () => true,
      false
    ),
  },
  [FinalTile.StructureFed]: colorCodes.federation.add({
    contributors: ["Regular Building", "Lost Planet", "Lantids Guest Mine"],
    name: "Structures in federations",
    extractLog: structureFed,
  }),
};

export const finalScoringExtractLog: ExtractLog<ChartSource<FinalTile>> = ExtractLog.wrapper(
  (p, s) => Object.entries(finalScoringSources).find(([tile, extractLog]) => tile == s.type)[1].extractLog
);

export const finalScoringSourceFactory = (finalTiles: FinalTile[]): SimpleSourceFactory<ChartSource<FinalTile>> => ({
  name: "Final Scoring Conditions",
  summary: ChartSummary.total,
  playerSummaryLineChartTitle: "All final Scoring Conditions of all players (not only the active ones)",
  extractLog: finalScoringExtractLog,
  sources: Object.keys(finalScoringSources).map((tile) => ({
    type: tile as FinalTile,
    label: finalScoringSources[tile].name + (finalTiles.includes(tile as FinalTile) ? " (active)" : ""),
    color: finalScoringSources[tile].color,
    weight: 1,
  })),
});
