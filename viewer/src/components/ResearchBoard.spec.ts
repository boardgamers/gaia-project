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

  it("adds a 7th column aligned with the adv-tech row, with a plain-text VP gate label, for a Lost Fleet game", () => {
    const engine = new Engine(["init 2 lf-scoring-extension"], { lostFleet: true });
    engine.scoringExtensionSide = ScoringBoardExtensionSide.VictoryPoints;
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container, getByText } = render(ResearchBoard, { store });

    const advExt = container.querySelector(".techTile.adv-ext");
    expect(advExt).to.not.equal(null);
    expect(getByText("25 vp")).to.not.equal(null);

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

  it("shows the explored-ships gate label when the reverse side is active", () => {
    const engine = new Engine(["init 3 lf-scoring-extension-ships"], { lostFleet: true });
    engine.scoringExtensionSide = ScoringBoardExtensionSide.ExploredShips;
    const store = makeStore();
    store.commit("receiveData", engine);

    const { getByText } = render(ResearchBoard, { store });

    expect(getByText("3 explorations")).to.not.equal(null);
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

    expect(widthWith).to.equal(widthWithout + 90);
  });
});
