import * as express from "express";
import * as bodyParser from "body-parser";
import * as morgan from "morgan";
import Engine from "./src/engine";

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))

app.use(morgan('dev'));

app.post("/", (req, res) => {
  res.set("Access-Control-Allow-Origin", req.get('origin'));
  
  const moves = req.body.moves;
  const engine = new Engine(moves);

  res.json(engine.data());
});

app.listen(9508, "localhost", () => {
  console.log("Listening on port 9508");
});
