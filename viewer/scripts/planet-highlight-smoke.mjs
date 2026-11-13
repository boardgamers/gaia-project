import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

// Run after building both UIs: cd viewer && node scripts/planet-highlight-smoke.mjs
// Repeat with BROWSER=webkit; BROWSER_EXECUTABLE can select a locally installed browser.
// Uses only unmodified local production bundles/fixtures; screenshots go to /tmp.
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
const browserName = process.env.BROWSER || "chromium";
assert.ok(["chromium", "webkit"].includes(browserName));
const browser = await { chromium, webkit }[browserName].launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE || (browserName === "chromium" ? process.env.CHROMIUM_EXECUTABLE : undefined),
});
try {
  for (const ui of modes) {
    mode = ui;
    for (const width of [390, 1400]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      const state = new engine.default(["init 2 white-planet-contrast", "p1 faction terrans", "p2 faction nevlas"]);
      await page.evaluate(
        (state) => {
          window.host = window.gaiaViewer.launch("#app");
          host.emit("preferences", { sound: false });
          host.emit("state", state);
        },
        JSON.parse(JSON.stringify(state))
      );
      await page.waitForSelector(".space-hex-cell circle.planet.i");
      for (const theme of ["light", "dark"]) {
        await page.evaluate((theme) => document.documentElement.setAttribute("data-theme", theme), theme);
        const result = await page.evaluate(async () => {
          const cell = [...document.querySelectorAll(".space-hex-cell")].find(
            (el) => el.querySelector("circle.planet.i") && !el.querySelector(".building")
          );
          const circle = cell.querySelector("circle.planet.i");
          const store = cell.__vue__.$store;
          // Isolate the map filter from the game's initial build-selection overlays.
          store.state.context.highlighted.hexes = null;
          await Vue.nextTick();
          const snapshot = () => ({
            stroke: getComputedStyle(circle).stroke,
            width: getComputedStyle(circle).strokeWidth,
            radius: circle.getAttribute("r"),
            count: cell.querySelectorAll("*").length,
            markers: cell.querySelectorAll("use").length,
          });
          const toggle = async (planet) => {
            store.commit("toggleMapMode", { type: "planetType", planet });
            await Vue.nextTick();
          };
          const off = snapshot();
          await toggle("i");
          const on = snapshot();
          circle.classList.add("warn");
          const warn = snapshot();
          circle.classList.remove("warn");
          await toggle("i");
          const again = snapshot();
          await toggle("r");
          const mismatch = snapshot();
          const otherMarked = document.querySelectorAll(".planet-type-highlighted").length;
          await toggle("r");
          await toggle("i");
          return { off, on, warn, again, mismatch, otherMarked };
        });
        assert.equal(result.on.stroke, "rgb(0, 0, 0)");
        assert.equal(result.on.width, "0.1px");
        assert.equal(result.warn.stroke, result.off.stroke, "warn excludes the black filter outline");
        assert.deepEqual(result.again, result.off, "toggle off restores original styling");
        assert.deepEqual(result.mismatch, result.off, "another type leaves Ice alone");
        assert.equal(result.otherMarked, 0);
        for (const prop of ["radius", "count", "markers"]) assert.equal(result.on[prop], result.off[prop]);
        await page
          .locator("svg")
          .filter({ has: page.locator(".space-hex-cell") })
          .first()
          .screenshot({ path: `/tmp/white-planet-${browserName}-${ui}-${width}-${theme}.png` });
        await page.evaluate(async () => {
          document
            .querySelector(".space-hex-cell")
            .__vue__.$store.commit("toggleMapMode", { type: "planetType", planet: "i" });
          await Vue.nextTick();
        });
        console.log(
          `${browserName} ${ui} ${width}px ${theme}: Ice contour, off/mismatch, warning priority, unchanged geometry/markers passed`
        );
      }
      assert.deepEqual(errors, [], "no browser errors");
      await page.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
