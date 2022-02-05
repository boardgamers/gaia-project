import mongoose from "mongoose";
import Engine from "../../engine";
import { GameDocument } from "./game";

export function connectMongo() {
  mongoose.connect("mongodb://127.0.0.1:27017", { dbName: "test", useNewUrlParser: true });

  mongoose.connection.on("error", (err) => {
    console.error(err);
  });

  mongoose.connection.on("open", async () => {
    console.log("connected to database!");
  });
}

export function shouldReplay(game: GameDocument) {
  const data = game.data as Engine;
  return game.options.setup.nbPlayers != data.players.length || !data.advancedLog?.length;
}
