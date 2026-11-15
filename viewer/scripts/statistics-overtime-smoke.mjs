// Run after building engine, viewer and old-ui:
//   node viewer/scripts/statistics-overtime-smoke.mjs
// Optional BASE_STATE / LF_STATE paths exercise captured public game states instead
// of the no-activity fixtures. All interactions are local and no moves are sent.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const repo = new URL("../../", import.meta.url);
const engine = require(fileURLToPath(new URL("engine/dist/index.js", repo)));
const modes = ["normal", "old"];
const html =
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/bundle.css"><div id="app"></div><script src="/vue.js"></script>' +
  '<script src="/bootstrap.js"></script>' +
  '<script src="/bundle.js"></script>';
let mode = "normal";
const server = createServer(async (req, res) => {
  try {
    const bundle = mode === "old" ? "old-ui/dist/package/old-ui.umd.js" : "viewer/dist/package/viewer.umd.js";
    const css = mode === "old" ? "old-ui/dist/package/old-ui.css" : "viewer/dist/package/viewer.css";
    const files = {
      "/bundle.js": fileURLToPath(new URL(bundle, repo)),
      "/bundle.css": fileURLToPath(new URL(css, repo)),
      "/vue.js": require.resolve("vue/dist/vue.min.js"),
      "/bootstrap.js": require.resolve("bootstrap-vue/dist/bootstrap-vue.min.js"),
    };
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(html);
    } else if (/^\/[a-zA-Z0-9-]+\.(json|jpg)$/.test(req.url)) {
      res.setHeader("Content-Type", req.url.endsWith(".json") ? "application/json" : "image/jpeg");
      res.end(
        await readFile(
          fileURLToPath(new URL((mode === "old" ? "old-ui/dist/package" : "viewer/dist/package") + req.url, repo))
        )
      );
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
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE });
try {
  for (const ui of modes) {
    for (const [lostFleet, stateFile] of [
      [false, process.env.BASE_STATE],
      [true, process.env.LF_STATE],
    ]) {
      mode = ui;
      const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" && !message.text().startsWith("Failed to load resource:"))
          errors.push(message.text());
      });
      const state = stateFile
        ? JSON.parse(await readFile(stateFile, "utf8"))
        : JSON.parse(
            JSON.stringify(
              new engine.default(
                ["init 3 overtime", "p1 faction terrans", "p2 faction itars", "p3 faction hadsch-hallas"],
                { lostFleet }
              )
            )
          );
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.evaluate((state) => {
        window.host = window.gaiaViewer.launch("#app");
        host.emit("preferences", { sound: false });
        host.emit("state", state);
      }, state);
      // Both UIs expose the same statistics modal; the old UI uses an SVG chart icon.
      await page.waitForFunction(() =>
        [...document.querySelectorAll("*")].some((el) => el.__vue__?.$store?.state?.data?.players?.length)
      );
      await page.evaluate(() => {
        const vm = [...document.querySelectorAll("*")].find((el) => el.__vue__?.$bvModal)?.__vue__;
        vm.$bvModal.show("chart-button");
      });
      const stats = page.locator(".stats-window");
      await stats.waitFor();
      const field = (label) =>
        stats
          .locator(".stats-window__field")
          .filter({ has: page.locator("label", { hasText: new RegExp(`^${label}$`) }) });
      const choices = async (label) => field(label).locator(".dropdown-item").allTextContents();
      const pick = async (label, index) => {
        const container = field(label);
        await container.locator(".dropdown-toggle").click();
        await container.locator(".dropdown-item").nth(index).click();
        await page.waitForTimeout(10);
        assert.deepEqual(errors, [], `${ui}/${lostFleet}/${label}: no errors`);
      };
      let count = 0;
      const views = await choices("View");
      for (let v = 0; v < views.length; v++) {
        await pick("View", v);
        const types = (await field("Breakdown").count()) ? await choices("Breakdown") : [null];
        for (let t = 0; t < types.length; t++) {
          if (types[t] !== null) await pick("Breakdown", t);
          const kinds = await choices("Details");
          // The first two are Overview and Over Time; exercise every player/source too.
          for (let k = 1; k < kinds.length; k++) {
            await pick("Details", k);
            assert.equal((await field("Details").locator(".dropdown-toggle").innerText()).trim(), kinds[k].trim());
            const rows = stats.locator("tbody tr");
            assert.match(await rows.first().innerText(), /Start/);
            assert(!(await stats.innerText()).includes("NaN"));
            if (k > state.players.length + 1) {
              assert.equal((await stats.locator("caption").innerText()).trim(), `${kinds[k].trim()} of all players`);
            }
            count++;
          }
        }
      }
      console.log(`${ui}/${lostFleet ? "Lost Fleet" : "base"}: ${count} Over Time/player/source selections passed`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
