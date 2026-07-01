import Engine, { ScoringBoardExtensionSide } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import ScoringBoard from "./ScoringBoard.vue";

describe("ScoringBoard", () => {
  it("renders the Lost Fleet scoring-board extension tile when present", () => {
    const engine = new Engine(["init 2 lf-scoring-extension"], { lostFleet: true });
    engine.scoringExtensionSide = ScoringBoardExtensionSide.VictoryPoints;

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container, getByText } = render(ScoringBoard, { store });

    expect(container.querySelector(".techTile.adv-ext")).to.not.equal(null);
    expect(getByText("Extension")).to.not.equal(null);
    expect(getByText("25 VP")).to.not.equal(null);
  });

  it("shows the explored-ships gate when the reverse side is active", () => {
    const engine = new Engine(["init 3 lf-scoring-extension-ships"], { lostFleet: true });
    engine.scoringExtensionSide = ScoringBoardExtensionSide.ExploredShips;

    const store = makeStore();
    store.commit("receiveData", engine);

    const { getByText } = render(ScoringBoard, { store });

    expect(getByText("3 Ships")).to.not.equal(null);
  });
});
