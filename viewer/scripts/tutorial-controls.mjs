import assert from "node:assert/strict";

// Read button metadata only to identify the normal control for an engine command.
// Every action is performed by clicking that visible control in the browser.
export async function playOnBoard(page, move, step) {
  const guideError = page.locator('.bgs-tutorial-body [role="alert"]');
  const priorError = (await guideError.isVisible()) ? await guideError.innerText() : "";
  for (let attempt = 0; attempt < 35; attempt++) {
    // Move off the previous control so its hover tooltip cannot cover the next one.
    await (page.mouse ?? page.page().mouse).move(0, 0);
    if (await page.evaluate((step) => progress.step !== step, step)) return;
    const confirmation = page.locator(".modal.show .modal-footer .btn-primary");
    if (await confirmation.isVisible()) {
      await confirmation.click();
      await page.waitForTimeout(120);
      continue;
    }
    const endSelection = page.locator("#move-buttons").getByRole("button", { name: "End Selection", exact: true });
    if (await endSelection.isVisible()) {
      await endSelection.click();
      await page.waitForTimeout(120);
      continue;
    }
    const selection = await page.locator("#move-buttons [data-ref]:visible").evaluateAll((elements, wanted) => {
      const controller = elements[0]?.__vue__?.controller;
      if (!controller) return { missing: true };
      const normalize = (text) =>
        text
          .replace(/-?\d+x-?\d+|\d+[ABC]\d*/g, (coord) => controller.engine.map.getS(coord)?.toString() ?? coord)
          .replace(
            /^[\w-]+\s+(?=build|up |pass|action|special|burn|spend|federation|tech|cover|explore|spaceshipAction|examineArtifact|chooseArtifactToken)/,
            ""
          )
          .replace(
            /(federation )([^ ]+)/g,
            (_match, command, location) => command + location.split(",").sort().join(",")
          )
          .replace(/\s*\.\s*/g, ". ")
          .trim();
      const expected = normalize(wanted);
      const current = normalize(controller.currentMove || "");
      const prefix = current ? current.replace(/\.\s*$/, "") + ". " : "";
      const chain = controller.commandChain.filter(Boolean).join(" ");
      const start = prefix + (chain ? chain + " " : "");
      const matches = (command) => {
        const candidate = normalize(start + command);
        return expected === candidate || expected.startsWith(candidate + " ") || expected.startsWith(candidate + ".");
      };
      const candidates = elements.flatMap((el, index) => {
        const button = el.__vue__.button;
        return (button.times ?? [1]).map((times) => ({
          index,
          button,
          times,
          command: String(button.command ?? "")
            .replace(/\d+/g, (n) => String(Number(n) * times))
            .replace(/\$times/g, String(times)),
        }));
      });
      const target = /build \S+ (\S+)/.exec(expected.slice(prefix.length))?.[1]?.replace(/\.$/, "");
      const containsTarget = (button) => button.command === target || button.buttons?.some(containsTarget);
      const option = candidates.find(
        ({ button, command }) =>
          !button.disabled &&
          button.command &&
          matches(command) &&
          (!target || !/^build \S+$/.test(command) || !button.buttons || containsTarget(button))
      );
      if (option)
        return {
          index: option.index,
          times: option.button.times ? option.times : undefined,
          command: option.command,
          current,
          start,
          expected,
        };
      const confirm = elements.findIndex((el) => el.__vue__.button.command === "" && /^Confirm/.test(el.innerText));
      if (confirm >= 0 && start.trim() === expected.trim()) return { index: confirm };
      const free = elements.findIndex((el) => /^Free action/.test(el.__vue__.button.label));
      if (free >= 0 && /^(burn|spend)\b/.test(expected.slice(prefix.length))) return { index: free };
      const end = elements.findIndex((el) => /End turn/i.test(el.innerText));
      if (end >= 0 && expected.replace(/\.\s*$/, "") === current.replace(/\.\s*$/, "")) return { index: end };
      return {
        current,
        start,
        expected,
        buttons: elements.map((el) => ({
          text: el.innerText,
          command: el.__vue__.button.command,
          times: el.__vue__.button.times,
        })),
      };
    }, move);
    if (selection.index === undefined) {
      const end = page.locator("#move-buttons").getByRole("button", { name: /^End turn/ });
      if ((await end.count()) && selection.expected?.replace(/\.\s*$/, "") === selection.current?.replace(/\.\s*$/, ""))
        await end.click();
      else throw Error("No native control for " + move + ": " + JSON.stringify(selection));
    } else {
      const control = page.locator("#move-buttons [data-ref]:visible").nth(selection.index);
      if (selection.times > 1) {
        await control.locator(".dropdown-toggle").click();
        await control.getByRole("menuitem", { name: String(selection.times), exact: true }).click();
      } else await control.locator("button").first().click();
    }
    await page.waitForTimeout(120);
    const error = page.locator('.bgs-tutorial-body [role="alert"]');
    if ((await error.isVisible()) && (await error.innerText()) !== priorError) throw Error(await error.innerText());
  }
  assert.fail("Native action did not complete: " + move);
}
