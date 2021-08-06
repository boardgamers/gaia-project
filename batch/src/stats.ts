import { createObjectCsvWriter } from "csv-writer";
import * as fs from "fs";
import { sortBy, sumBy } from "lodash";
import * as process from "process";
import Engine, { Booster, Command, Player, roundScorings } from "../../engine";
import { boosterNames } from "../../viewer/src/data/boosters";
import { advancedTechTileNames, baseTechTileNames } from "../../viewer/src/data/tech-tiles";
import { parsedMove } from "../../viewer/src/logic/recent";
import { Game, GameDocument, PlayerInfo } from "./game";
import { connectMongo, shouldReplay } from "./util";
import { ChartSetup } from "../../viewer/src/logic/charts/chart-factory";

const errorDir = "error/";

function getDetailStats(commonProps: any, data: Engine, pl: Player) {
  const newDetailRow = (round: any) => {
    const d = {
      round: round,
    };
    Object.assign(d, commonProps);
    return d;
  };

  const rows: any[] = [];

  const chartSetup = new ChartSetup(data, true);
  const fam = chartSetup.families.filter((f) => f != "Final Scoring Conditions" && f != "Federations");

  for (let family of fam) {
    const f = chartSetup.chartFactory(family);
    const sources = f.sources(family);

    const details = f.newDetails(data, pl.player, sources, "except-final", family, false);
    for (let detail of details) {
      const dataPoints = detail.getDataPoints();
      if (rows.length == 0) {
        for (let round = 0; round < dataPoints.length; round++) {
          rows.push(newDetailRow(round));
        }
        rows.push(newDetailRow("total"));
      }
      const key = `${family} - ${detail.label}`;
      let last = 0;
      dataPoints.forEach((value, index) => {
        rows[index][key] = value - last;
        last = value;
      });
      rows[dataPoints.length][key] = dataPoints[dataPoints.length - 1];
    }
  }
  return rows;
}

function getGameStats(pl: Player, outerPlayer: PlayerInfo<any>, data: Engine, game: GameDocument, commonProps: any) {
  const playerProp = (key: string, def: any) => (key in outerPlayer ? outerPlayer[key] ?? def : def);
  const rank = sortBy(data.players, (p: Player) => -p.data.victoryPoints);
  const rankWithoutBid = sortBy(data.players, (p: Player) => -(p.data.victoryPoints + (p.data.bid ?? 0))); // bid is positive

  const date = game.createdAt;

  function toIso(date: any) {
    return typeof date == "string" ? date : date?.toISOString();
  }

  const row = {
    initialTurnOrder: pl.player + 1,
    version: data.version ?? "1.0.0",
    players: data.players.length,
    started: toIso(game.createdAt),
    ended: toIso(game.lastMove),
    variant: data.options.factionVariant,
    auction: data.options.auction,
    layout: data.options.layout,
    randomFactions: data.options.randomFactions ?? false,
    rotateSectors: !data.options.advancedRules,
    rank: rank.indexOf(pl) + 1,
    rankWithoutBid: rankWithoutBid.indexOf(pl) + 1,
    playerDropped: playerProp("dropped", false),
    playerQuit: playerProp("quit", false),
  };

  Object.assign(row, commonProps);

  for (let pos in data.tiles.techs) {
    if (pos === "move") {
      continue;
    }
    const tech = data.tiles.techs[pos].tile;
    row[`tech-${pos}`] = advancedTechTileNames[tech] ?? baseTechTileNames[tech].name;
  }

  row["finalA"] = data.tiles.scorings.final[0];
  row["finalB"] = data.tiles.scorings.final[1];

  data.tiles.scorings.round.forEach((tile, index) => {
    row[`roundScoring${index + 1}`] = roundScorings[tile][0];
  });

  for (let booster of Booster.values()) {
    row[`booster ${boosterNames[booster].name}`] = data.tiles.boosters[booster] ? 1 : 0;
  }

  let i = 1;
  for (const move of data.moveHistory) {
    const command = parsedMove(move).commands[0];
    if (command.command == Command.Build && command.faction === pl.faction) {
      const hex = data.map.getS(command.args[1]);
      // data.map.distance()
      row[`startPosition${i}`] = hex.toString();
      row[`startPositionDistance${i}`] = (Math.abs(hex.q) + Math.abs(hex.r) + Math.abs(-hex.q - hex.r)) / 2;
      i++;
    } else if (command.command == Command.ChooseRoundBooster) {
      break;
    }
  }

  for (; i < 4; i++) {
    //so that all columns are filled to get the correct headers
    row[`startPosition${i}`] = "";
    row[`startPositionDistance${i}`] = "";
  }

  return row;
}

