import Engine, { Operator, Resource, Reward } from "@gaia-project/engine";
import { boosterData } from "../../data/boosters";
import { resourceData, showIncome, translateAbbreviatedResources, translateResources } from "../../data/resources";
import { techTileData } from "../../data/tech-tiles";
import { buildings } from "./buildings";
import { boosterCell } from "./general";
import { planets } from "./planets";
import { power } from "./power";
import { research } from "./research";
import { resourceColumn } from "./resource";
import { assets, finals, stats } from "./stats";
import { ConversionSupport, defaultBackground, InfoTableFlex, PlayerTable } from "./types";

function general(engine: Engine, compact: boolean, showIncome: (Player) => boolean): PlayerTable {
  return {
    caption: "General",
    columns: [
      {
        shortcut: "C",
        color: "--recent",
        title: "Current Player",
        cell: (p, passed) => {
          if (engine.playerToMove === p.player) {
            return [
              {
                shortcut: "",
                title: "This is the current player",
                color: "--recent",
              },
            ];
          } else if (passed) {
            return [
              {
                shortcut: "",
                title: "The player has passed for the current round",
                color: "--current-round",
              },
            ];
          } else {
            return [
              {
                shortcut: "",
                title: "This is not the current player",
                color: defaultBackground,
              },
            ];
          }
        },
      },
      {
        shortcut: "B",
        color: "--oxide",
        title: "Booster",
        cell: (p) => (p.data.tiles.booster ? [boosterCell(p.data.tiles.booster)] : []),
      },
      {
        shortcut: "A",
        color: "--specialAction",
        title: "Actions",
        flex: InfoTableFlex.row,
        cell: (p, passed) =>
          p.events[Operator.Activate].map((e) => {
            const a = e.action();
            const r = Reward.parse(a.rewards);
            return {
              shortcut:
                boosterData[e.source]?.shortcut ??
                techTileData(engine.tiles.techs[e.source.substring("tech-".length)]?.tile)?.shortcut ??
                translateAbbreviatedResources(r),
              title: translateResources(r, false),
              color: resourceData[r[0].type].color,
              deactivated: !a.enabled || passed,
            };
          }),
      },
      resourceColumn(Resource.VictoryPoint, showIncome, compact, null),
    ],
  };
}

function resources(showIncome: (Player) => boolean, compact: boolean, support?: ConversionSupport): PlayerTable {
  return {
    caption: "Resources",
    columns: [Resource.Credit, Resource.Ore, Resource.Knowledge, Resource.Qic].map((r) =>
      resourceColumn(r, showIncome, compact, support)
    ),
  };
}

export function playerTables(engine: Engine, support: ConversionSupport, compact: boolean): PlayerTable[] {
  const show = (p) => showIncome(engine, p);
  return [
    general(engine, compact, show),
    resources(show, compact, support),
    power(show, compact, support),
    research(engine, true),
    finals(engine),
    buildings(engine, compact),
    assets(engine),
    planets(engine),
    stats(engine),
  ].filter((t) => t);
}

export function logPlayerTables(engine: Engine): PlayerTable[] {
  const show = () => false;
  return [resources(show, false), power(show, false), research(engine, false), buildings(engine, false)].filter(
    (t) => t
  );
}
