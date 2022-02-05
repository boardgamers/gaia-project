import * as fs from "fs";
import * as process from "process";
import Engine from "../../engine";
import { replay } from "../../engine/wrapper";
import { Game, GameDocument } from "./game";
import { connectMongo, shouldReplay } from "./util";

const engineVersion = new Engine().version;

async function main() {
  let success = 0;
  let errors = 0;
  let replayed = 0;
  let cancelled = 0;
  let active = 0;
  let expansion = 0;

  let progress = 0;

  const outcomes = () => ({
    success,
    errors,
    replayed,
    cancelled,
    active,
    expansion,
  });

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

    if (!shouldReplay(game)) {
      success++;
      return;
    }
    let data = game.data as Engine;

    if (shouldReplay(game)) {
      const file = `replay/${game._id}.json`;
      if (!fs.existsSync(file)) {
        console.log("replay " + game._id);
        data = await replay(data);
        data.replayVersion = engineVersion;
        const oldPlayers = game.players;
        for (let i = 0; i < oldPlayers.length && i < oldPlayers.length; i++) {
          data.players[i].name = oldPlayers[i].name;
          data.players[i].dropped = oldPlayers[i].dropped;
        }

        game.data = data;
        fs.writeFileSync(file, JSON.stringify(game.toJSON()), { encoding: "utf8" });
      }
    }

    replayed++;
  }

  connectMongo();

  // .where("_id").equals("Costly-amount-263") //for testing
  for await (const game of Game.find().where("game.name").equals("gaia-project")) {
    try {
      await process(game);
    } catch (e) {
      console.log(game._id);
      // console.log(JSON.stringify(game));
      console.log(e);
      errors++;
    }
  }

  console.log(outcomes());
}

const start = new Date();
main().then(() => {
  console.log("done");
  console.log(new Date().getTime() - start.getTime());
  process.exit(0);
});
