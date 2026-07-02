/* End-to-end verification of the Supabase hosted multiplayer mode.
 *
 * Drives TWO real Chromium browsers through the production Supabase project:
 * lobby, game creation with invites, seat locking, faction picks in the real
 * UI, realtime fan-out to the other browser, and reload-resume from the
 * stored move log. This intentionally hits the real backend — run it with
 * throwaway test accounts only, and clean up the created game afterwards.
 *
 * Not part of the mocha suite; run manually:
 *
 *   1. Provide two signed-in sessions as JSON files (the exact response of
 *      POST /auth/v1/token?grant_type=password — see BACKEND.md §11 notes):
 *        E2E_SESSION_A=/path/alice.json  E2E_SESSION_B=/path/bob.json
 *   2. node e2e/hosted-multiplayer.e2e.js
 *
 * By default this drives the LIVE production deployment
 * (https://gaia-lost-fleet.vercel.app). Set E2E_BASE_URL=local to serve a
 * fresh `npm run build` from dist/app on 127.0.0.1 instead (note: some
 * sandboxed environments force all browser traffic through an HTTPS proxy
 * that cannot serve loopback plain-HTTP — production mode avoids that).
 *
 * Optional env: E2E_BASE_URL (url | "local"), E2E_PORT (default 4173),
 * PW_EXECUTABLE (chromium path), E2E_ARTIFACTS (failure screenshot dir).
 * E2E_NETWORK=intercept routes all browser traffic through Node instead of
 * Chromium's own TLS stack (see proxy-network.js for why) — set
 * NODE_EXTRA_CA_CERTS to the proxy CA bundle alongside it.
 * Requires the `playwright` package to be resolvable (NODE_PATH works).
 */

/* eslint-disable no-console */
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { chromium, request } = require("playwright");
const { interceptContextNetwork } = require("./proxy-network");

const PROJECT_REF = "mitawjpdxkheascdiffz";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pdGF3anBkeGtoZWFzY2RpZmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5Mjc3OTcsImV4cCI6MjA5ODUwMzc5N30.TXqMIk3KMpGycxJ0o952eX8og3F3kAS8gv-I3U2CPe0";

const PORT = Number(process.env.E2E_PORT || 4173);
const LOCAL = process.env.E2E_BASE_URL === "local";
const INTERCEPT = process.env.E2E_NETWORK === "intercept";
const BASE_URL = LOCAL ? `http://127.0.0.1:${PORT}` : process.env.E2E_BASE_URL || "https://gaia-lost-fleet.vercel.app";
const DIST = path.join(__dirname, "..", "dist", "app");
const ARTIFACTS = process.env.E2E_ARTIFACTS || os.tmpdir();

function requireSession(envVar) {
  const file = process.env[envVar];
  if (!file) {
    throw new Error(`${envVar} must point to a session JSON file`);
  }
  const session = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!session.access_token || !session.user) {
    throw new Error(`${envVar} (${file}) is not a token response`);
  }
  return session;
}

