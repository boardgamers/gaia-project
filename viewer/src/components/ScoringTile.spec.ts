import Engine, { ScoringTile as ScoringTileEnum } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import ScoringTile from "./ScoringTile.vue";

describe("ScoringTile", () => {
  it("renders the Lost Fleet lfsector3 tile with a Sector icon and no raw text fallback", () => {
    const engine = new Engine(["init 2 scoring-tile-lfsector3"], { lostFleet: true });
    engine.tiles.scorings.round[0] = ScoringTileEnum.LfSector3;

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(ScoringTile, { store, props: { round: 1 } });

    expect(container.querySelector(".condition")).to.not.equal(null);
    expect(container.textContent).to.not.contain("newsector");
  });

  it("renders the Lost Fleet lflab4 tile through the normal building-icon path", () => {
    const engine = new Engine(["init 2 scoring-tile-lflab4"], { lostFleet: true });
    engine.tiles.scorings.round[0] = ScoringTileEnum.LfLab4;

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(ScoringTile, { store, props: { round: 1 } });

    expect(container.querySelector(".condition")).to.not.equal(null);
    expect(container.textContent).to.not.contain("lab");
  });
});
