import Engine, { AdvTechTile, lastTile, ResearchField, TechTile, tiles } from "@gaia-project/engine";
import { federationData } from "../../data/federations";
import { researchColorVar, researchData, researchLevelDesc } from "../../data/research";
import { techTileData } from "../../data/tech-tiles";
import { colorCodes } from "../color-codes";
import { Cell, defaultBackground, InfoTableFlex, PlayerColumn, PlayerTable } from "./types";
import { deactivated, skipZero } from "./util";

export function techCell(t: TechTile | AdvTechTile, remaining: number): Cell {
  const d = techTileData(t);
  return {
    shortcut: deactivated(d.shortcut, remaining == 0),
    title: d.name,
    color: d.color,
  };
}

export function research(engine: Engine, greenFederations: boolean): PlayerTable {
  return {
    caption: "Research",
    columns: (greenFederations
      ? [
          colorCodes.federation.add<PlayerColumn>({
            title: "Green Federations",
            cell: (p) => skipZero(p.data.tiles.federations.filter((f) => f.green).length),
            additionalHeader: {
              cells: [
                engine.terraformingFederation
                  ? {
                      shortcut: federationData[engine.terraformingFederation].shortcut,
                      title: `Terraforming Federation: ${tiles.federations[engine.terraformingFederation]}`,
                      color: federationData[engine.terraformingFederation].color,
                    }
                  : {
                      shortcut: "-",
                      color: defaultBackground,
                      title: "Terraforming Federation already taken",
                    },
              ],
            },
          }),
        ]
      : []
    ).concat(
      ...ResearchField.values(engine.expansions).map((f) => ({
        shortcut: f.substring(0, 1),
        title: `<b>${researchData[f].name}</b>${[...Array(lastTile(f) + 1).keys()]
          .map((level) => {
            const desc = researchLevelDesc(engine, f, level, false);
            return desc ? `<br/>Level ${level}: ${desc.join(" ")}` : "";
          })
          .join("")}`,
        color: researchColorVar(f),
        cell: (p) => skipZero(p.data.research[f]),
        additionalHeader: {
          cells: [engine.tiles.techs["adv-" + f], engine.tiles.techs[f]]
            .filter((t) => t)
            .map((t) => techCell(t.tile, t.count)),
          flex: InfoTableFlex.column,
        },
      }))
    ),
  };
}
