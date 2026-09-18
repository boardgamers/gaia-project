import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { default: Engine } = require("../../engine/dist/index.js");
const wrapper = require("../../engine/dist/wrapper.js");
const { automation } = require("../../engine/dist/src/premoves.js");
const files = {
  "/bundle.js": fileURLToPath(new URL("../dist/package/viewer.umd.js", import.meta.url)),
  "/bundle.css": fileURLToPath(new URL("../dist/package/viewer.css", import.meta.url)),
  "/vue.js": require.resolve("vue/dist/vue.min.js"),
  "/bootstrap.js": require.resolve("bootstrap-vue/dist/bootstrap-vue.min.js"),
};
const setup = Engine.parseMoves(`
init 2 randomSeed
p1 faction terrans
p2 faction nevlas
terrans build m -1x2
nevlas build m -1x0
nevlas build m 0x-4
terrans build m -4x-1
nevlas booster booster7
terrans booster booster3
`);
let state;
let revision = 0;
function reset() {
  state = new Engine(setup);
  state.players[0].name = "Alex";
  state.players[1].name = "You";
  wrapper.setPlayerSettings(state, 0, { autoCharge: "2" });
  wrapper.setPlayerSettings(state, 1, { autoCharge: "2" });
  state.generateAvailableCommandsIfNeeded();
  automation(state);
  revision++;
}
reset();
// Optional local snapshot, useful when rebuilding the engine without resetting a UI test.
if (process.env.PREMOVE_PREVIEW_STATE) {
  state = Engine.fromData(JSON.parse(await readFile(process.env.PREMOVE_PREVIEW_STATE, "utf8")));
}
const clone = () => JSON.parse(JSON.stringify(state));
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const seat = Number(url.searchParams.get("seat") ?? 1);
  try {
    res.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(await readFile(new URL("./premove-preview.html", import.meta.url)));
    } else if (files[url.pathname]) {
      res.setHeader("Content-Type", url.pathname.endsWith(".css") ? "text/css" : "text/javascript");
      res.end(await readFile(files[url.pathname]));
    } else {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "POST") {
        if (url.pathname === "/reset") reset();
        else if (url.pathname === "/opponent") {
          const player = wrapper.currentPlayer(state);
          if (player === seat) throw new Error("It is your turn. Use the game controls or reset the preview.");
          state =
            state.moveHistory.length === setup.length
              ? wrapper.move(clone(), "terrans build ts -1x2.", 0)
              : wrapper.moveAI(clone(), player);
          revision++;
        } else if (url.pathname === "/move") {
          let body = "";
          for await (const chunk of req) body += chunk;
          const { move } = JSON.parse(body);
          const current = wrapper.currentPlayer(state);
          if (current !== seat && !wrapper.canMoveOutOfTurn(state, move, seat)) throw new Error("It is not your turn.");
          const result = wrapper.move(clone(), move, seat);
          if (wrapper.toSave(result)) {
            state = result;
            revision++;
          }
          res.end(JSON.stringify({ revision, state: wrapper.stripSecret(result, seat) }));
          return;
        }
      }
      res.end(JSON.stringify({ revision, state: wrapper.stripSecret(state, seat) }));
    }
  } catch (error) {
    res.writeHead(422, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
});
server.listen(Number(process.env.PORT || 5201), "127.0.0.1", () => console.log("Gaia premoves: http://127.0.0.1:5201"));
