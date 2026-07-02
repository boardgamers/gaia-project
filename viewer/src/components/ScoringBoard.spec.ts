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
    expect(getByText("7th adv. tech:")).to.not.equal(null);
    // the 25-VP gate renders as a VP resource icon, not text
    const vpGate = container.querySelector('[data-extension-gate="vp"]');
    expect(vpGate).to.not.equal(null);
    expect(vpGate.textContent).to.contain("25");
    expect(container.querySelector('[data-extension-gate="ships"]')).to.equal(null);
  });

  it("shows the explored-ships gate when the reverse side is active", () => {
    const engine = new Engine(["init 3 lf-scoring-extension-ships"], { lostFleet: true });
    engine.scoringExtensionSide = ScoringBoardExtensionSide.ExploredShips;

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(ScoringBoard, { store });

    // the 3-explored-ships gate renders as 3 ship markers, not text
    const shipsGate = container.querySelector('[data-extension-gate="ships"]');
    expect(shipsGate).to.not.equal(null);
    expect(shipsGate.querySelectorAll("circle.extension-ship").length).to.equal(3);
    expect(container.querySelector('[data-extension-gate="vp"]')).to.equal(null);
  });
});
