// "Undo my move" in the built bundles of both viewers (BGS protocol `undo:available` / `undo`).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const repo = new URL("../../", import.meta.url);
const { default: Engine } = require(fileURLToPath(new URL("engine/dist/index.js", repo)));
const wrapper = require(fileURLToPath(new URL("engine/dist/wrapper.js", repo)));
const html =
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/bundle.css"><div id="app"></div>' +
  '<script src="/vue.js"></script><script src="/bootstrap.js"></script><script src="/bundle.js"></script>';
let dist = "viewer/dist/package";
let entry = "viewer";
const server = createServer(async (req, res) => {
  try {
    const files = {
      "/bundle.js": fileURLToPath(new URL(`${dist}/${entry}.umd.js`, repo)),
      "/bundle.css": fileURLToPath(new URL(`${dist}/${entry}.css`, repo)),
      "/vue.js": require.resolve("vue/dist/vue.min.js"),
      "/bootstrap.js": require.resolve("bootstrap-vue/dist/bootstrap-vue.min.js"),
    };
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(html);
    } else if (/^\/[a-zA-Z0-9-]+\.(json|jpg)$/.test(req.url)) {
      res.setHeader("Content-Type", req.url.endsWith(".json") ? "application/json" : "image/jpeg");
      res.end(await readFile(fileURLToPath(new URL(dist + req.url, repo))));
    } else if (files[req.url]) {
      res.setHeader("Content-Type", req.url.endsWith(".css") ? "text/css" : "text/javascript; charset=utf-8");
      res.end(await readFile(files[req.url]));
    } else {
      res.statusCode = 404;
      res.end();
    }
  } catch (error) {
    res.statusCode = 500;
    res.end(String(error));
  }
});

// The human (seat 0) researched, the bot answered: back on turn, with a saved move to take back.
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
const json = (value) => JSON.parse(JSON.stringify(value));
const later = json(wrapper.move(wrapper.move(json(new Engine(setup)), "terrans up nav.", 0), "nevlas up nav.", 1));
// What BGS sends after `undo`: the game replayed to before the player's last saved move.
const earlier = json(await wrapper.replay(json(later), { to: setup.length }));

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE });
try {
  for (const ui of ["normal", "old"])
    for (const width of [390, 1400]) {
      [dist, entry] = ui === "old" ? ["old-ui/dist/package", "old-ui"] : ["viewer/dist/package", "viewer"];
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.evaluate((state) => {
        window.undoRequests = 0;
        window.host = window.gaiaViewer.launch("#app");
        host.on("undo", () => undoRequests++);
        host.emit("preferences", { sound: false });
        host.emit("player", { index: 0 });
        host.emit("state", state);
      }, later);
      await page.waitForFunction(() => document.querySelector("#move-title, .sticky-bar-title"));
      const visible = page.locator("[data-undo-move]:visible");
      assert.equal(await visible.count(), 0, "hidden until BGS offers undo");

      await page.evaluate(() => host.emit("undo:available", true));
      await visible.first().waitFor();
      assert.equal(await visible.count(), 1, "one control at a time (title bar on phones, turn tools otherwise)");
      const control = page.getByRole("button", { name: "Undo my move", exact: true });
      assert.equal(await control.getAttribute("title"), "Undo my move");
      await control.click();
      assert.equal(await page.evaluate(() => undoRequests), 1, "a click asks BGS to undo");

      await page.evaluate(() => host.emit("replay:start"));
      await page.waitForFunction(() => !document.querySelector("[data-undo-move]"));
      await page.evaluate(() => host.emit("replay:end"));
      await visible.first().waitFor();
      await page.evaluate(() => host.emit("player", {}));
      await page.waitForFunction(() => !document.querySelector("[data-undo-move]"));
      await page.evaluate(() => host.emit("player", { index: 0 }));
      await visible.first().waitFor();

      // BGS's answer: the earlier position, with fewer moves.
      await page.evaluate((state) => host.emit("state", state), earlier);
      await page.waitForFunction((moves) => host.store.state.data.moveHistory.length === moves, setup.length);
      assert.match(
        await page.locator(width < 768 ? ".sticky-bar-title h5" : "#move-title h5").textContent(),
        /Your turn/
      );

      await page.evaluate(() => host.emit("preferences", { sound: false, locale: "fr" }));
      await page.waitForFunction(
        () => document.querySelector("[data-undo-move]")?.getAttribute("title") === "Annuler mon coup"
      );
      await page.evaluate(() => host.emit("undo:available", false));
      await page.waitForFunction(() => !document.querySelector("[data-undo-move]"));
      assert.equal(await page.evaluate(() => undoRequests), 1);
      assert.deepEqual(errors, [], "no browser errors");
      await page.close();
      console.log(`gaia-project ${ui} ${width}px: undo smoke passed`);
    }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
