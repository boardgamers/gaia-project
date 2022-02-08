import Engine, { TechTilePos } from "@gaia-project/engine";
import { federationRewards } from "@gaia-project/engine/src/tiles/federations";
import { sortBy } from "lodash";
import { federationData } from "../../data/federations";
import { leechNetwork, sectors } from "../../data/stats";
import { finalScoringSources } from "../charts/final-scoring";
import { colorCodes } from "../color-codes";
import { techCell } from "./research";
import { InfoTableFlex, PlayerTable } from "./types";
import { skipZero } from "./util";

export function assets(engine: Engine): PlayerTable {
  return {
    caption: "Asserts",
    columns: [
      {
        shortcut: "T",
        title: "Tech Tiles",
        color: "--tech-tile",
        flex: InfoTableFlex.row,
        cell: (p) =>
          sortBy(
            sortBy(
              p.data.tiles.techs.map((t) => techCell(t.tile, 1)),
              "shortcut"
            ),
            (s) => s.shortcut.length
          ),
        additionalHeader: {
          cells: TechTilePos.values(engine.expansions)
            .filter((p) => p.startsWith("free"))
            .map((p) => engine.tiles.techs[p])
            .filter((t) => t)
            .map((t, i) => {
              const c = techCell(t.tile, t.count);
              c.title = `Free Tech ${i + 1}: ${c.title}`;
              return c;
            }),
          flex: InfoTableFlex.row,
        },
      },
      colorCodes.federation.add({
        title: "Federations",
        flex: InfoTableFlex.row,
        cell: (p) =>
          sortBy(p.data.tiles.federations.map((f) => f.tile)).map((f) => ({
            shortcut: federationData[f].shortcut,
            title: federationRewards(f).join(","),
            color: federationData[f].color,
          })),
      }),
    ],
  };
}

export function stats(engine: Engine): PlayerTable {
  return {
    caption: "Stats",
    columns: [
      colorCodes.sector.add({
        title: "Sectors with a colonized planet",
        cell: (p) => skipZero(sectors(p)),
      }),
      colorCodes.satellite.add({
        title: "Satellites and space stations",
        cell: (p) => skipZero(p.data.satellites + p.data.buildings.sp),
      }),
      {
        shortcut: "I",
        title: "Power value of structures in federations",
        color: "--oxide",
        cell: (p) => skipZero(p.fedValue),
      },
      colorCodes.federation.add({
        title: "Power value of structures outside of federations",
        cell: (p) => skipZero(p.structureValue - p.fedValue),
      }),
      {
        shortcut: "L",
        title: "Leech network",
        color: "--res-power",
        cell: (p) => skipZero(leechNetwork(engine, p.player)),
      },
    ],
  };
}

export function finals(engine: Engine): PlayerTable {
  return {
    caption: "Finals",
    columns: engine.tiles.scorings.final.map((f) => ({
      shortcut: finalScoringSources[f].shortcut,
      title: `Final Scoring: ${finalScoringSources[f].name}`,
      color: finalScoringSources[f].color,
      cell: (p) => p.progress(f),
    })),
  };
}
