/* Manual, throwaway exploration/verification script for Premove Phase 3 (Sequential + Priority
 * queues) against the real hosted backend. NOT part of the committed test suite - see
 * hosted-multiplayer.e2e.js's header for the general pattern this borrows from.
 *
 * Unlike hosted-multiplayer.e2e.js, this script does NOT create the game through the UI (game
 * creation is admin-only, migration 0008_admin_only_create_game.sql) - it expects a game already
 * seeded directly via SQL (both e2e-alice/e2e-bob as seats 0/1, already advanced past setup into
 * Phase.RoundMove with alice - seat 0 - to move first) and takes the game id via GAME_ID.
 *
 * Usage:
 *   E2E_SESSION_A=... E2E_SESSION_B=... GAME_ID=<uuid> PW_EXECUTABLE=/opt/pw-browsers/chromium \
 *     E2E_BASE_URL=local node e2e/premove-phase3.e2e.js
 *
 * (drop E2E_BASE_URL=local, and instead set NODE_EXTRA_CA_CERTS + E2E_NETWORK=intercept, to target
 * the live Vercel deployment instead of a local `npm run build` - see hosted-multiplayer.e2e.js's
 * header for why local mode avoids the sandbox's TLS-intercepting-proxy problem entirely)
 */

/* eslint-disable no-console */
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { chromium, request } = require("playwright");
const { interceptContextNetwork } = require("./proxy-network");

const PROJECT_REF = "mitawjpdxkheascdiffz";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pdGF3anBkeGtoZWFzY2RpZmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5Mjc3OTcsImV4cCI6MjA5ODUwMzc5N30.TXqMIk3KMpGycxJ0o952eX8og3F3kAS8gv-I3U2CPe0";

const PORT = Number(process.env.E2E_PORT || 4174);
const LOCAL = process.env.E2E_BASE_URL === "local";
const INTERCEPT = process.env.E2E_NETWORK === "intercept";
const BASE_URL = LOCAL ? `http://127.0.0.1:${PORT}` : process.env.E2E_BASE_URL || "https://gaia-lost-fleet.vercel.app";
const DIST = path.join(__dirname, "..", "dist", "app");
const GAME_ID = process.env.GAME_ID;
const ARTIFACTS = process.env.E2E_ARTIFACTS || os.tmpdir();

function requireSession(envVar) {
  const file = process.env[envVar];
  if (!file) {
    throw new Error(`${envVar} must point to a session JSON file`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
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

async function newSessionContext(browser, session, label, intercept) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 } });
  if (intercept) {
    await interceptContextNetwork(context, intercept.requestContext, intercept.proxyUrl, label);
  }
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
    if (msg.type() === "error" && !msg.text().includes("dicebear")) {
      console.log(`  [${label} console.error] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => console.log(`  [${label} pageerror] ${err.message}`));
  page.on("dialog", async (dialog) => {
    console.log(`  [${label} dialog] ${dialog.message()}`);
    await dialog.accept();
  });
  return page;
}

let step = 0;
function check(name) {
  step++;
  console.log(`✔ ${step}. ${name}`);
}

// Composes ONE move via the real Commands.vue buttons (category -> suboption -> End Turn ->
// Confirm End Turn), used both for a real turn and for premove composition (the button set is
// identical either way - premove mode just operates on a preview clone under the hood).
async function composeUpMove(page, categoryLabel, trackLabel) {
  await page.locator("button", { hasText: categoryLabel }).click();
  await page.locator("button", { hasText: trackLabel }).click();
  await page.locator("button", { hasText: "End Turn" }).click();
  await page.locator("button", { hasText: "Confirm End Turn" }).click();
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
    [`https://${PROJECT_REF}.supabase.co`, ANON_KEY, PROJECT_REF, gameId]
  );
}

async function waitForMoveCount(page, gameId, count, timeout = 20000) {
  await page.waitForFunction(
    async ([url, anon, ref, game, n]) => {
      const stored = JSON.parse(window.localStorage.getItem(`sb-${ref}-auth-token`));
      const res = await fetch(`${url}/rest/v1/moves?game_id=eq.${game}&select=seq`, {
        headers: { apikey: anon, Authorization: `Bearer ${stored.access_token}` },
      });
      return (await res.json()).length >= n;
    },
    [`https://${PROJECT_REF}.supabase.co`, ANON_KEY, PROJECT_REF, gameId, count],
    { timeout }
  );
}

