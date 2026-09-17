import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { playOnBoard } from "./tutorial-controls.mjs";
import { previewServer } from "./tutorial-preview.mjs";
const require = createRequire(import.meta.url);
const { lessons } = require("./tutorial-manifest.cjs");
const server = previewServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE });
try {
  for (const width of process.env.WIDTH ? [Number(process.env.WIDTH)] : [1440, 390])
    for (const lesson of lessons.filter((l) => !process.env.CHAPTER || l.id === process.env.CHAPTER)) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      console.log(`START ${lesson.id} ${width}`);
      await page.goto(`http://127.0.0.1:${server.address().port}/?chapter=${lesson.id}`);
      await page.waitForFunction(() => window.progress?.step === 0);
      let state = lesson.initialState();
      for (let index = 0; index < lesson.steps.length; index++) {
        const step = lesson.steps[index];
        const action = step.solution(state);
        console.log(`  ${step.id}`);
        if (action.kind === "answer") {
          const choice = step.choices(state).find((choice) => choice.action.answer === action.answer);
          await page.locator(".tutorial-choices").getByRole("button", { name: choice.label, exact: true }).click();
        } else if (action.kind === "probe") {
          await page.locator("#move-buttons").getByRole("button", { name: "End Selection", exact: true }).click();
          await page
            .locator("#move-buttons")
            .getByRole("button", { name: /^Federation 1:/ })
            .click();
        } else {
          assert.equal(
            await page.locator(".tutorial-choices button").filter({ hasNotText: "Restore this attempt" }).count(),
            0,
            "no shortcut for game moves"
          );
          await page.waitForFunction(
            () =>
              ![...document.querySelectorAll("button")].find((button) => button.textContent === "Show area")?.disabled
          );
          if (lesson.id === "first-mine") {
            const wrongPlanet = await page
              .locator("#move-buttons [data-ref]")
              .first()
              .evaluate((el) => {
                const engine = el.__vue__.controller.engine;
                return engine
                  .findAvailableCommand(0, "build")
                  .data.buildings.find(
                    (b) =>
                      b.building === "m" &&
                      !b.upgrade &&
                      engine.map.getS(b.coordinates).toString() !== engine.map.getS("1x0").toString()
                  ).coordinates;
              });
            await assert.rejects(playOnBoard(page, `terrans build m ${wrongPlanet}.`, index), /Follow this step/);
            assert.equal(await page.evaluate(() => progress.step), index, "wrong move stays on the current step");
            assert.equal(
              await page
                .locator("#move-buttons [data-ref]")
                .first()
                .evaluate((el) => el.__vue__.controller.engine.players[0].data.ores),
              8,
              "rejected move spends no ore"
            );
          }
          await playOnBoard(page, action.move, index);
        }
        await page.waitForFunction((n) => window.progress?.step === n, index + 1);
        state = lesson.move(state, action);
        if (index === 0) {
          await page.reload();
          await page.waitForFunction(() => window.progress?.step === 1);
        }
      }
      assert.equal(await page.evaluate(() => window.progress.completed), true);
      assert.deepEqual(errors, [], `${lesson.id} has no browser errors`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
      assert.equal(overflow, false, `${lesson.id} fits width ${width}`);
      if (["federation-routes", "first-mine", "exploration"].includes(lesson.id))
        await page.screenshot({ path: `/tmp/gaia-${lesson.id}-${width}.png`, fullPage: true });
      console.log(`PASS ${lesson.id} ${width}`);
      await page.close();
    }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
