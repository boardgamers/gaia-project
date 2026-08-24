import Engine, { AuctionVariant, Phase, ResearchField } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import ResearchTile from "./ResearchTile.vue";

describe("ResearchTile during a sealed-bid auction's bid phase", () => {
  // Same setup as PlayerInfo.spec.ts's "before the auction/pick phase loads the board" - every
  // player has picked (`pl.faction` set) but the auction hasn't resolved, so `pl.board` is still
  // null and `pl.data.research` is still all zeros.
  it("shows a player's token at their faction's real starting research level, not stuck at level 0", () => {
    const engine = new Engine(
      ["init 3 research-tile-unloaded", "p1 faction moweyds", "p2 faction tinkeroids", "p3 faction bescods"],
      { auction: AuctionVariant.PreferenceSplit, auctionBudget: 30, lostFleet: true }
    );
    expect(engine.phase).to.equal(Phase.SetupPreferenceBid);
    expect(engine.players[0].board, "board is not loaded yet").to.equal(null);
    expect(engine.players[0].data.research[ResearchField.GaiaProject], "unloaded default").to.equal(0);

    const store = makeStore();
    store.commit("receiveData", engine);

    // Moweyds' standard board income includes "up-gaia": they start bumped to level 1 in Gaia
    // Project, while Tinkeroids/Bescods (no such bump) correctly stay at level 0.
    const { container: level0 } = render(ResearchTile, {
      props: { field: ResearchField.GaiaProject, level: 0, y: 0 },
      store,
    });
    expect(level0.querySelectorAll(".player-token").length, "Tinkeroids and Bescods stay here").to.equal(2);

    const { container: level1 } = render(ResearchTile, {
      props: { field: ResearchField.GaiaProject, level: 1, y: 0 },
      store,
    });
    expect(level1.querySelectorAll(".player-token").length, "Moweyds should show here, not at level 0").to.equal(1);
  });
});
