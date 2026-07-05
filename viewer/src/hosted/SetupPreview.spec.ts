import { fireEvent, render } from "@testing-library/vue";
import { expect } from "chai";
import BootstrapVue from "bootstrap-vue";
import Vue from "vue";
import SetupPreview from "./SetupPreview.vue";

Vue.use(BootstrapVue);

function firstSector(container: HTMLElement): Element {
  const sector = container.querySelector(".sector");
  expect(sector, "expected at least one rendered sector").to.not.equal(null);
  return sector;
}

function firstSectorHex(container: HTMLElement): Element {
  const hex = firstSector(container).querySelector(".space-hex-cell use");
  expect(hex, "expected a clickable hex inside the first sector").to.not.equal(null);
  return hex;
}

function sectorStyle(container: HTMLElement): string {
  return firstSector(container).getAttribute("style") || "";
}

function seedText(container: HTMLElement): string | null {
  return container.querySelector("code")?.textContent ?? null;
}

// Full render-path coverage for the setup-preview screen: real Lost Fleet
// components (map/research/scoring/ships/terraforming board), the live
// click-to-rotate mechanism (no arming step), reroll/seed history, player
// count changes, and the German-rules validity guard - no separate lock-in
// step, the preview continuously emits its current state instead. Follows
// the render-path testing convention from PERFORMANCE.md / SpaceMap.spec.ts.
describe("SetupPreview", () => {
  it("renders a full Lost Fleet setup with real components", async () => {
    const { container } = render(SetupPreview, { props: { playerCount: 2 } });
    await Vue.nextTick();

    expect(container.querySelectorAll(".sector").length).to.be.greaterThan(0);
    expect(container.querySelectorAll("svg.lost-fleet-ship").length).to.equal(3); // Rebellion excluded at 2p
    expect(container.querySelector("svg.research-board")).to.not.equal(null);
    expect(seedText(container)).to.be.a("string").that.is.not.empty;
    // No separate lock-in step - "Create game" lives in CreateGame.vue and
    // acts on whatever SetupPreview currently emits.
    expect(container.textContent).to.not.contain("Lock in");
  });

  it("does not render the base game's ScoringBoard sidebar (SetupPreviewBoard is Lost Fleet only)", async () => {
    // Regression test: SetupPreviewBoard used to render ScoringBoard unconditionally alongside
    // ResearchBoard's own Lost Fleet round/final-scoring column, producing two adjacent columns of
    // round scoring tiles - i.e. 12 .scoringTile elements (2x6 round tiles) instead of 6.
    const { container } = render(SetupPreview, { props: { playerCount: 2 } });
    await Vue.nextTick();

    expect(container.querySelectorAll(".scoringTile").length).to.equal(6);
  });

  it("does not crop the left edge of the research board (its own -50 x-offset must match the outer viewBox)", async () => {
    // Regression test: the outer <svg viewBox> used to start at x=0 while ResearchBoard was
    // positioned at x=-50 inside it, cropping the leftmost 50 units (the research track's own left
    // edge) off screen.
    const { container } = render(SetupPreview, { props: { playerCount: 2 } });
    await Vue.nextTick();

    const outer = container.querySelector("svg.scoring-research-board");
    const researchBoard = container.querySelector("svg.research-board");
    expect(outer, "expected the outer research/scoring svg").to.not.equal(null);
    expect(researchBoard, "expected the nested ResearchBoard svg").to.not.equal(null);

    const outerMinX = Number(outer!.getAttribute("viewBox")!.split(" ")[0]);
    expect(outerMinX).to.equal(-50);
    expect(researchBoard!.getAttribute("x")).to.equal("-50");
  });

  it("emits the current setup state on mount and after every seed/rotation change", async () => {
    const { container, getByText, emitted } = render(SetupPreview, { props: { playerCount: 2 } });
    await Vue.nextTick();

    const initial = emitted()["update"];
    expect(initial).to.not.equal(undefined);
    const initialPayload = initial[initial.length - 1][0];
    expect(initialPayload.seed).to.equal(seedText(container));
    expect(initialPayload.valid).to.equal(true);

    await fireEvent.click(firstSectorHex(container));
    await Vue.nextTick();

    const afterRotate = emitted()["update"];
    const latest = afterRotate[afterRotate.length - 1][0];
    expect(latest.rotateMove).to.match(/^p2 rotate( .+ 1)?$/);
    expect(latest.valid).to.be.a("boolean");
  });

  it("clicking a hex increments its sector's rotation exactly once per click", async () => {
    const { container } = render(SetupPreview, { props: { playerCount: 2 } });
    await Vue.nextTick();

    expect(sectorStyle(container)).to.contain("rotate(0deg)");

    await fireEvent.click(firstSectorHex(container));
    await Vue.nextTick();
    expect(sectorStyle(container)).to.contain("rotate(60deg)");

    await fireEvent.click(firstSectorHex(container));
    await Vue.nextTick();
    expect(sectorStyle(container)).to.contain("rotate(120deg)");

    // 4 more clicks (6 total) is visually back to unrotated (mod 6 wraps at lock-in time too)
    for (let i = 0; i < 4; i++) {
      await fireEvent.click(firstSectorHex(container));
      await Vue.nextTick();
    }
    expect(sectorStyle(container)).to.contain("rotate(360deg)");
  });

  it("reroll changes the seed and re-renders the board", async () => {
    const { container, getByText } = render(SetupPreview, { props: { playerCount: 2 } });
    await Vue.nextTick();

    const seedBefore = seedText(container);
    await fireEvent.click(getByText("Reroll"));
    await Vue.nextTick();

    expect(seedText(container)).to.not.equal(seedBefore);
    // still a fully rendered setup after the reroll, not a stale/empty board
    expect(container.querySelectorAll(".sector").length).to.be.greaterThan(0);
  });

  it("changing player count resets to a fresh seed", async () => {
    const { container, updateProps } = render(SetupPreview, { props: { playerCount: 2 } });
    await Vue.nextTick();

    const seedBefore = seedText(container);
    await updateProps({ playerCount: 3 });
    await Vue.nextTick();

    expect(seedText(container)).to.not.equal(seedBefore);
    expect(container.querySelectorAll("svg.lost-fleet-ship").length).to.equal(4); // Rebellion included at 3p
  });

  it("shows a warning and emits valid: false for a rotation that violates the German-rules assert", async () => {
    const { container, getByText, emitted } = render(SetupPreview, { props: { playerCount: 2 } });
    await Vue.nextTick();

    // Same seed/center/rotation as the engine regression test
    // (engine/src/map.spec.ts): rotating the (0,0) sector 3 times on this
    // seed at 2p puts two matching planet types adjacent. (0,0) is always
    // lostFleetSectorCenters(2)[0], i.e. the first .sector rendered.
    const seedInput = container.querySelector("input") as HTMLInputElement;
    await fireEvent.update(seedInput, "lost-fleet-space-map");
    await fireEvent.click(getByText("Use seed"));
    await Vue.nextTick();
    expect(seedText(container)).to.equal("lost-fleet-space-map");

    for (let i = 0; i < 3; i++) {
      await fireEvent.click(firstSectorHex(container));
      await Vue.nextTick();
    }

    expect(container.textContent).to.contain("Map is invalid with two planets for the same type being near each other");
    const events = emitted()["update"];
    const latest = events[events.length - 1][0];
    expect(latest.valid).to.equal(false);
  });
});
