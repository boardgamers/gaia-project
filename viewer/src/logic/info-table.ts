import Engine, {
  AdvTechTile,
  BoardAction,
  Booster,
  Building,
  Event,
  factionBoard,
  factionVariantBoard,
  federations,
  Operator,
  Planet,
  Player,
  PlayerData,
  PlayerEnum,
  PowerArea,
  ResearchField,
  researchTracks,
  Resource,
  Resource as ResourceEnum,
  Reward,
  ScoringTile,
  TechTile,
  TechTilePos,
  tiles,
} from "@gaia-project/engine";
import { BvTableField } from "bootstrap-vue/src/components/table";
import { countBy, sortBy } from "lodash";
import { boardActionData } from "../data/actions";
import { boosterData } from "../data/boosters";
import { allBuildings, buildingData, buildingName, buildingShortcut, gaiaFormerCost } from "../data/building";
import { eventDesc } from "../data/event";
import { buildingDesc, factionName } from "../data/factions";
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
import { colorCodes } from "./color-codes";

export type Convert = ResourceEnum | PowerArea;

export enum InfoTableFlex {
  row = "row",
  rowGrow = "rowGrow",
  column = "column",
}

export type InfoTableCell = {
  label: string;
  title: string | null;
  style: string;
  convert?: Convert;
  flex: InfoTableFlex;
};

export type InfoTableRow = {
  [key in string]: InfoTableCell[];
};

export type InfoTableAdditionalHeader = { cells: InfoTableCell[]; colspan: number };

export type InfoTableColumn = BvTableField & { key: string; cells: InfoTableCell[] };

export type InfoTable = {
  caption: string;
  fields: Array<InfoTableColumn>;
  rows: InfoTableRow[];
  additionalHeader?: InfoTableAdditionalHeader[];
  break?: boolean;
};

export type ConversionSupport = {
  convertTooltip(resource: Convert, player: PlayerEnum): string | null;
};

type Cell = {
  shortcut: string;
  title: string;
  color: string | CellStyle;
  deactivated?: boolean;
  convert?: Convert;
};

const defaultBackground = "white";

const emptyCell: Cell = {
  shortcut: "",
  title: "",
  color: defaultBackground,
};

type CellContent = string | number | Cell[];

type PlayerColumn = Cell & {
  cell: (p: Player, passed: boolean) => CellContent;
  additionalHeader?: { cells: Cell[]; flex?: InfoTableFlex };
  flex?: InfoTableFlex;
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
      color: "black",
    };
  }
}

function inlineCellStyle(c: Cell): string {
  const cellColor = c?.color ? resolveCellColor(c.color) : null;
  return cellColor ? `background: ${cellColor.backgroundColor}; color: ${cellColor.color};` : "";
}

function formatCell(cells: Cell[], flex = InfoTableFlex.rowGrow): InfoTableCell[] {
  return cells.map((c) => {
    const style = inlineCellStyle(c);
    const label = deactivated(c.shortcut?.toString()?.toUpperCase(), c.deactivated ?? false);
    return {
      label,
      style,
      convert: c.convert,
      title: c.title,
      flex,
    };
  });
}

function boosterCell(b: Booster): Cell {
  return {
    shortcut: boosterData[b].shortcut,
    title: boosterData[b].name,
    color: boosterData[b].color,
  };
}

function resourceCell(r: Resource | PowerArea): Cell {
  const d = resourceData[r];
  if (d) {
    return {
      shortcut: d.shortcut,
      title: d.plural,
      color: d.color,
    };
  }
  if (r == PowerArea.Gaia) {
    return colorCodes.gaia.add({
      title: "Power area gaia",
    });
  }
  const area = r.substring(r.length - 1);
  return {
    shortcut: area,
    title: `Power area ${area}`,
    color: {
      color: "white",
      backgroundColor: lightenDarkenColor("#984ff1", Number(area) * -40),
    },
  };
}

function incomeCell(
  r: Resource | PowerArea,
  val: any,
  income: number,
  player: Player,
  support: ConversionSupport | null,
  showIncome: boolean,
  incomeType: string = null
): Cell[] {
  const cell = resourceCell(r);
  const tooltip = support?.convertTooltip(r, player.player)?.replace(stripUnderline, (match, group) => group);
  const hasIncome = showIncome && income;
  if (incomeType && hasIncome) {
    cell.title = `${cell.title} (+${incomeType} income)`;
  }
  if (tooltip) {
    cell.title = `${cell.title} (${tooltip})`;
  }
  return [
    {
      shortcut: hasIncome ? `${val}+${income}` : val,
      title: cell.title,
      color: cell.color,
      convert: tooltip ? r : null,
    },
  ];
}

