import Engine, {
  AdvTechTile,
  BoardAction,
  Booster,
  Building,
  federations,
  Planet,
  Player,
  PlayerData,
  PlayerEnum,
  PowerArea,
  ResearchField,
  Resource,
  Resource as ResourceEnum,
  Reward,
  ScoringTile,
  TechTile,
  TechTilePos,
  tiles,
} from "@gaia-project/engine";
import { BvTableField, BvTableFieldArray } from "bootstrap-vue/src/components/table";
import { countBy, sortBy } from "lodash";
import { boardActionData } from "../data/actions";
import { boosterData } from "../data/boosters";
import { allBuildings, buildingData, buildingShortcut } from "../data/building";
import { factionName } from "../data/factions";
import { federationData } from "../data/federations";
import { planetNames, remainingPlanets } from "../data/planets";
import { researchNames } from "../data/research";
import { resourceData, showIncome, translateAbbreviatedResources, translateResources } from "../data/resources";
import { roundScoringData } from "../data/round-scorings";
import { leechNetwork, sectors } from "../data/stats";
import { techTileData } from "../data/tech-tiles";
import { CellStyle, planetColorVar, playerColor, staticCellStyle } from "../graphics/colors";
import { lightenDarkenColor } from "../graphics/utils";
import { UiMode } from "../store";
import { finalScoringSources } from "./charts/final-scoring";

export type Cell = {
  label: string;
  title: string;
  color?: string | CellStyle;
  deactivated?: boolean;
  class?: string;
  convert?: ResourceEnum | PowerArea;
};

export type ConversionSupport = {
  convertTooltip(resource: ResourceEnum | PowerArea, player: PlayerEnum): string | null;
};

export type AdditionalHeader = Cell & { colspan: number };

export type InfoTable = {
  caption: string;
  fields: BvTableFieldArray;
  rows: any[];
  additionalHeader?: AdditionalHeader[];
  break?: boolean;
};

const emptyCell: Cell = {
  label: "",
  title: "",
};

type CellContent = string | number | Cell;

type PlayerColumn = Cell & {
  cell: (p: Player, passed: boolean) => CellContent;
  additionalHeader?: Cell;
};

type PlayerTable = {
  caption: string;
  columns: PlayerColumn[];
};

type GeneralTable = {
  caption: string;
  columns: { header: Cell; row: Cell }[];
};

type TableSettings = {
  sortable: boolean;
  rowHeaderOnAllColumns: boolean;
  caption: boolean;
};

const uiModeSettings: { [key in UiMode]?: TableSettings } = {
  [UiMode.table]: {
    sortable: false,
    rowHeaderOnAllColumns: false,
    caption: true,
  },
  [UiMode.compactTable]: {
    sortable: false,
    rowHeaderOnAllColumns: false,
    caption: false,
  },
};

const stripUnderline = new RegExp("<u>(.*?)</u>", "g");

function deactivated(s: string, deactivated = true): string {
  return deactivated ? `<s><i>${s}</i></s>` : s;
}

function resolveCellColor(color: string | CellStyle): CellStyle {
  if (typeof color === "object") {
    return color;
  } else if (color.startsWith("--")) {
    return staticCellStyle(color);
  } else {
    return {
      backgroundColor: color,
      color: "white",
    };
  }
}

function inlineCellStyle(c: Cell): string {
  const cellColor = c?.color ? resolveCellColor(c.color) : null;
  const color = cellColor ? `color: ${cellColor.color}; background: ${cellColor.backgroundColor};` : "";
  return `style="${color}"`;
}

function formatCell(content: CellContent): string {
  const c: Cell = typeof content === "object" ? content : null;
  const style = inlineCellStyle(c);
  const title = c?.title ? `title="${c.title}"` : "";
  const value = deactivated(c?.label ?? content?.toString() ?? "", c?.deactivated ?? false);
  return `<div class="${c?.class ?? "cell"}" ${title} ${style}>${value}</div>`;
}

