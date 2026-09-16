import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { previewServer } from "./tutorial-preview.mjs";
const require = createRequire(import.meta.url);
const { lessons } = require("./tutorial-manifest.cjs");
const server = previewServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE });
try {
  for (const width of [1440, 390])
    for (const lesson of lessons) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/?chapter=${lesson.id}`);
      await page.waitForFunction(() => window.progress?.step === 0);
      let state = lesson.initialState();
      for (let index = 0; index < lesson.steps.length; index++) {
        const step = lesson.steps[index];
        const action = step.solution(state);
        const choice = step.choices(state).find((choice) => JSON.stringify(choice.action) === JSON.stringify(action));
        assert(choice, `solution for ${lesson.id}/${step.id} has a visible control`);
        await page.getByRole("button", { name: choice.label, exact: true }).click();
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
