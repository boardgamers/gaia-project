import * as express from "express";
import * as bodyParser from "body-parser";
import Engine from "./src/engine";

const app = express();

app.use(bodyParser());

app.post("/", (req, res) => {
  const moves = req.body.moves;

  const engine = new Engine(moves);

  res.json(engine.data());
});

app.listen(9508, "localhost");