function multiCell(cells: Cell[]): Cell {
  if (cells.length == 0) {
    cells = [emptyCell];
  }
  const content = cells
    .map(
      (c, i) =>
        `<td title="${c.title}" style="border-width:0 0 0 ${i > 0 ? "1px" : "0"}; padding: 0">${formatCell(c)}</td>`
    )
    .join("");
  return {
    label: `<table><tr>${content}</tr></table>`,
    title: "",
    class: "",
  };
}

function boosterCell(b: Booster): Cell {
  return {
    label: boosterData[b].abbreviation.toUpperCase(),
    title: boosterData[b].name,
    color: boosterData[b].color,
  };
}

function resourceCell(r: Resource | PowerArea): Cell {
  const d = resourceData[r];
  if (d) {
    return {
      label: d.shortcut.toUpperCase(),
      title: d.plural,
      color: d.color,
    };
  }
  if (r == PowerArea.Gaia) {
    return {
      label: "G",
      title: "Power area gaia",
      color: "--gaia",
    };
  }
  const area = r.substring(r.length - 1);
  return {
    label: area,
    title: `Power area ${area}`,
    color: lightenDarkenColor("#984ff1", Number(area) * -40),
  };
}

function incomeCell(
  r: Resource | PowerArea,
  val: any,
  income: number,
  player: Player,
  support: ConversionSupport | null,
  showIncome = true
): Cell {
  const cell = resourceCell(r);
  const tooltip = support?.convertTooltip(r, player.player)?.replace(stripUnderline, (match, group) => group);
  return {
    label: showIncome && income ? `${val}+${income}` : val,
    title: tooltip ? `${cell.title} (${tooltip})` : cell.title,
    color: cell.color,
  };
}

function resourceColumn(r: Resource, showIncome: (Player) => boolean, support: ConversionSupport | null): PlayerColumn {
  const cell = resourceCell(r);
  return {
    label: cell.label,
    title: cell.title,
    color: cell.color,
    cell: (p) => incomeCell(r, p.data.getResources(r), p.resourceIncome(r), p, support, showIncome(p)),
    convert: r,
  };
}

function powerArea(a: PowerArea, d: PlayerData) {
  return d.brainstone == a ? `${d.power[a]},B` : d.power[a];
}

function playerCell(p: Player | null, showPassed: boolean, engine: Engine): Cell {
  if (p == null) {
    return {
      label: "-",
      title: "Available",
    };
  }
  const f = p.faction;
  return {
    label: f?.substring(0, 1).toUpperCase() ?? "",
    title: f ? factionName(f) : "",
    color: f ? playerColor(p, true).color : null,
    deactivated: showPassed && (engine.passedPlayers || []).includes(p.player),
  };
}

function general(engine: Engine): PlayerTable {
  return {
    caption: "General",
    columns: [
      {
        label: "C",
        title: "Current Player",
        cell: (p) => (engine.playerToMove === p.player ? "*" : ""),
      },
      {
        label: "B",
        title: "Booster",
        cell: (p) => (p.data.tiles.booster ? boosterCell(p.data.tiles.booster) : null),
      },
      {
        label: "A",
        title: "Actions",
        cell: (p, passed) =>
          multiCell(
            p.actions.map((a) => {
              const r = Reward.parse(a.rewards);
              return {
                label: translateAbbreviatedResources(r),
                title: translateResources(r, false),
                color: resourceData[r[0].type].color,
                deactivated: !a.enabled || passed,
              };
            })
          ),
      },
      resourceColumn(Resource.VictoryPoint, () => false, null),
    ],
  };
}

function resources(engine: Engine, support: ConversionSupport): PlayerTable {
  return {
    caption: "Resources",
    columns: [Resource.Credit, Resource.Ore, Resource.Knowledge, Resource.Qic].map((r) =>
      resourceColumn(r, (p) => showIncome(engine, p), support)
    ),
  };
}

