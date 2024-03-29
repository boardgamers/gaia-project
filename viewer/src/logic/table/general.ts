import Engine, {
  BoardAction,
  Booster,
  Federation,
  Player,
  PlayerEnum,
  Resource,
  Reward,
  ScoringTile,
} from "@gaia-project/engine";
import { federationRewards } from "@gaia-project/engine/src/tiles/federations";
import { boardActionData } from "../../data/actions";
import { boosterData } from "../../data/boosters";
import { factionName } from "../../data/factions";
import { federationData } from "../../data/federations";
import { roundScoringData } from "../../data/round-scorings";
import { playerColor } from "../../graphics/colors";
import { richTextRewards } from "../../graphics/rich-text";
import { Cell, defaultBackground, emptyCell, GeneralTable } from "./types";

export function playerCell(p: Player | null, bold = false): Cell {
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
    color: f ? playerColor(p, true) : null,
  };
}

export function boosterCell(b: Booster): Cell {
  return {
    shortcut: boosterData[b].shortcut,
    title: boosterData[b].name,
    color: boosterData[b].color,
  };
}

function federationResource(fed: Federation): Resource {
  return federationRewards(fed).find((r) => r.type != Resource.VictoryPoint)?.type ?? Resource.VictoryPoint;
}

export function generalTables(engine: Engine): GeneralTable[] {
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
          title: federationRewards(fed as Federation).join(","),
          color: federationData[fed].color,
        },
        row: {
          shortcut: [richTextRewards([new Reward(count, federationResource(fed as Federation))])],
          title: "Number of federations left",
          color: federationData[fed].color,
        },
      })),
    },
  ];
}