function serveDist() {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
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
      // about:blank and data: documents throw on localStorage access; and
      // never clobber an existing session — supabase-js rotates the refresh
      // token, so re-seeding the original one after a reload would leave a
      // dead (410 Gone) refresh token in place.
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
      console.log(`  [${label} console.error] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => console.log(`  [${label} pageerror] ${err.message}`));
  return page;
}

let step = 0;
function check(name) {
  step++;
  console.log(`✔ ${step}. ${name}`);
}

async function barBadge(page) {
  return (await page.locator(".badge").first().textContent()).trim();
}

async function waitForBadge(page, text, timeout = 30000) {
  await page.waitForFunction(
    (expected) => {
      const badge = document.querySelector(".badge");
      return badge && badge.textContent.trim() === expected;
    },
    text,
    { timeout }
  );
}

async function pickFirstFaction(page) {
  const factionButton = page.locator("button.move-button").first();
  await factionButton.waitFor({ state: "visible", timeout: 20000 });
  const label = (await factionButton.textContent()).trim();
  await factionButton.click();
  const ok = page.locator("button", { hasText: "OK, I pick this one!" });
  await ok.waitFor({ state: "visible", timeout: 10000 });
  await ok.click();
  return label;
}

// Reads the committed moves straight from PostgREST, authenticated with the
// page's CURRENT access token from localStorage (supabase-js refreshes it;
// the one from the session file may have expired mid-run).
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

async function main() {
  const sessionA = requireSession("E2E_SESSION_A");
  const sessionB = requireSession("E2E_SESSION_B");
  let server = null;
  if (LOCAL) {
    if (!fs.existsSync(path.join(DIST, "index.html"))) {
      throw new Error(`no build at ${DIST} — run \`npm run build\` in viewer/ first`);
    }
    server = await serveDist();
  }
  console.log(`target: ${BASE_URL}${INTERCEPT ? " (network: node-intercepted)" : ""}`);
  const browser = await chromium.launch({
    executablePath: process.env.PW_EXECUTABLE || undefined,
    // In proxied sandboxes all HTTPS goes through HTTPS_PROXY (TLS is
    // re-terminated there, hence ignoreHTTPSErrors on the contexts). If the
    // proxy rejects Chromium's TLS ClientHello, use E2E_NETWORK=intercept.
    proxy: !LOCAL && !INTERCEPT && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
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
  const gameName = `E2E ${new Date().toISOString().slice(0, 16)}`;

  try {
    // --- Lobby boots with a stored session (no magic link involved) ---
    await pageA.goto(`${BASE_URL}/?lobby=1`);
    await pageA.locator("h3", { hasText: "The Lost Fleet — Games" }).waitFor({ timeout: 30000 });
    check("browser A: supabase-js loaded, session accepted, lobby rendered");

    // --- Create a 2p Lost Fleet game via the real form ---
    await pageA.locator('input[placeholder="Friday fleet night"]').fill(gameName);
    const emails = pageA.locator('input[type="email"]');
    const names = pageA.locator('input[placeholder="Display name"]');
    if ((await emails.nth(0).inputValue()) !== sessionA.user.email) {
      throw new Error("seat 1 email was not prefilled with the host's address");
    }
    await names.nth(0).fill("Alice");
    await emails.nth(1).fill(sessionB.user.email);
    await names.nth(1).fill("Bob");
    await pageA.locator("button", { hasText: "Create game" }).click();
    await pageA.waitForURL(/\?game=/, { timeout: 30000 });
    const gameId = new URL(pageA.url()).searchParams.get("game");
    check(`create_game RPC + redirect (game ${gameId})`);

    // --- Seat locking on both sides ---
    await waitForBadge(pageA, "Your turn");
    if (!(await pageA.locator("text=You play Alice").count())) {
      throw new Error("browser A is not seated as Alice");
    }
    check("browser A: seat 0 locked, engine says it's A's turn");

    await pageB.goto(`${BASE_URL}/?game=${gameId}`);
    await waitForBadge(pageB, "Alice to move");
    if (!(await pageB.locator("text=You play Bob").count())) {
      throw new Error("browser B is not seated as Bob");
    }
    if (await pageB.locator("button.move-button").count()) {
      throw new Error("browser B can act out of turn — seat lock failed");
    }
    check("browser B: sees the same game, locked out while A is to move");

    // --- A commits a faction pick through the real UI ---
    const factionA = await pickFirstFaction(pageA);
    check(`browser A: picked faction via UI (${factionA})`);

    // --- Realtime fan-out: B unlocks WITHOUT reloading ---
    await waitForBadge(pageB, "Your turn");
    check("browser B: unlocked in realtime after A's commit (no reload)");
    await waitForBadge(pageA, "Bob to move");
    check("browser A: now locked, B to move");

    // --- B commits its faction pick ---
    const factionB = await pickFirstFaction(pageB);
    await waitForBadge(pageA, "Your turn");
    check(`browser B: picked faction via UI (${factionB}); A unlocked in realtime`);

    // --- Persistence: the move log survives a full reload ---
    await pageA.reload();
    await waitForBadge(pageA, "Your turn");
    const moves = await committedMoves(pageA, gameId);
    if (moves.length !== 2 || moves[0].seq !== 1 || moves[1].seq !== 2) {
      throw new Error(`expected 2 committed moves, got ${JSON.stringify(moves)}`);
    }
    check(`reload-resume from stored log (${moves.map((m) => JSON.stringify(m.move)).join(", ")})`);

    // --- Best-effort: place the first mine by clicking the live map ---
    const hex = pageA.locator("use.space-hex.pointer").first();
    if (await hex.count()) {
      await hex.click({ force: true });
      // placing a mine needs an explicit confirmation click
      const confirm = pageA.locator("button", { hasText: "Confirm Mine" });
      await confirm.waitFor({ state: "visible", timeout: 10000 });
      await confirm.click();
      await pageA.waitForFunction(
        async ([url, anon, ref, game]) => {
          const stored = JSON.parse(window.localStorage.getItem(`sb-${ref}-auth-token`));
          const res = await fetch(`${url}/rest/v1/moves?game_id=eq.${game}&select=seq`, {
            headers: { apikey: anon, Authorization: `Bearer ${stored.access_token}` },
          });
          return (await res.json()).length >= 3;
        },
        [SUPABASE_URL, ANON_KEY, PROJECT_REF, gameId],
        { timeout: 20000 }
      );
      await waitForBadge(pageB, "Your turn");
      check("browser A: placed the first mine via map click; B unlocked in realtime");
    } else {
      console.log("~ skipped map-click mine placement (no selectable hex found)");
    }

    console.log(`\nALL CHECKS PASSED — game ${gameId} ("${gameName}") left in place for inspection/cleanup.`);
    return 0;
  } catch (err) {
    const shotA = path.join(ARTIFACTS, "e2e-hosted-A.png");
    const shotB = path.join(ARTIFACTS, "e2e-hosted-B.png");
    await pageA.screenshot({ path: shotA, fullPage: true }).catch(() => undefined);
    await pageB.screenshot({ path: shotB, fullPage: true }).catch(() => undefined);
    console.error(`\nFAILED at step ${step + 1}: ${err.message}`);
    console.error(`screenshots: ${shotA} , ${shotB}`);
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
