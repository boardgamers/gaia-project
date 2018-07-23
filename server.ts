import * as express from "express";
import * as bodyParser from "body-parser";
import * as morgan from "morgan";
import * as cookieParser from 'cookie-parser';
import { AssertionError } from "assert";
import Engine from "./src/engine";
import * as fs from "fs-extra";

fs.mkdirp("bin");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(morgan('dev'));

app.post("/", (req, res) => {
  res.set("Access-Control-Allow-Origin", req.get('origin'));

  try {
    const moves = req.body.moves;
    const engine = new Engine(moves);

    if (!engine.availableCommands) {
      engine.generateAvailableCommands();
    }

    res.json(engine);
  } catch (err) {
    console.error(err);
    if (err instanceof AssertionError) {
      res.status(422).send(err.message);
    } else {
      res.status(500).send("Internal error: " + err.message);
    }
  }
});

interface MetaData {}

const games: {[gameId: string]: Engine} = {

};

app.put("/g/", (req, res) => {
  const {gameId, players} = req.body;

  if (games[gameId]) {
    res.status(400).json('A game with that id is already created');
    return;
  }

  if (!/^[A-Za-z-_0-9]$/.test(gameId)) {
    res.status(400).json('Invalid game id format');
    return;
  }

  try {
    const engine = new Engine([`init ${players} gameId`]);
    engine.generateAvailableCommands();

    games[gameId] = JSON.parse(JSON.stringify(engine));

    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/g/:gameId/join", (req , res) => {
  const gameId = req.params.gameId;

  if (!games[gameId]) {
    req.sendStatus(404);
    return;
  }

  const {auth, name} = req.body;

  if (!auth || !name) {
    res.status(400).json("Please enable cookies and choose a name");
    return;
  }

  const game = games[gameId];

  if (!game.players.some(pl => !pl.name)) {
    res.status(400).json("The game is started");
    return;
  }

  if (game.players.some(pl => pl.auth === auth)) {
    res.status(400).json("You already joined");
    return;
  }

  for (const pl of game.players) {
    if (!pl.name) {
      pl.name = name;
      pl.auth = auth;
      break;
    }
  }

  res.sendStatus(200);
});

app.get("/g/:gameId", (req , res) => {
  const gameId = req.params.gameId;

  if (!games[gameId]) {
    req.sendStatus(404);
    return;
  }

  res.json(games[gameId]);
});

app.post("/g/:gameId/move", (req , res) => {
  const gameId = req.params.gameId;

  if (!games[gameId]) {
    req.sendStatus(404);
    return;
  }

  const game = games[gameId];
  const {auth, move} = req.body;

  if (game.availableCommands.length === 0 || game.player[game.availableCommands[0].player].auth !== auth) {
    res.status(400).json("Not your turn to play");
    return;
  }

  const engine = Engine.fromData(game);

  try {
    engine.move(move);
    if (!engine.availableCommands) {
      engine.generateAvailableCommands();
    }

    res.json(engine);

    if (engine.newTurn) {
      games[gameId] = JSON.parse(JSON.stringify(engine));
    }
  } catch (err) {
    console.error(err);
    if (err instanceof AssertionError) {
      res.status(422).send(err.message);
    } else {
      res.status(500).send("Internal error: " + err.message);
    }
  }
});

app.listen(9508, "localhost", () => {
  console.log("Listening on port 9508");
});

// Every 20 minutes, save game data in a local file
setInterval(async () => {
  await fs.writeFile('bin/data.json', JSON.stringify(games));
}, 1000 * 20 * 60);