async function main() {
  if (!GAME_ID) {
    throw new Error("GAME_ID must be set (seed the game via SQL first)");
  }
  const sessionA = requireSession("E2E_SESSION_A");
  const sessionB = requireSession("E2E_SESSION_B");
  let server = null;
  if (LOCAL) {
    if (!fs.existsSync(path.join(DIST, "index.html"))) {
      throw new Error(`no build at ${DIST} - run \`npx vue-cli-service build\` in viewer/ first`);
    }
    server = await serveDist();
  }

  console.log(`target: ${BASE_URL} game=${GAME_ID}`);
  const browser = await chromium.launch({
    executablePath: process.env.PW_EXECUTABLE || undefined,
    // Unlike hosted-multiplayer.e2e.js, keep the proxy even in LOCAL mode: Chromium bypasses it
    // for loopback addresses automatically, but the page's own outbound calls to the real
    // Supabase backend still need it in this sandbox.
    proxy:
      !INTERCEPT && process.env.HTTPS_PROXY
        ? { server: process.env.HTTPS_PROXY, bypass: "127.0.0.1,localhost" }
        : undefined,
  });

  let intercept = null;
  if (INTERCEPT) {
    const requestContext = await request.newContext({
      proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
    });
    intercept = { requestContext, proxyUrl: process.env.HTTPS_PROXY };
  }

  const pageA = await newSessionContext(browser, sessionA, "A", intercept);
  const pageB = await newSessionContext(browser, sessionB, "B", intercept);

  try {
    await pageA.goto(`${BASE_URL}/?game=${GAME_ID}`);
    await pageA.waitForSelector(".badge", { timeout: 30000 });
    await pageA.waitForTimeout(5000);
    check("browser A (Alice): loaded game directly, her real turn");

    await pageB.goto(`${BASE_URL}/?game=${GAME_ID}`);
    await pageB.waitForSelector(".badge", { timeout: 30000 });
    await pageB.waitForTimeout(5000);
    check("browser B (Bob): loaded game directly, locked out (Alice to move)");

    // --- Bob queues a 2-deep Sequential premove chain, entirely before Alice moves at all ---
    await pageB.locator("button", { hasText: "Plan my move" }).click();
    await composeUpMove(pageB, "Research", "Terraforming");
    await pageB.locator("button", { hasText: "Queue this move" }).click();
    check("browser B: queued premove #1 (up terra) via real UI");
    await pageB.screenshot({ path: path.join(ARTIFACTS, "phase3-after-queue1.png"), fullPage: true });

    await pageB.locator("button", { hasText: "Plan my move" }).click();
    await composeUpMove(pageB, "Research", "Navigation");
    await pageB.locator("button", { hasText: "Queue this move" }).click();
    check("browser B: queued premove #2 (up nav) via real UI");

    const pill = pageB.locator("button", { hasText: "Premoves" });
    console.log("  pill text:", await pill.textContent());
    await pill.click();
    await pageB.waitForSelector(".premove-overview .premove-row", { timeout: 10000 });
    const rows = await pageB.locator(".premove-overview .premove-row").allTextContents();
    console.log("  overview rows:", JSON.stringify(rows));
    await pageB.screenshot({ path: path.join(ARTIFACTS, "phase3-overview-modal.png"), fullPage: true });
    if (rows.length !== 2) {
      throw new Error(`expected 2 queued premoves in overview, got ${rows.length}`);
    }
    check("browser B: overview modal shows both queued premoves, ranked 1/2");
    await pageB.locator("button", { hasText: /^Close$/ }).click().catch(() => undefined);
    await pageB.keyboard.press("Escape").catch(() => undefined);

    // --- Alice makes her real move #1 (via the real UI), handing the turn to Bob ---
    await composeUpMove(pageA, "Research", "Gaia Project");
    check("browser A: committed her real move #1 (up gaia) via real UI");

    // --- Bob's premove #1 should now fire automatically, server-side, with NO action from B ---
    await waitForMoveCount(pageA, GAME_ID, 2, 20000);
    let moves = await committedMoves(pageA, GAME_ID);
    console.log("  moves after Alice's move #1:", JSON.stringify(moves));
    if (moves.length !== 2 || moves[1].seat !== 1) {
      throw new Error(`expected premove #1 to auto-fire for seat 1, got ${JSON.stringify(moves)}`);
    }
    check(`browser B's premove #1 fired automatically: ${moves[1].move}`);

    // --- Alice makes her real move #2, handing the turn to Bob again ---
    await pageA.reload();
    await pageA.waitForSelector(".badge", { timeout: 30000 });
    await pageA.waitForTimeout(3000);
    await composeUpMove(pageA, "Research", "Economy");
    check("browser A: committed her real move #2 (up eco) via real UI");

    // --- Bob's premove #2 should now fire automatically too ---
    await waitForMoveCount(pageA, GAME_ID, 4, 20000);
    moves = await committedMoves(pageA, GAME_ID);
    console.log("  moves after Alice's move #2:", JSON.stringify(moves));
    if (moves.length !== 4 || moves[3].seat !== 1) {
      throw new Error(`expected premove #2 to auto-fire for seat 1, got ${JSON.stringify(moves)}`);
    }
    check(`browser B's premove #2 fired automatically, IN ORDER: ${moves[3].move}`);

    console.log(`\nALL CHECKS PASSED - game ${GAME_ID} left in place for inspection/cleanup.`);
    return 0;
  } catch (err) {
    console.error(`\nFAILED at step ${step + 1}: ${err.message}`);
    await pageA.screenshot({ path: path.join(ARTIFACTS, "phase3-A-fail.png"), fullPage: true }).catch(() => undefined);
    await pageB.screenshot({ path: path.join(ARTIFACTS, "phase3-B-fail.png"), fullPage: true }).catch(() => undefined);
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
