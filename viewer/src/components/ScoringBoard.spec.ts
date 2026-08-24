import Engine from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import ScoringBoard from "./ScoringBoard.vue";

// ScoringBoard.vue itself no longer knows about Lost Fleet - Game.vue only mounts it for base
// games (`v-if="!engine.options.lostFleet"`), since Lost Fleet moved final scoring onto the map
// itself (SpaceMap.vue) and the 7th adv-tech + round scoring tiles into ResearchBoard.vue's own
// extra column. See Game.spec.ts for the component-selection tests.
describe("ScoringBoard", () => {
  it("renders final scoring and round scoring tiles for a base game", () => {
    const engine = new Engine(["init 2 base-game-seed"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(ScoringBoard, { store });

    expect(container.querySelectorAll(".finalScoringTile").length).to.equal(engine.tiles.scorings.final.length);
    expect(container.querySelectorAll(".scoringTile").length).to.equal(engine.tiles.scorings.round.length);
  });
});
