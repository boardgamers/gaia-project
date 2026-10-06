import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const base = fileURLToPath(new URL("../../", import.meta.url));
const req = createRequire(import.meta.url);
const { chromium, webkit } = req("playwright");
(async () => {
  const routes = {
    "/bundle.js": base + "viewer/dist/package/viewer.umd.js",
    "/bundle.css": base + "viewer/dist/package/viewer.css",
    "/vue.js": req.resolve("vue/dist/vue.min.js"),
    "/bootstrap.js": req.resolve("bootstrap-vue/dist/bootstrap-vue.min.js"),
  };
  const server = createServer(async (request, response) => {
    try {
      if (request.url === "/")
        return response.end(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/bundle.css"><div id="app"></div><script src="/vue.js"></script><script src="/bootstrap.js"></script><script src="/bundle.js"></script>'
        );
      const file =
        routes[request.url] ||
        (/^\/[\w-]+\.(json|jpg)$/.test(request.url) ? base + "viewer/dist/package" + request.url : null);
      if (!file) {
        response.statusCode = 404;
        return response.end();
      }
      response.setHeader(
        "Content-Type",
        request.url.endsWith(".css")
          ? "text/css"
          : request.url.endsWith(".js")
            ? "text/javascript; charset=utf-8"
            : request.url.endsWith(".json")
              ? "application/json"
              : "image/jpeg"
      );
      response.end(await readFile(file));
    } catch (e) {
      response.statusCode = 500;
      response.end(String(e));
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  let browser;
  try {
    browser = await (process.env.TEST_WEBKIT ? webkit : chromium).launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE,
    });
    for (const width of [390, 1400]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        isMobile: width < 600,
        hasTouch: width < 600,
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const state = JSON.parse(await readFile(base + "engine/fixtures/Beta-2.json", "utf8"));
      await page.goto("http://127.0.0.1:" + server.address().port);
      await page.evaluate((state) => {
        window.host = window.gaiaViewer.launch("#app");
        host.emit("preferences", { sound: false });
        host.emit("player", { index: 0 });
        host.emit("state", state);
      }, state);
      const icon = page.locator(".space-map__chart-button");
      await icon.waitFor();
      for (const [theme, color] of [
        ["light", "rgb(33, 37, 41)"],
        ["dark", "rgb(241, 244, 248)"],
        ["light", "rgb(33, 37, 41)"],
      ]) {
        await page.evaluate((theme) => document.documentElement.setAttribute("data-theme", theme), theme);
        assert.equal(await icon.locator("path").evaluate((el) => getComputedStyle(el).fill), color);
        assert.equal(await icon.evaluate((el) => getComputedStyle(el).filter), "none");
        const geometry = await icon.evaluate((el) => {
          const icon = el.getBoundingClientRect();
          const map = el.closest(".space-map-canvas").getBoundingClientRect();
          return { width: icon.width, height: icon.height, mapWidth: map.width, x: icon.x - map.x, y: icon.y - map.y };
        });
        assert(geometry.width > 5 && geometry.width < geometry.mapWidth * 0.1, JSON.stringify(geometry));
        assert(geometry.height > 5 && geometry.height < geometry.mapWidth * 0.1, JSON.stringify(geometry));
        assert(
          geometry.x > geometry.mapWidth * 0.75 && geometry.y < geometry.mapWidth * 0.15,
          JSON.stringify(geometry)
        );
      }
      await icon.click();
      await page.locator("#chart-button .modal-content").waitFor();
      console.log(
        `${process.env.TEST_WEBKIT ? "WebKit" : "Chromium"} ${width}px: icon size, top-right position, theme colors and Statistics click passed.`
      );
      assert.deepEqual(errors, [], "built viewer runs without browser errors");
      await page.close();
    }
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
