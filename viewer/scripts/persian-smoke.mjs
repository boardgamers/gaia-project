import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { previewServer } from "./tutorial-preview.mjs";

const fa = JSON.parse(await readFile(new URL("../src/localization/fa.json", import.meta.url), "utf8"));
const { lessons } = createRequire(import.meta.url)("./tutorial-manifest.cjs");
const server = previewServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE });
try {
  for (const lesson of lessons) {
    const page = await browser.newPage({ viewport: { width: 390, height: 950 } });
    await page.goto(`http://127.0.0.1:${server.address().port}/?chapter=${lesson.id}&locale=fa-IR`);
    await page.waitForFunction(() => window.progress?.step === 0);
    const expected = fa[lesson.steps[0].title];
    assert.ok(expected, `${lesson.id}: first-step title has a catalogue entry`);
    await page.waitForFunction(
      (expected) => document.querySelector(".bgs-tutorial-heading")?.textContent.includes(expected),
      expected
    );
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, lesson.id);
    await page.close();
  }
  console.log(`PASS Persian opening titles and mobile layout for all ${lessons.length} chapters`);
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?chapter=first-mine&locale=fa-IR`);
    await page.waitForFunction(() => window.progress?.step === 0);
    await page.getByRole("button", { name: fa["Most victory points"], exact: true }).waitFor();
    assert.equal(await page.locator("[data-gaia-locale]").getAttribute("lang"), "fa");
    assert.equal(await page.locator("[data-gaia-locale]").evaluate((el) => getComputedStyle(el).direction), "ltr");
    assert.equal(await page.locator(".bgs-tutorial-body").evaluate((el) => getComputedStyle(el).direction), "rtl");
    assert.equal(
      await page
        .locator(".tutorial-board svg")
        .first()
        .evaluate((el) => getComputedStyle(el).direction),
      "ltr"
    );
    assert.ok(!/[A-Za-z]{4}/.test(await page.locator(".bgs-tutorial-body").innerText()), "opening prose is Persian");
    assert.ok((await page.locator(".bgs-tutorial-heading").innerText()).includes("شش دور برای امتیازگیری"));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    await page.screenshot({ path: `/tmp/gaia-fa-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: fa["Most victory points"], exact: true }).click();
    await page.waitForFunction(() => window.progress?.step === 1);
    assert.ok((await page.locator(".bgs-tutorial-body").innerText()).includes("سیارهٔ آبی"));
    assert.ok(await page.locator('.bgs-tutorial-body [data-resource="o"]').count(), "localized ore retains its icon");
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS Persian tutorial, RTL prose, LTR board and progress at ${width}px`);
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