function getStats(game: GameDocument, data: Engine): { game: any[]; detail: any[] } {
  const avgElo =
    sumBy(game.players, (p: PlayerInfo) => (p.elo?.initial ?? 0) + (p.elo?.delta ?? 0)) / game.players.length;

  return data.players
    .flatMap((pl) => {
      const outerPlayer = game.players.find((p) => p.faction === pl.faction);

      const commonProps = {
        id: game._id,
        player: outerPlayer.name,
        faction: pl.faction,
        score: outerPlayer.score,
        scoreWithoutBid: outerPlayer.score + (pl.data.bid ?? 0), // bid is positive
        eloInitial: outerPlayer.elo?.initial,
        eloDelta: outerPlayer.elo?.delta,
        averageElo: avgElo,
      };
      const gameRow = getGameStats(pl, outerPlayer, data, game, commonProps);
      return { game: [gameRow], detail: getDetailStats(commonProps, data, pl) };
    })
    .reduce((a, b) => {
      a.game.push(...b.game);
      a.detail.push(...b.detail);
      return a;
    });
}

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, { encoding: "utf8" }));
}

async function main(args: string[]) {
  const replayErrors = args.length > 0 && args[0] == "replay-errors";

  let success = 0;
  let errors = 0;
  let skipReplay = 0;
  let cancelled = 0;
  let active = 0;
  let expansion = 0;

  let progress = 0;

  const outcomes = () => ({
    success,
    errors,
    skipReplay,
    cancelled,
    active,
    expansion,
  });

  let gameWriter = null;
  let detailWriter = null;

  async function process(game: GameDocument) {
    progress++;
    if (progress % 10 == 0) {
      console.log("progress", progress);
    }

    if (game.cancelled) {
      cancelled++;
      return;
    }
    if (game.status !== "ended") {
      active++;
      return;
    }

    if (game.game.expansions.length > 0) {
      expansion++;
      return;
    }

    let data: Engine;

    if (shouldReplay(game)) {
      const file = `replay/${game._id}.json`;
      if (fs.existsSync(file)) {
        data = Engine.fromData(readJson(file));
      } else {
        skipReplay++;
        return;
      }
    } else {
      data = Engine.fromData(game.data);
    }

    const stats = getStats(game, data);

    if (gameWriter == null) {
      const append = replayErrors
      gameWriter = createObjectCsvWriter({
        path: "gaia-stats-game.csv",
        header: Object.keys(stats.game[0]).map((k) => ({ id: k, title: k })),
        append,
      });
      detailWriter = createObjectCsvWriter({
        path: "gaia-stats-turns.csv",
        header: Object.keys(stats.detail[0]).map((k) => ({ id: k, title: k })),
        append,
      });
    }

    await gameWriter.writeRecords(stats.game);
    await detailWriter.writeRecords(stats.detail);
    success++;
  }

  if (replayErrors) {
    for (const file of fs.readdirSync(errorDir)) {
      console.log(file);
      await process(readJson(errorDir + file));
    }
  } else {
    connectMongo();
    for await (const game of Game.find().where("game.name").equals("gaia-project")) {
      try {
        await process(game);
      } catch (e) {
        console.log(game._id);
        console.log(e);
        fs.writeFileSync(errorDir + game._id + ".json", JSON.stringify(game.toJSON()), { encoding: "utf8" });
        errors++;
      }
    }
  }

  console.log(outcomes());
}

const start = new Date();
main(process.argv.slice(2)).then(() => {
  console.log("done");
  console.log(new Date().getTime() - start.getTime());
  process.exit(0);
});
