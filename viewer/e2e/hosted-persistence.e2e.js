/* Hot-seat persistence regression harness for hosted mode.
 *
 * Covers the two failure modes reported on 2026-07-08:
 * - faction picks in a hosted test game appearing to work locally, then
 *   snapping back to player 1 because nothing was really committed
 * - later hosted moves disappearing after a reload
 *
 * This uses ONE real signed-in session and the current test-game flow:
 * create a 2-player hosted test game, pick both factions in hot-seat, place
 * the four setup mines, reload, and verify every move survived in PostgREST.
 *
 * Usage:
 *   E2E_SESSION=/path/to/session.json node e2e/hosted-persistence.e2e.js
 *
 * Optional env: E2E_BASE_URL (url | "local"), E2E_PORT (default 4175),
 * PW_EXECUTABLE, E2E_ARTIFACTS.
 */

/* eslint-disable no-console */
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const PROJECT_REF = "mitawjpdxkheascdiffz";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pdGF3anBkeGtoZWFzY2RpZmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5Mjc3OTcsImV4cCI6MjA5ODUwMzc5N30.TXqMIk3KMpGycxJ0o952eX8og3F3kAS8gv-I3U2CPe0";

const PORT = Number(process.env.E2E_PORT || 4175);
const LOCAL = process.env.E2E_BASE_URL === "local";
const BASE_URL = LOCAL ? `http://127.0.0.1:${PORT}` : process.env.E2E_BASE_URL || "https://gaia-lost-fleet.vercel.app";
const DIST = path.join(__dirname, "..", "dist", "app");
const ARTIFACTS = process.env.E2E_ARTIFACTS || os.tmpdir();

function requireSession() {
  const file = process.env.E2E_SESSION;
  if (!file) {
    throw new Error("E2E_SESSION must point to a session JSON file");
  }
  const session = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!session.access_token || !session.user) {
    throw new Error(`E2E_SESSION (${file}) is not a token response`);
  }
  return session;
}

function serveDist() {
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
  };
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, BASE_URL).pathname);
    let file = path.join(DIST, urlPath === "/" ? "index.html" : urlPath);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, "index.html");
    }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

async function newSessionContext(browser, session) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 } });
  await context.addInitScript(
    ([key, value]) => {
      try {
        if (!window.localStorage.getItem(key)) {
          window.localStorage.setItem(key, value);
        }
      } catch (err) {
        /* not a real origin yet */
      }
    },
    [`sb-${PROJECT_REF}-auth-token`, JSON.stringify(session)]
  );
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[console.error] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}`));
  return page;
}

let step = 0;
function check(name) {
  step++;
  console.log(`OK ${step}. ${name}`);
}

async function pickFaction(page, label) {
  const button = page.locator("button.move-button", { hasText: label });
  await button.waitFor({ state: "visible", timeout: 20000 });
  await button.click();
  const ok = page.locator("button", { hasText: "OK, I pick this one!" });
  await ok.waitFor({ state: "visible", timeout: 10000 });
  await ok.click();
}

async function placeFirstMine(page) {
  const hex = page.locator("use.space-hex.pointer").first();
  await hex.waitFor({ state: "visible", timeout: 20000 });
  await hex.click({ force: true });
  const confirm = page.locator("button", { hasText: /Confirm Mine/ });
  await confirm.waitFor({ state: "visible", timeout: 10000 });
  await confirm.click();
}

async function committedMoves(page, gameId) {
  return page.evaluate(
    async ([url, anon, ref, game]) => {
      const stored = JSON.parse(window.localStorage.getItem(`sb-${ref}-auth-token`));
      const res = await fetch(`${url}/rest/v1/moves?game_id=eq.${game}&select=seq,seat,move&order=seq`, {
        headers: { apikey: anon, Authorization: `Bearer ${stored.access_token}` },
      });
      return res.json();
    },
    [SUPABASE_URL, ANON_KEY, PROJECT_REF, gameId]
  );
}

async function waitForMoveCount(page, gameId, count, timeout = 30000) {
  await page.waitForFunction(
    async ([url, anon, ref, game, expected]) => {
      const stored = JSON.parse(window.localStorage.getItem(`sb-${ref}-auth-token`));
      const res = await fetch(`${url}/rest/v1/moves?game_id=eq.${game}&select=seq`, {
        headers: { apikey: anon, Authorization: `Bearer ${stored.access_token}` },
      });
      return (await res.json()).length >= expected;
    },
    [SUPABASE_URL, ANON_KEY, PROJECT_REF, gameId, count],
    { timeout }
  );
}

async function main() {
  const session = requireSession();
  let server = null;
  if (LOCAL) {
    if (!fs.existsSync(path.join(DIST, "index.html"))) {
      throw new Error(`no build at ${DIST} - run \`npm run build\` in viewer/ first`);
    }
    server = await serveDist();
  }

  console.log(`target: ${BASE_URL}`);
  const browser = await chromium.launch({ executablePath: process.env.PW_EXECUTABLE || undefined });
  const page = await newSessionContext(browser, session);

  try {
    await page.goto(`${BASE_URL}/?lobby=1`);
    await page.locator("h3", { hasText: "Gaia Project: The Lost Fleet" }).waitFor({ timeout: 30000 });
    check("lobby booted with stored session");

    await page.locator("a", { hasText: "+ New game" }).click();
    await page.waitForURL(/\?create=1/, { timeout: 30000 });
    await page.locator("h3", { hasText: "New game" }).waitFor({ timeout: 30000 });
    await page.locator("label", { hasText: "Test game" }).click();
    await page.locator("button", { hasText: "Create game" }).click();
    await page.waitForURL(/\?game=/, { timeout: 30000 });
    const gameId = new URL(page.url()).searchParams.get("game");
    check(`created hosted test game ${gameId}`);

    await pickFaction(page, "Terrans");
    await pickFaction(page, "Hadsch Hallas");
    await waitForMoveCount(page, gameId, 3);
    check("both faction picks committed in hosted hot-seat");

    for (let i = 0; i < 4; i++) {
      await placeFirstMine(page);
    }
    await waitForMoveCount(page, gameId, 7);
    check("all four setup mine placements committed");

    await page.reload();
    const moves = await committedMoves(page, gameId);
    if (moves.length < 7) {
      throw new Error(`expected at least 7 committed moves after reload, got ${JSON.stringify(moves)}`);
    }
    if (!moves.some((move) => move.move === "p1 faction terrans")) {
      throw new Error(`missing persisted p1 faction pick: ${JSON.stringify(moves)}`);
    }
    if (!moves.some((move) => move.move === "p2 faction hadsch-hallas")) {
      throw new Error(`missing persisted p2 faction pick: ${JSON.stringify(moves)}`);
    }
    check(`reload kept hosted move history (${moves.length} committed rows)`);

    console.log(`\nALL CHECKS PASSED - hosted persistence looks healthy for game ${gameId}.`);
    return 0;
  } catch (err) {
    const shot = path.join(ARTIFACTS, "e2e-hosted-persistence.png");
    await page.screenshot({ path: shot, fullPage: true }).catch(() => undefined);
    console.error(`\nFAILED at step ${step + 1}: ${err.message}`);
    console.error(`screenshot: ${shot}`);
    return 1;
  } finally {
    await browser.close();
    if (server) {
      server.close();
    }
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