function power(engine: Engine, support: ConversionSupport): PlayerTable {
  return {
    caption: "Power",
    columns: Object.values(PowerArea).map((a) => {
      const cell = resourceCell(a);
      return {
        label: cell.label,
        title: cell.title,
        color: cell.color,
        convert: a,
        cell: (p) => {
          switch (a) {
            case PowerArea.Area1:
              return incomeCell(
                a,
                powerArea(a, p.data),
                p.resourceIncome(Resource.GainToken),
                p,
                support,
                showIncome(engine, p)
              );
            case PowerArea.Area2:
              return incomeCell(
                a,
                powerArea(a, p.data),
                p.resourceIncome(Resource.ChargePower),
                p,
                support,
                showIncome(engine, p)
              );
            case PowerArea.Area3:
              return incomeCell(a, powerArea(a, p.data), 0, p, support, false);
            case PowerArea.Gaia:
              return incomeCell(
                a,
                p.data.gaiaformersInGaia ? `${p.data.power.gaia}, ${p.data.gaiaformersInGaia}gf` : p.data.power.gaia,
                0,
                p,
                support,
                false
              );
          }
        },
      };
    }),
  };
}

function buildings(engine: Engine): PlayerTable {
  return {
    caption: "Buildings",
    columns: allBuildings(engine.expansions, true).map((b) => ({
      label: buildingShortcut(b).toUpperCase(),
      title: buildingData[b].name,
      color: buildingData[b].color,
      cell: (p) =>
        b == Building.GaiaFormer
          ? `${p.data.gaiaformers - p.data.buildings.gf - p.data.gaiaformersInGaia}/${p.data.gaiaformers}`
          : p.data.buildings[b],
    })),
  };
}

function techCell(t: TechTile | AdvTechTile, remaining: number) {
  const d = techTileData(t);
  return {
    label: deactivated(d.abbreviation, remaining == 0).toUpperCase(),
    title: d.name,
    color: d.color,
  };
}

function research(engine: Engine): PlayerTable {
  return {
    caption: "Research",
    columns: [
      {
        label: "F",
        title: "Green Federations",
        color: "--federation",
        cell: (p) => p.data.tiles.federations.filter((f) => f.green).length,
        additionalHeader: engine.terraformingFederation
          ? {
              label: federationData[engine.terraformingFederation].shortcut.toUpperCase(),
              title: `Terraforming Federation: ${tiles.federations[engine.terraformingFederation]}`,
              color: federationData[engine.terraformingFederation].color,
            }
          : {
              label: "-",
              title: "Terraforming Federation already taken",
            },
      } as PlayerColumn,
    ].concat(
      ...ResearchField.values(engine.expansions).map((f) => {
        return {
          label: f.substring(0, 1).toUpperCase(),
          title: researchNames[f],
          color: `--rt-${f}`,
          cell: (p) => p.data.research[f],
          additionalHeader: multiCell(
            [engine.tiles.techs[f], engine.tiles.techs["adv-" + f]]
              .filter((t) => t)
              .map((t) => techCell(t.tile, t.count))
          ),
        };
      })
    ),
  };
}

function finals(engine: Engine): PlayerTable {
  return {
    caption: "Finals",
    columns: engine.tiles.scorings.final.map((f) => ({
      label: finalScoringSources[f].abbreviation.toUpperCase(),
      title: `Final Scoring: ${finalScoringSources[f].name}`,
      color: finalScoringSources[f].color,
      cell: (p) => p.progress(f),
    })),
  };
}

