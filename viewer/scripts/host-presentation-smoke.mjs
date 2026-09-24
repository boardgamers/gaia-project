import assert from "node:assert/strict";

export async function checkHostPresentation(page, hostName, screenshot) {
  await page.evaluate((key) => {
    window.presentationEvents = [];
    for (const name of ["player:hovered", "thumbnail:ready", "move"]) {
      window[key].on(name, (data) => presentationEvents.push({ name, data }));
    }
  }, hostName);
  const name = page.locator("[data-bgs-player]:visible").first();
  await name.hover();
  const index = Number(await name.getAttribute("data-bgs-player"));
  await page.waitForFunction(() => presentationEvents.some((e) => e.name === "player:hovered" && e.data));
  const hover = await page.evaluate(() => presentationEvents.findLast((e) => e.name === "player:hovered").data);
  assert.equal(hover.index, index);
  assert.ok(hover.anchor.width > 0 && hover.anchor.height > 0);
  await name.dispatchEvent("mouseout", { relatedTarget: null });
  assert.equal(await page.evaluate(() => presentationEvents.findLast((e) => e.name === "player:hovered").data), null);
  const focusable = page.locator("button[data-bgs-player]:visible, [data-bgs-player][tabindex]:visible").first();
  await focusable.focus();
  assert.ok(await page.evaluate(() => presentationEvents.findLast((e) => e.name === "player:hovered").data));
  await focusable.blur();
  assert.equal(await page.evaluate(() => presentationEvents.findLast((e) => e.name === "player:hovered").data), null);
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.evaluate((key) => {
    window[key].emit("preferences", { sound: false, thumbnail: true });
    window[key].emit("player", {});
    window[key].emit("thumbnail:render", { width: 1200, height: 630 });
  }, hostName);
  await page.waitForFunction(() => presentationEvents.some((e) => e.name === "thumbnail:ready"), null, {
    timeout: 5000,
  });
  const result = await page.evaluate(() => presentationEvents.findLast((e) => e.name === "thumbnail:ready").data);
  assert.equal(result.supported, true);
  assert.deepEqual(result.bounds, { x: 0, y: 0, width: 1200, height: 630 });
  assert.equal(await page.locator(".bgs-board-thumbnail").count(), 1);
  assert.ok(
    await page.locator(".bgs-board-thumbnail").evaluate((preview) =>
      [...preview.querySelectorAll("path, rect, circle, text, image, button")].some((node) => {
        const bounds = node.getBoundingClientRect();
        return bounds.width > 20 && bounds.height > 10;
      })
    ),
    "the preview contains visible board content"
  );
  await page.locator(".bgs-board-thumbnail").screenshot({ path: screenshot });
  await page.evaluate((key) => window[key].emit("thumbnail:render", { width: 1200, height: 630 }), hostName);
  await page.waitForFunction(() => presentationEvents.filter((e) => e.name === "thumbnail:ready").length === 2);
  assert.equal(await page.locator(".bgs-board-thumbnail").count(), 1, "a repeated capture replaces the previous one");
  assert.equal(await page.evaluate(() => presentationEvents.filter((e) => e.name === "move").length), 0);
}
