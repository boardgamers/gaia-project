/* Manual, throwaway exploration/verification script for Premove Phase 3 (Sequential + Priority
 * queues) against the real hosted backend. NOT part of the committed test suite - see
 * hosted-multiplayer.e2e.js's header for the general pattern this borrows from.
 *
 * Unlike hosted-multiplayer.e2e.js, this script does NOT create the game through the UI (game
 * creation is admin-only, migration 0008_admin_only_create_game.sql) - it expects a game already
 * seeded directly via SQL (both e2e-alice/e2e-bob as seats 0/1, already advanced past setup into
 * Phase.RoundMove) and takes the game id via GAME_ID.
 *
 * Usage:
 *   E2E_SESSION_A=... E2E_SESSION_B=... GAME_ID=<uuid> PW_EXECUTABLE=/opt/pw-browsers/chromium \
 *     NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt E2E_NETWORK=intercept \
 *     node e2e/premove-phase3.e2e.js
 */

/* eslint-disable no-console */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium, request } = require("playwright");
const { interceptContextNetwork } = require("./proxy-network");

const PROJECT_REF = "mitawjpdxkheascdiffz";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pdGF3anBkeGtoZWFzY2RpZmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5Mjc3OTcsImV4cCI6MjA5ODUwMzc5N30.TXqMIk3KMpGycxJ0o952eX8og3F3kAS8gv-I3U2CPe0";

const BASE_URL = process.env.E2E_BASE_URL || "https://gaia-lost-fleet.vercel.app";
const GAME_ID = process.env.GAME_ID;
const ARTIFACTS = process.env.E2E_ARTIFACTS || os.tmpdir();

function requireSession(envVar) {
  const file = process.env[envVar];
  if (!file) {
    throw new Error(`${envVar} must point to a session JSON file`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
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
    if (msg.type() === "error") {
      console.log(`  [${label} console.error] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => console.log(`  [${label} pageerror] ${err.message}`));
  page.on("console", (msg) => console.log(`  [${label} console.${msg.type()}] ${msg.text()}`));
  page.on("response", (res) => {
    if (res.status() >= 400) {
      console.log(`  [${label} http ${res.status()}] ${res.url()}`);
    }
  });
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

async function main() {
  if (!GAME_ID) {
    throw new Error("GAME_ID must be set (seed the game via SQL first)");
  }
  const sessionA = requireSession("E2E_SESSION_A");
  const sessionB = requireSession("E2E_SESSION_B");

  console.log(`target: ${BASE_URL} game=${GAME_ID}`);
  const browser = await chromium.launch({ executablePath: process.env.PW_EXECUTABLE || undefined });

  let intercept = null;
  if (process.env.E2E_NETWORK === "intercept") {
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
    check("browser A loaded game directly");
    await pageA.waitForTimeout(8000);
    await pageA.screenshot({ path: path.join(ARTIFACTS, "phase3-A-initial.png"), fullPage: true });

    await pageB.goto(`${BASE_URL}/?game=${GAME_ID}`);
    await pageB.waitForSelector(".badge", { timeout: 30000 });
    check("browser B loaded game directly");
    await pageB.waitForTimeout(8000);
    await pageB.screenshot({ path: path.join(ARTIFACTS, "phase3-B-initial.png"), fullPage: true });

    // --- Bob (not on turn): open premove composer ---
    await pageB.locator("button", { hasText: "Plan my move" }).click();
    check("browser B: clicked Plan my move");
    await pageB.screenshot({ path: path.join(ARTIFACTS, "phase3-B-premove-mode.png"), fullPage: true });

    await pageB.locator("button", { hasText: "Research" }).click();
    check("browser B: clicked Research");
    await pageB.screenshot({ path: path.join(ARTIFACTS, "phase3-B-research.png"), fullPage: true });

    await pageB.locator("button", { hasText: "Terraforming" }).click();
    check("browser B: clicked Terraforming track");
    await pageB.screenshot({ path: path.join(ARTIFACTS, "phase3-B-terra.png"), fullPage: true });

    await pageB.locator("button", { hasText: "End Turn" }).click();
    check("browser B: clicked End Turn");
    await pageB.screenshot({ path: path.join(ARTIFACTS, "phase3-B-endturn.png"), fullPage: true });

    const confirmBtns = pageB.locator("button", { hasText: "Confirm End Turn" });
    console.log("  Confirm End Turn button count:", await confirmBtns.count());
    console.log(
      "  disabled prop:",
      await confirmBtns.first().evaluate((el) => el.disabled)
    );
    console.log(
      "  elementFromPoint match:",
      await confirmBtns.first().evaluate((el) => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return top === el || el.contains(top) ? "self" : `OTHER: ${top ? top.outerHTML.slice(0, 200) : "null"}`;
      })
    );
    const vueInfoBefore = await pageB.evaluate(() => {
      function findVue(el) {
        return el.__vue__ || (el.parentElement && findVue(el.parentElement)) || null;
      }
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Confirm End Turn"));
      const vm = btn && findVue(btn);
      if (!vm) return "no vue instance found";
      return {
        found: true,
        hasStore: !!vm.$store,
        premoveMode: vm.$root && vm.$root.$children && "n/a",
      };
    });
    console.log("  vue probe before:", JSON.stringify(vueInfoBefore));

    console.log(
      "  raw DOM click result:",
      await confirmBtns.first().evaluate((el) => {
        el.click();
        return "dispatched";
      })
    );
    check("browser B: raw DOM clicked Confirm End Turn");
    await pageB.waitForTimeout(2000);
    console.log("  outerHTML after click:", await confirmBtns.first().evaluate((el) => el.outerHTML).catch((e) => e.message));
    const queueBtn = pageB.locator("button", { hasText: "Queue this move" });
    console.log("  queue button disabled?", await queueBtn.isDisabled());
    console.log("  banner text:", await pageB.locator(".premove-banner, .alert-info").first().textContent().catch(() => "n/a"));
    await pageB.screenshot({ path: path.join(ARTIFACTS, "phase3-B-confirmed.png"), fullPage: true });

    console.log(`\nSCREENSHOTS WRITTEN to ${ARTIFACTS} for inspection. Stopping here for now.`);
    return 0;
  } catch (err) {
    console.error(`\nFAILED at step ${step + 1}: ${err.message}`);
    await pageA.screenshot({ path: path.join(ARTIFACTS, "phase3-A-fail.png"), fullPage: true }).catch(() => undefined);
    await pageB.screenshot({ path: path.join(ARTIFACTS, "phase3-B-fail.png"), fullPage: true }).catch(() => undefined);
    return 1;
  } finally {
    await browser.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
