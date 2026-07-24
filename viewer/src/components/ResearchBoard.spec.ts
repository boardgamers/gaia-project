import Engine, { ResearchField, ScoringBoardExtensionSide } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import ResearchBoard from "./ResearchBoard.vue";

describe("ResearchBoard", () => {
  it("does not add the 7th (Scoring Board Extension) column for a base game", () => {
    const engine = new Engine(["init 2 base-game-seed"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(ResearchBoard, { store });

    expect(container.querySelector(".techTile.adv-ext")).to.equal(null);
    const [, , width] = container.querySelector("svg").getAttribute("viewBox").split(" ").map(Number);
    expect(width).to.equal(ResearchField.values(engine.expansions).length * 60);
  });

  it("adds a 7th column aligned with the adv-tech row, with an icon-based VP gate, for a Lost Fleet game", () => {
    const engine = new Engine(["init 2 lf-scoring-extension"], { lostFleet: true });
    engine.scoringExtensionSide = ScoringBoardExtensionSide.VictoryPoints;
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(ResearchBoard, { store });

    const advExt = container.querySelector(".techTile.adv-ext");
    expect(advExt).to.not.equal(null);
    const gate = container.querySelector('.extension-gate[data-gate-kind="vp"]');
    expect(gate).to.not.equal(null);
    expect(gate?.getAttribute("aria-label")).to.equal("Requires 25 victory points");
    expect(gate?.querySelector("g.resource .vp")).to.not.equal(null);
    expect(gate?.textContent).to.contain("25");
    expect(gate?.textContent).to.not.contain("vp");

    // Aligned with the other 6 adv-tech tiles: same y-translate (79) as ResearchTrack.vue's own
    // `translate(30, 79) scale(0.95)` for its adv-tech tile.
    const advExtGroup = advExt!.closest("g[transform]");
    expect(advExtGroup!.getAttribute("transform")).to.contain("translate(30, 79)");

    // Round scoring tiles render in the same column, "just under" the adv-tech tile.
    const scoringTiles = container.querySelectorAll(".scoringTile");
    expect(scoringTiles.length).to.equal(engine.tiles.scorings.round.length);

    // Each tile is 40 units tall but the track's own level slots are only 38 apart - scaled down
    // to 0.9 (36 tall, matching ResearchTile's own height in the same slots) so consecutive tiles
    // don't overlap.
    for (const tile of Array.from(scoringTiles)) {
      expect(tile.getAttribute("transform")).to.contain("scale(0.9)");
    }
  });

  it("shows a counted spaceship icon when the explored-ships gate is active", () => {
    const engine = new Engine(["init 3 lf-scoring-extension-ships"], { lostFleet: true });
    engine.scoringExtensionSide = ScoringBoardExtensionSide.ExploredShips;
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(ResearchBoard, { store });

    const gate = container.querySelector('.extension-gate[data-gate-kind="ships"]');
    expect(gate).to.not.equal(null);
    expect(gate?.getAttribute("aria-label")).to.equal("Requires 3 explored spaceships");
    expect(gate?.querySelector(".extension-gate__ship-icon")).to.not.equal(null);
    expect(gate?.querySelector(".extension-gate__count")?.textContent).to.equal("3");
    expect(gate?.textContent).to.not.contain("explorations");
  });

  it("spaces every round scoring tile the same distance apart", () => {
    const engine = new Engine(["init 2 lf-scoring-extension"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(ResearchBoard, { store });

    const ys = Array.from(container.querySelectorAll(".scoringTile")).map((tile) => {
      const match = tile.getAttribute("transform")!.match(/translate\(0, (-?\d+(?:\.\d+)?)\)/);
      return Number(match![1]);
    });
    const gaps = new Set(ys.slice(1).map((y, i) => Math.abs(y - ys[i])));
    expect(gaps.size).to.equal(1);
  });

  it("renders final scoring directly below the round scoring tiles, in the same column", () => {
    const engine = new Engine(["init 2 lost-fleet-space-map"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(ResearchBoard, { store });

    const tiles = container.querySelectorAll(".finalScoringTile");
    expect(tiles.length).to.equal(engine.tiles.scorings.final.length);

    const scoringTiles = container.querySelectorAll(".scoringTile");
    const lastRoundTileY = Math.max(
      ...Array.from(scoringTiles).map((tile) =>
        Number(tile.getAttribute("transform")!.match(/translate\(0, (-?\d+)\)/)![1])
      )
    );
    const finalGroup = tiles[0].closest("g[transform]")!;
    const finalY = Number(finalGroup.getAttribute("transform")!.match(/translate\(0, (-?\d+)\)/)![1]);
    expect(finalY).to.be.greaterThan(lastRoundTileY);
  });

  it("widens the viewBox by the extra column's width for Lost Fleet games", () => {
    const withoutExt = new Engine(["init 2 base-game-seed"]);
    const storeWithout = makeStore();
    storeWithout.commit("receiveData", withoutExt);
    const { container: containerWithout } = render(ResearchBoard, { store: storeWithout });
    const [, , widthWithout] = containerWithout.querySelector("svg").getAttribute("viewBox").split(" ").map(Number);

    const withExt = new Engine(["init 2 lf-scoring-extension"], { lostFleet: true });
    const storeWith = makeStore();
    storeWith.commit("receiveData", withExt);
    const { container: containerWith } = render(ResearchBoard, { store: storeWith });
    const [, , widthWith] = containerWith.querySelector("svg").getAttribute("viewBox").split(" ").map(Number);

    expect(widthWith).to.equal(widthWithout + 70);
  });
});
