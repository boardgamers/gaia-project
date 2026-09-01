import {
  Building,
  classifySectorId,
  Command,
  Expansion,
  Faction,
  FinalTile,
  GaiaHex,
  LostFleetSectorType,
  parseLocation,
  Planet,
  Player,
  SpaceMap,
  stdBuildingValue,
} from "@gaia-project/engine";
import { Grid } from "hexagrid";
import { colorCodes } from "../color-codes";
import { BuildingCounter } from "./buildings";
import { ChartSource } from "./charts";
import type { ExtractLogArg, SimpleSourceFactory } from "./simple-charts";
import { ChartSummary, ExtractLog, planetCounter } from "./simple-charts";

type FinalScoringExtractLog = ExtractLog<ChartSource<FinalTile>>;

export type FinalScoringContributor =
  "Regular Building" | "Lost Planet" | "Satellite" | "Space Station" | "Lantids Guest Mine" | "Gaia Former";

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
  const seen = new Set<string>();

  return planetCounter(
    () => true,
    () => true,
    () => true,
    false,
    (cmd, log, planet, location) => {
      // Owner ruling: a Deep Space Sector never counts as a sector for this tile (only real Space
      // Sector tiles do), matching Condition.Sector in the engine (player.ts) - Interspace locations
      // aren't sectors either. Checked via `location` directly instead of `parseLocation`, which only
      // understands base-game "<sector><suffix>" coordinates and throws on Lost Fleet's IS/DS ones.
      if (classifySectorId(location) !== LostFleetSectorType.Space) {
        return 0;
      }
      const key = parseLocation(location).sector;
      if (seen.has(key)) {
        return 0;
      }
      seen.add(key);
      return 1;
    }
  );
});

const asteroids: FinalScoringExtractLog = planetCounter(
  () => false,
  () => false,
  (planet) => planet === Planet.Asteroid,
  false
);

const deepSpaceSectors: FinalScoringExtractLog = ExtractLog.new((want) => {
  const sectors = new Set<string>();
  const transdim = new Set<string>();
  const owners: { [key: string]: Faction } = {};

  return (e) => {
    const cmd = e.cmd;
    if (!cmd) {
      return 0;
    }

    switch (cmd.command) {
      case Command.PlaceLostPlanet: {
        if (cmd.faction !== want.faction) {
          return 0;
        }

        const hex = e.data.map.getS(cmd.args[0]);
        if (classifySectorId(hex.data.sector) !== LostFleetSectorType.DeepSpace) {
          return 0;
        }

        const sectorKey = hex.data.sector.replace(/_\d+$/, "");
        if (sectors.has(sectorKey)) {
          return 0;
        }

        sectors.add(sectorKey);
        return 1;
      }

      case Command.Build: {
        const building = cmd.args[0] as Building;
        const location = cmd.args[1];
        const hex = e.data.map.getS(location);
        const sectorType = classifySectorId(hex.data.sector);
        const owner = owners[location];

        if (owner == null) {
          owners[location] = cmd.faction;
        }

        if (cmd.faction !== want.faction) {
          return 0;
        }

        if (owner !== want.faction && want.faction === Faction.Lantids) {
          return 0;
        }

        if (building === Building.GaiaFormer) {
          transdim.add(location);
          return 0;
        }

        if (
          sectorType === LostFleetSectorType.DeepSpace &&
          (building === Building.Mine ||
            (building === Building.PlanetaryInstitute && want.faction === Faction.Ivits)) &&
          !transdim.has(location)
        ) {
          const sectorKey = hex.data.sector.replace(/_\d+$/, "");
          if (sectors.has(sectorKey)) {
            return 0;
          }

          sectors.add(sectorKey);
          return 1;
        }
      }
    }

    return 0;
  };
});

const piAcademyDistance: FinalScoringExtractLog = ExtractLog.wrapper((want) => {
  const counter = new BuildingCounter();
  let last = 0;

  return ExtractLog.filterPlayer((e) => {
    counter.playerCommand(e.cmd, e.data);

    const pi = counter.planetaryInstituteLocation;
    const academies = Array.from(counter.buildings.entries())
      .filter(([, building]) => building === Building.Academy1 || building === Building.Academy2)
      .map(([hex]) => hex);

    const current =
      pi && academies.length > 0 ? Math.max(...academies.map((academy) => e.data.map.distance(pi, academy))) : 0;

    const delta = current - last;
    last = current;
    return delta;
  });
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
  [FinalTile.Asteroid]: {
    contributors: ["Regular Building"],
    shortcut: "a",
    name: "Asteroids",
    color: "--asteroid",
    extractLog: asteroids,
  },
  [FinalTile.PlanetaryInstituteAcademyDistance]: colorCodes.range.add({
    contributors: ["Regular Building"],
    name: "PI to Academy distance",
    extractLog: piAcademyDistance,
  }),
  [FinalTile.DeepSpaceSector]: {
    contributors: ["Regular Building", "Lost Planet"],
    shortcut: "d",
    name: "Deep Space sectors",
    color: "--lost",
    extractLog: deepSpaceSectors,
  },
};

export const finalScoringExtractLog: ExtractLog<ChartSource<FinalTile>> = ExtractLog.wrapper(
  (p, s) => Object.entries(finalScoringSources).find(([tile, extractLog]) => tile == s.type)[1].extractLog
);

export const finalScoringSourceFactory = (
  finalTiles: FinalTile[],
  expansion: Expansion
): SimpleSourceFactory<ChartSource<FinalTile>> => {
  // Only this game's condition pool: the 3 Lost Fleet conditions exist in
  // finalScoringSources unconditionally and must not leak into base games.
  const inExpansion = FinalTile.values(expansion);
  return {
    name: "Final Scoring Conditions",
    summary: ChartSummary.total,
    playerSummaryLineChartTitle: "All final Scoring Conditions of all players (not only the active ones)",
    extractLog: finalScoringExtractLog,
    sources: Object.keys(finalScoringSources)
      .filter((tile) => inExpansion.includes(tile as FinalTile))
      .map((tile) => ({
        type: tile as FinalTile,
        label: finalScoringSources[tile].name + (finalTiles.includes(tile as FinalTile) ? " (active)" : ""),
        color: finalScoringSources[tile].color,
        weight: 1,
      })),
  };
};