function assets(engine: Engine): PlayerTable {
  return {
    caption: "Asserts",
    columns: [
      {
        label: "T",
        title: "Tech Tiles",
        color: "--tech-tile",
        cell: (p) =>
          multiCell(
            sortBy(
              sortBy(
                p.data.tiles.techs.map((t) => techCell(t.tile, 1)),
                "label"
              ),
              (s) => s.label.length
            )
          ),
        additionalHeader: multiCell(
          TechTilePos.values()
            .filter((p) => p.startsWith("free"))
            .map((p) => engine.tiles.techs[p])
            .filter((t) => t)
            .map((t, i) => {
              const c = techCell(t.tile, t.count);
              c.title = `Free Tech ${i + 1}: ${c.title}`;
              return c;
            })
        ),
      },
      {
        label: "F",
        title: "Federations",
        color: "--federation",
        cell: (p) =>
          multiCell(
            sortBy(p.data.tiles.federations.map((f) => f.tile)).map((f) => ({
              label: federationData[f].shortcut.toUpperCase(),
              title: federations[f],
              color: federationData[f].color,
            }))
          ),
      },
    ],
  };
}

function planets(engine: Engine): PlayerTable {
  if (!engine.map) {
    return null;
  }

  const count = new Map(
    engine.players.map((p) => [
      p.player,
      countBy(
        Array.from(engine.map.grid.values()).filter(
          (hex) => hex.data.planet !== Planet.Empty && hex.data.player == p.player
        ),
        "data.planet"
      ),
    ])
  );

  return {
    caption: "Planets",
    columns: [
      {
        label: "",
        title: "Planet types, except transdim",
        cell: (p) => Object.keys(count.get(p.player)).filter((p) => p != Planet.Transdim).length,
        additionalHeader: emptyCell,
      } as PlayerColumn,
    ].concat(
      ...Object.values(Planet)
        .filter((planet) => planet != Planet.Empty)
        .map((planet) => {
          const color = planetColorVar(planet, false);
          return {
            label: planet.toUpperCase(),
            title: planetNames[planet],
            color,
            cell: (p) => count.get(p.player)[planet] ?? "",
            additionalHeader: {
              label: String(remainingPlanets(planet, engine)),
              title: `Remaining ${planetNames[planet]} Planets`,
              color,
            },
          };
        })
    ),
  };
}

function stats(engine: Engine): PlayerTable {
  return {
    caption: "Stats",
    columns: [
      {
        label: "E",
        title: "Sectors with a colonized planet",
        color: "--tech-tile",
        cell: (p) => sectors(p),
      },
      {
        label: "A",
        title: "Satellites and space stations",
        color: "--current-round",
        cell: (p) => p.data.satellites + p.data.buildings.sp,
      },
      {
        label: "I",
        title: "Power value of structures in federations",
        color: "--oxide",
        cell: (p) => p.fedValue,
      },
      {
        label: "F",
        title: "Power value of structures outside of federations",
        color: "--federation",
        cell: (p) => p.structureValue - p.fedValue,
      },
      {
        label: "L",
        title: "Leech network",
        color: "--res-power",
        cell: (p) => leechNetwork(engine, p.player),
      },
    ],
  };
}

function playerTables(engine: Engine, support: ConversionSupport): PlayerTable[] {
  return [
    general(engine),
    resources(engine, support),
    power(engine, support),
    research(engine),
    finals(engine),
    buildings(engine),
    assets(engine),
    planets(engine),
    stats(engine),
  ].filter((t) => t);
}

