import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const root = new URL("../../", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("../src/localization/zh-CN.json", import.meta.url), "utf8"));
const Engine = require(process.env.GAIA_SMOKE_ENGINE || "../../engine/dist/index.js").default;
const { lessons } = require("./tutorial-manifest.cjs");
let old = false;
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    const directory = old ? "old-ui/dist/package/" : "viewer/dist/package/";
    const entry = old ? "old-ui" : "viewer";
    const remote = old ? process.env.GAIA_SMOKE_OLD_URL : process.env.GAIA_SMOKE_URL;
    const script = remote || `/${entry}.umd.js`;
    const style = remote ? new URL(`${entry}.css`, remote).href : `/${entry}.css`;
    if (path === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${style}"><div id="app"></div><script src="https://cdn.jsdelivr.net/npm/vue@2.7.16/dist/vue.min.js"></script><script src="https://cdn.jsdelivr.net/npm/bootstrap-vue@2.23.1/dist/bootstrap-vue.min.js"></script><script src="${script}"></script>`
      );
    } else if (/^\/[a-zA-Z0-9.-]+\.(?:js|css|json|jpg)$/.test(path)) {
      res.setHeader(
        "Content-Type",
        path.endsWith(".json")
          ? "application/json"
          : path.endsWith(".css")
            ? "text/css"
            : path.endsWith(".jpg")
              ? "image/jpeg"
              : "text/javascript"
      );
      res.end(await readFile(new URL(directory + path.slice(1), root)));
    } else res.writeHead(404).end();
  } catch (error) {
    res.writeHead(500).end(String(error));
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE });
const url = `http://127.0.0.1:${server.address().port}/`;
try {
  for (const mode of [false, true]) {
    old = mode;
    for (const width of [390, 1400]) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(url);
      const state = new Engine(["init 3 17"], { randomFactions: true });
      state.generateAvailableCommandsIfNeeded();
      const serialized = JSON.parse(JSON.stringify(state));
      serialized.players.forEach((player, index) => {
        player.name = ["Build", "Ada", "Bob"][index];
      });
      await page.evaluate((state) => {
        window.host = gaiaViewer.launch("#app");
        host.emit("preferences", { locale: "zh-Hans-CN", sound: false });
        host.emit("player", { index: 0 });
        host.emit("state", state);
      }, serialized);
      await page.waitForFunction(() => document.querySelector("[data-gaia-locale]")?.getAttribute("lang") === "zh-CN");
      await page.waitForFunction(
        () => document.body.textContent.includes("种族") || document.body.textContent.includes("矿场")
      );
      assert.ok((await page.locator("body").innerText()).includes("Build"), "player name stays unchanged");
      await page.evaluate(() => host.emit("preferences", { locale: "zh-Hant", sound: false }));
      await page.waitForFunction(() => document.querySelector("[data-gaia-locale]")?.getAttribute("lang") === "zh-TW");
      await page.evaluate(() => host.emit("preferences", { locale: "zh-SG", sound: false }));
      await page.waitForFunction(() => document.querySelector("[data-gaia-locale]")?.getAttribute("lang") === "zh-CN");
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `/tmp/gaia-zh-CN-${old ? "old" : "modern"}-${width}.png`, fullPage: true });
      await page.close();
      console.log(
        `PASS ${old ? "classic" : "modern"} Chinese viewer, CDN Vue, language switching and names at ${width}px`
      );
    }
  }
  if (!process.env.GAIA_SMOKE_ENGINE) {
    old = false;
    for (const lesson of lessons) {
      const page = await browser.newPage({ viewport: { width: 390, height: 950 } });
      await page.goto(url);
      await page.evaluate(
        (chapter) =>
          gaiaViewer.launchTutorial("#app", { chapter, locale: "zh-CN", onProgress: (p) => (window.progress = p) }),
        lesson.id
      );
      await page.waitForFunction(() => window.progress?.step === 0);
      const expected = catalog[lesson.steps[0].title];
      assert.ok(expected, lesson.id);
      await page.waitForFunction(
        (expected) => document.querySelector(".bgs-tutorial-heading")?.textContent.includes(expected),
        expected
      );
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, lesson.id);
      await page.close();
    }
    console.log(`PASS Chinese opening titles and mobile layout for all ${lessons.length} tutorials`);
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
