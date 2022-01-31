import Engine, {
  AdvTechTile,
  BoardAction,
  Booster,
  Building,
  factionBoard,
  factionVariantBoard,
  Federation,
  federations,
  lastTile,
  Operator,
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
import { BvTableField } from "bootstrap-vue/src/components/table";
import { countBy, sortBy } from "lodash";
import { boardActionData } from "../data/actions";
import { boosterData } from "../data/boosters";
import { allBuildings, buildingData, buildingName, buildingShortcut } from "../data/building";
import { buildingDesc, factionName } from "../data/factions";
import { federationData } from "../data/federations";
import { planetNames, remainingPlanets } from "../data/planets";
import { researchColorVar, researchData, researchLevelDesc } from "../data/research";
import { resourceData, showIncome, translateAbbreviatedResources, translateResources } from "../data/resources";
import { roundScoringData } from "../data/round-scorings";
import { leechNetwork, sectors } from "../data/stats";
import { techTileData } from "../data/tech-tiles";
import { CellStyle, planetColorVar, playerColor, staticCellStyle } from "../graphics/colors";
import { lightenDarkenColor, ResourceText } from "../graphics/utils";
import { UiMode } from "../store";
import { finalScoringSources } from "./charts/final-scoring";
import { colorCodes } from "./color-codes";
import { plusReward } from "./utils";

export type Convert = ResourceEnum | PowerArea;

export enum InfoTableFlex {
  row = "row",
  rowGrow = "rowGrow",
  column = "column",
}

export type InfoTableCell = {
  label: ResourceText;
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
  fields: InfoTableColumn[];
  rows: InfoTableRow[];
  additionalHeader?: InfoTableAdditionalHeader[];
  break?: boolean;
};

export type ConversionSupport = {
  convertTooltip(resource: Convert, player: PlayerEnum): string | null;
};

type Cell = {
  shortcut: string | ResourceText;
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

export type PlayerColumn = Cell & {
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

export function cellStyle(color: string | CellStyle): string {
  const cellColor = color ? resolveCellColor(color) : null;
  return cellColor ? `background: ${cellColor.backgroundColor}; color: ${cellColor.color};` : "";
}

function deactivatedLabel(c: Cell) {
  return deactivated(c.shortcut?.toString()?.toUpperCase(), c.deactivated ?? false);
}

function formatCell(cells: Cell[], flex = InfoTableFlex.rowGrow): InfoTableCell[] {
  return cells.map((c) => {
    const style = cellStyle(c?.color);
    return {
      label: typeof c.shortcut === "string" ? [deactivatedLabel(c)] : c.shortcut,
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

function skipZero(val: string | number): string {
  return String(val) !== "0" ? String(val) : "";
}

function incomeCell(
  r: Resource | PowerArea,
  val: string | number,
  income: number,
  player: Player,
  support: ConversionSupport | null,
  compact: boolean,
  incomeType: string = null
): Cell[] {
  const cell = resourceCell(r);
  const tooltip = support?.convertTooltip(r, player.player)?.replace(stripUnderline, (match, group) => group);
  const hasIncome = income > 0;
  if (incomeType && hasIncome) {
    cell.title = `${cell.title} (+${incomeType} income)`;
  }
  if (tooltip) {
    cell.title = `${cell.title} (${tooltip})`;
  }
  function resource(): Resource {
    switch (r) {
      case PowerArea.Area1:
      case PowerArea.Area2:
      case PowerArea.Area3:
        return Resource.BowlToken;
      case PowerArea.Gaia:
        return Resource.GainTokenGaiaArea;
    }
    return r as Resource;
  }
  function reward(value: string | number): Reward[] {
    return [new Reward(Number(value), resource())];
  }

  const shortcut = compact
    ? hasIncome
      ? `${val}+${income}`
      : skipZero(val)
    : hasIncome
    ? [reward(val).concat(plusReward()).concat(reward(income))]
    : String(val) !== "0"
    ? [reward(val)]
    : [];

  return [
    {
      shortcut,
      title: cell.title,
      color: cell.color,
      convert: tooltip ? r : null,
    },
  ];
}

function realIncomeCell(
  resource: Resource | PowerArea,
  current: string | number,
  p: Player,
  incomeResource: Resource,
  support: ConversionSupport,
  showIncome: (Player) => boolean,
  compact: boolean,
  incomeType: string
) {
  return incomeCell(
    resource,
    current,
    showIncome(p) ? p.resourceIncome(incomeResource) : 0,
    p,
    support,
    compact,
    incomeType
  );
}

function resourceColumn(
  r: Resource,
  showIncome: (Player) => boolean,
  compact: boolean,
  support?: ConversionSupport | null
): PlayerColumn {
  const cell = resourceCell(r);
  return {
    shortcut: cell.shortcut,
    title: cell.title,
    color: cell.color,
    cell: (p) => realIncomeCell(r, p.data.getResources(r), p, r, support, showIncome, compact, null),
  };
}

function powerArea(a: PowerArea, d: PlayerData): string | number {
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

function power(showIncome: (Player) => boolean, compact: boolean, support?: ConversionSupport): PlayerTable {
  return {
    caption: "Power",
    columns: Object.values(PowerArea).map((a) => {
      const cell = resourceCell(a);
      return {
        shortcut: cell.shortcut,
        title: cell.title,
        color: cell.color,
        cell: (p) => {
          const power = powerArea(a, p.data);
          switch (a) {
            case PowerArea.Area1:
              return realIncomeCell(a, power, p, Resource.GainToken, support, showIncome, compact, "token");
            case PowerArea.Area2:
              return realIncomeCell(a, power, p, Resource.ChargePower, support, showIncome, compact, "power charge");
            case PowerArea.Area3:
              return incomeCell(a, power, 0, p, support, compact);
            case PowerArea.Gaia:
              return incomeCell(
                a,
                p.data.gaiaformersInGaia ? `${p.data.power.gaia}, ${p.data.gaiaformersInGaia}gf` : p.data.power.gaia,
                0,
                p,
                support,
                compact
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

function gaiaFormers(p: Player): string {
  const total = p.data.gaiaformers;
  const available = total - p.data.buildings.gf - p.data.gaiaformersInGaia;
  if (available == 0 && total == 0) {
    return "";
  }
  return `${available}/${total}`;
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
            shortcut: b == Building.GaiaFormer ? gaiaFormers(p) : skipZero(p.data.buildings[b]),
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

function research(engine: Engine, greenFederations: boolean): PlayerTable {
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

function playerTables(engine: Engine, support: ConversionSupport, compact: boolean): PlayerTable[] {
  const show = (p) => showIncome(engine, p);
  return [
    general(engine, compact, show),
    resources(show, compact, support),
    power(show, compact, support),
    research(engine, true),
    finals(engine),
    buildings(engine),
    assets(engine),
    planets(engine),
    stats(engine),
  ].filter((t) => t);
}

export function logPlayerTables(engine: Engine): PlayerTable[] {
  const show = () => false;
  return [resources(show, false), power(show, false), research(engine, false), buildings(engine)].filter((t) => t);
}

function federationResource(fed: Federation) {
  return (
    Reward.parse(tiles.federations[fed]).find((r) => r.type != Resource.VictoryPoint)?.type ?? Resource.VictoryPoint
  );
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
          shortcut: [[new Reward(count, federationResource(fed as Federation))]],
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
    label: deactivatedLabel(c),
    sortable,
    cells: formatCell([c]),
  };
}

export function playerTableRow(t: PlayerTable, p: Player, passed: boolean): InfoTableRow {
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

  const pTables: InfoTable[] = playerTables(engine, support, uiMode == UiMode.compactTable).map((t) => ({
    caption: caption(t.caption),
    fields: t.columns.map((c) => field(c, settings.sortable)),
    additionalHeader: t.columns
      .filter((c) => c.additionalHeader)
      .map((c) => ({
        cells: formatCell(c.additionalHeader.cells, c.additionalHeader.flex),
        colspan: 1,
      })),
    rows: createRows((p, passed) => playerTableRow(t, p, passed)),
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