function generalTables(engine: Engine): GeneralTable[] {
  return [
    {
      caption: "Board Actions",
      columns: BoardAction.values(engine.expansions).map((a) => ({
        header: {
          label: boardActionData[a].shortcut.toUpperCase(),
          title: boardActionData[a].name,
          color: boardActionData[a].color,
        },
        row: playerCell(
          engine.boardActions[a] != null && engine.boardActions[a] !== PlayerEnum.Player5
            ? engine.player(engine.boardActions[a])
            : null,
          false,
          engine
        ),
      })),
    },
    {
      caption: "Round",
      columns: [null as ScoringTile].concat(...engine.tiles.scorings.round).map((r, round) => ({
        header: {
          label: String(round),
          title: `Round ${round}`,
          color: engine.round == round && !engine.ended ? "--current-round" : null,
        },
        row:
          round == 0
            ? null
            : {
                label: `<b>${roundScoringData[r].abbreviation.toUpperCase()}</b>`,
                title: roundScoringData[r].name,
                color: roundScoringData[r].color,
              },
      })),
    },
    {
      caption: "Boosters",
      columns: Booster.values(engine.expansions)
        .filter((b) => engine.tiles.boosters[b] != null)
        .map((b) => ({
          header: boosterCell(b),
          row: playerCell(
            engine.players.find((p) => p.data.tiles.booster == b),
            false,
            engine
          ),
        })),
    },
    {
      caption: "Federations",
      columns: Object.entries(engine.tiles.federations).map(([fed, count]) => ({
        header: {
          label: federationData[fed].shortcut.toUpperCase(),
          title: tiles.federations[fed],
          color: federationData[fed].color,
        },
        row: {
          label: String(count),
          title: "Number of federations left",
          color: federationData[fed].color,
        },
      })),
    },
  ];
}

function field(c: Cell, sortable: boolean): { key: string } & BvTableField {
  const style = c.color && !c.deactivated ? (resolveCellColor(c.color) as any) : {};
  style.padding = "2px";
  const column = {
    key: c.title,
    label: deactivated(c.label, c.deactivated ?? false),
    thStyle: style,
    headerTitle: c.title,
    sortable,
  };
  (column as any).convert = c.convert;
  return column;
}

export function infoTables(
  engine: Engine,
  orderedPlayers: Player[],
  uiMode: UiMode,
  support: ConversionSupport
): InfoTable[] {
  const settings = uiModeSettings[uiMode];
  function caption(s: string): string | null {
    return settings.caption ? s : null;
  }

  function createRows(createRow: (p: Player, passed: boolean) => any): any[] {
    return orderedPlayers.map((p) => {
      const passed = (engine.passedPlayers || []).includes(p.player);
      const row = createRow(p, passed);
      for (const key of Object.keys(row)) {
        row[key] = formatCell(row[key]);
      }
      row.order = formatCell(playerCell(p, true, engine));
      return row;
    });
  }

  const gTables: InfoTable[] = generalTables(engine).map((t) => {
    const row = {};
    for (const column of t.columns) {
      row[column.header.title] = formatCell(column.row);
    }
    return {
      caption: caption(t.caption),
      fields: t.columns.map((c) => field(c.header, false)),
      rows: [row],
    };
  });
  gTables[gTables.length - 1].break = true;

  const pTables: InfoTable[] = playerTables(engine, support).map((t) => ({
    caption: caption(t.caption),
    fields: t.columns.map((c) => field(c, settings.sortable)),
    additionalHeader: t.columns
      .filter((c) => c.additionalHeader)
      .map(
        (c) =>
          ({
            label: formatCell(c.additionalHeader),
            title: c.additionalHeader.title,
            colspan: 1,
          } as AdditionalHeader)
      ),
    rows: createRows((p, passed) => {
      const row = {};
      for (const column of t.columns) {
        const cell = column.cell(p, passed);
        row[column.title] =
          typeof cell == "object"
            ? cell
            : {
                label: cell,
                title: column.title,
                color: column.color,
              };
      }
      return row;
    }),
  }));
  pTables.forEach((r, i) => {
    const extraColumns: number = settings.rowHeaderOnAllColumns || i == 0 ? 1 : 0;
    if (extraColumns) {
      r.fields.unshift({
        key: "order",
        sortable: settings.sortable,
        label: "",
        headerTitle: "Player Order",
      });
    }
    if (r.additionalHeader.length == 0 || extraColumns) {
      r.additionalHeader.unshift({
        label: formatCell(""), //this makes sure that all tables have the same height
        title: "",
        colspan: r.additionalHeader.length == 0 ? r.fields.length + extraColumns : extraColumns,
      });
    }
  });
  return gTables.concat(...pTables);
}
