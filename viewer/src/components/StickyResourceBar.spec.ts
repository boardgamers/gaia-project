import Engine, { PowerArea } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import StickyResourceBar from "./StickyResourceBar.vue";

describe("StickyResourceBar", () => {
  it("marks the bowl holding Taklons' Brainstone with a B badge, and no others", () => {
    const engine = new Engine(["init 2 sticky-resource-bar-brainstone-spec", "p1 faction taklons", "p2 faction terrans"], {
      lostFleet: true,
    });
    const player = engine.players[0];
    player.data.brainstone = PowerArea.Area2;

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(StickyResourceBar, { props: { player }, store });

    expect(container.querySelectorAll(".sticky-resource-bar__brainstone").length).to.equal(1);
    expect(container.querySelector(".sticky-resource-bar__brainstone-label").textContent).to.equal("B");
  });

  it("shows no Brainstone badge for factions without one", () => {
    const engine = new Engine(["init 2 sticky-resource-bar-no-brainstone-spec", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });
    const player = engine.players[0];

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(StickyResourceBar, { props: { player }, store });

    expect(container.querySelector(".sticky-resource-bar__brainstone")).to.equal(null);
  });

  it("shows victory points last, and one distinctly-colored circle per power bowl", () => {
    const engine = new Engine(["init 2 sticky-resource-bar-spec", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });
    const player = engine.players[0];
    player.data.victoryPoints = 13;
    player.data.power.area1 = 2;
    player.data.power.area2 = 1;
    player.data.power.area3 = 4;

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(StickyResourceBar, { props: { player }, store });

    // 3 bowl circles, each a distinct fill color, showing each area's own count
    const bowlCircles = Array.from(container.querySelectorAll("circle.sticky-resource-bar__bowl"));
    expect(bowlCircles.length).to.equal(3);
    const colors = bowlCircles.map((c) => (c as SVGElement).getAttribute("style"));
    expect(new Set(colors).size).to.equal(3);

    const counts = Array.from(container.querySelectorAll(".sticky-resource-bar__count")).map((t) => t.textContent);
    expect(counts).to.deep.equal(["2", "1", "4"]);

    // Victory points is the last svg in the bar
    const svgs = Array.from(container.querySelectorAll(".sticky-resource-bar > svg"));
    const lastSvg = svgs[svgs.length - 1];
    expect(lastSvg.querySelector("g.resource")).to.not.equal(null);
    expect(lastSvg.querySelector("text")?.textContent).to.equal("13");
  });

  it("no longer shows sector count, federation count, or research track pips", () => {
    const engine = new Engine(["init 2 sticky-resource-bar-spec-2", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });
    const player = engine.players[0];

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(StickyResourceBar, { props: { player }, store });

    expect(container.querySelector(".sticky-resource-bar__research")).to.equal(null);
    expect(container.querySelector(".federationTile")).to.equal(null);
  });
});