function resourceColumn(r: Resource, showIncome: (Player) => boolean, support: ConversionSupport | null): PlayerColumn {
  const cell = resourceCell(r);
  return {
    shortcut: cell.shortcut,
    title: cell.title,
    color: cell.color,
    cell: (p) => incomeCell(r, p.data.getResources(r), p.resourceIncome(r), p, support, showIncome(p)),
  };
}

function powerArea(a: PowerArea, d: PlayerData) {
  return d.brainstone == a ? `${d.power[a]},B` : d.power[a];
}

function playerCell(p: Player | null, bold = false): Cell {
  if (p == null) {
    return {
      shortcut: "-",
      title: "Available",
      color: defaultBackground,
    };
  }

  function b(s: string): string {
    return bold ? `<b>${s}</b>` : s;
  }

  const f = p.faction;
  return {
    shortcut: f ? b(f.substring(0, 1)) : "",
    title: f ? factionName(f) : "",
    color: f ? playerColor(p, true).color : null,
  };
}

function general(engine: Engine): PlayerTable {
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
        shortcut: cell.shortcut,
        title: cell.title,
        color: cell.color,
        cell: (p) => {
          switch (a) {
            case PowerArea.Area1:
              return incomeCell(
                a,
                powerArea(a, p.data),
                p.resourceIncome(Resource.GainToken),
                p,
                support,
                showIncome(engine, p),
                "token"
              );
            case PowerArea.Area2:
              return incomeCell(
                a,
                powerArea(a, p.data),
                p.resourceIncome(Resource.ChargePower),
                p,
                support,
                showIncome(engine, p),
                "power charge"
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

function buildingTooltip(p: Player, engine: Engine, b: Building): string {
  const faction = p.faction;
  if (!faction) {
    return "";
  }
  const variant = p?.variant?.board ?? factionVariantBoard(engine.factionCustomization, faction)?.board;
  return ": " + buildingDesc(b, faction, factionBoard(faction, variant), p);
}

function buildings(engine: Engine): PlayerTable {
  return {
    caption: "Buildings",
    columns: allBuildings(engine.expansions, true).map((b) => {
      const color = buildingData[b].color;
      const title = buildingData[b].name;
      return {
        shortcut: buildingShortcut(b),
        title,
        color,
        cell: (p) => [
          {
            shortcut:
              b == Building.GaiaFormer
                ? `${p.data.gaiaformers - p.data.buildings.gf - p.data.gaiaformersInGaia}/${p.data.gaiaformers}`
                : String(p.data.buildings[b]),
            title: `${buildingName(b, p.faction)}${buildingTooltip(p, engine, b)}`,
            color,
          },
        ],
      };
    }),
  };
}

function techCell(t: TechTile | AdvTechTile, remaining: number): Cell {
  const d = techTileData(t);
  return {
    shortcut: deactivated(d.shortcut, remaining == 0),
    title: d.name,
    color: d.color,
  };
}

function researchLevelTitle(events: string[], field: ResearchField, level: number): string {
  const effects = events
    .map((s) => new Event(s))
    .filter((e) => !e.rewards.some((r) => r.type == Resource.ShipRange))
    .map((e) => eventDesc(e));

  if (level == 5) {
    switch (field) {
      case ResearchField.Terraforming:
        effects.push("Immediately gain the terraforming federation");
        break;
      case ResearchField.Navigation:
        effects.push("Immediately place the lost planet");
    }
  }
  if (field == ResearchField.GaiaProject) {
    const c = gaiaFormerCost.get(level);
    if (c) {
      effects.push("Gaia former cost: " + c);
    }
  }
  if (effects.length == 0) {
    return null;
  }

  return `Level ${level}: ${effects.join(", ")}`;
}

function research(engine: Engine): PlayerTable {
  return {
    caption: "Research",
    columns: [
      colorCodes.federation.add<PlayerColumn>({
        title: "Green Federations",
        cell: (p) => p.data.tiles.federations.filter((f) => f.green).length,
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
    ].concat(
      ...ResearchField.values(engine.expansions).map((f) => ({
        shortcut: f.substring(0, 1),
        title: `${researchNames[f]} (${researchTracks[f]
          .map((events, level) => researchLevelTitle(events, f, level))
          .filter((e) => e)
          .join(", ")})`,
        color: `--rt-${f}`,
        cell: (p) => p.data.research[f],
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

function finals(engine: Engine): PlayerTable {
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

function assets(engine: Engine): PlayerTable {
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
          cells: TechTilePos.values()
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
            title: federations[f],
            color: federationData[f].color,
          })),
      }),
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
        shortcut: "",
        color: defaultBackground,
        title: "Planet types, except transdim",
        cell: (p) => Object.keys(count.get(p.player)).filter((p) => p != Planet.Transdim).length,
        additionalHeader: { cells: [emptyCell] },
      } as PlayerColumn,
    ].concat(
      ...Object.values(Planet)
        .filter((planet) => planet != Planet.Empty)
        .map((planet) => {
          const color = planetColorVar(planet, false);
          return {
            shortcut: planet,
            title: planetNames[planet],
            color,
            cell: (p) => count.get(p.player)[planet] ?? "",
            additionalHeader: {
              cells: [
                {
                  shortcut: String(remainingPlanets(planet, engine)),
                  title: `Remaining ${planetNames[planet]} Planets`,
                  color,
                },
              ],
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
      colorCodes.sector.add({
        title: "Sectors with a colonized planet",
        cell: (p) => sectors(p),
      }),
      colorCodes.satellite.add({
        title: "Satellites and space stations",
        cell: (p) => p.data.satellites + p.data.buildings.sp,
      }),
      {
        shortcut: "I",
        title: "Power value of structures in federations",
        color: "--oxide",
        cell: (p) => p.fedValue,
      },
      colorCodes.federation.add({
        title: "Power value of structures outside of federations",
        cell: (p) => p.structureValue - p.fedValue,
      }),
      {
        shortcut: "L",
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
          shortcut: boardActionData[a].shortcut,
          title: boardActionData[a].name,
          color: boardActionData[a].color,
        },
        row: playerCell(
          engine.boardActions[a] != null && engine.boardActions[a] !== PlayerEnum.Player5
            ? engine.player(engine.boardActions[a])
            : null
        ),
      })),
    },
    {
      caption: "Round",
      columns: [null as ScoringTile].concat(...engine.tiles.scorings.round).map((r, round) => ({
        header: {
          shortcut: String(round),
          title: `Round ${round}`,
          color: engine.round == round && !engine.ended ? "--current-round" : null,
        },
        row:
          round == 0
            ? emptyCell
            : {
                shortcut: `<b>${roundScoringData[r].shortcut}</b>`,
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
          row: playerCell(engine.players.find((p) => p.data.tiles.booster == b)),
        })),
    },
    {
      caption: "Federations",
      columns: Object.entries(engine.tiles.federations).map(([fed, count]) => ({
        header: {
          shortcut: federationData[fed].shortcut,
          title: tiles.federations[fed],
          color: federationData[fed].color,
        },
        row: {
          shortcut: String(count),
          title: "Number of federations left",
          color: federationData[fed].color,
        },
      })),
    },
  ];
}

function field(c: Cell, sortable: boolean): InfoTableColumn {
  return {
    key: c.title,
    label: deactivated(c.shortcut?.toUpperCase(), c.deactivated ?? false),
    sortable,
    cells: formatCell([c]),
  };
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

  function createRows(createRow: (p: Player, passed: boolean) => InfoTableRow): InfoTableRow[] {
    return orderedPlayers.map((p) => {
      const passed = (engine.passedPlayers || []).includes(p.player);
      const row = createRow(p, passed);
      row.order = formatCell([playerCell(p, true)]);
      return row;
    });
  }

  const gTables: InfoTable[] = generalTables(engine).map((t) => {
    const row: InfoTableRow = {};
    for (const column of t.columns) {
      row[column.header.title] = formatCell([column.row]);
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
      .map((c) => ({
        cells: formatCell(c.additionalHeader.cells, c.additionalHeader.flex),
        colspan: 1,
      })),
    rows: createRows((p, passed) => {
      const row: InfoTableRow = {};
      for (const column of t.columns) {
        const cell = column.cell(p, passed);
        row[column.title] = formatCell(
          typeof cell == "object"
            ? ((cell.length == 0 ? [emptyCell] : cell) as Cell[])
            : [
                {
                  shortcut: String(cell),
                  title: column.title,
                  color: column.color,
                },
              ],
          column.flex ?? InfoTableFlex.rowGrow
        );
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
        cells: formatCell([
          {
            shortcut: "",
            title: "Faction in play order",
            color: defaultBackground,
          },
        ]),
      });
    }
  });
  return gTables.concat(...pTables);
}
