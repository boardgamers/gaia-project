import Engine, { Federation, PlayerEnum } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import FederationTile from "./FederationTile.vue";

// The pool half of the "claimed since your last turn" mark. A token in the pool has no owner, so it
// marks for any taker; the copy on a player board carries a `player` and marks only for them (that
// half is covered in PlayerInfo.spec.ts).
describe("FederationTile", () => {
  function storeWithClaim() {
    const engine = new Engine(["init 2 federation-pool-mark", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    (engine as any).moveHistory = [
      "init 2 federation-pool-mark",
      "terrans build m 1A1",
      `hadsch-hallas federation 1A2,1A3 ${Federation.Fed2}`,
    ];
    (engine as any).advancedLog = [{ player: 0, move: 1 }, { player: 1, move: 2 }, { player: 0 }];

    const store = makeStore();
    store.commit("player", { index: PlayerEnum.Player1 });
    store.commit("receiveData", engine);
    return store;
  }

  it("marks a pool token whose stack an opponent just claimed from", () => {
    const store = storeWithClaim();

    const { container } = render(FederationTile, { props: { federation: Federation.Fed2, numTiles: 2 }, store });
    expect(container.querySelector("g.federationTile.last-move")).to.not.equal(null);
  });

  it("leaves the other tokens in the pool alone", () => {
    const store = storeWithClaim();

    const { container } = render(FederationTile, { props: { federation: Federation.Fed3, numTiles: 2 }, store });
    expect(container.querySelector("g.federationTile.last-move")).to.equal(null);
  });

  it("marks a player's copy only for the player who claimed it", () => {
    const store = storeWithClaim();

    const { container: taker } = render(FederationTile, {
      props: { federation: Federation.Fed2, numTiles: 1, player: PlayerEnum.Player2 },
      store,
    });
    expect(taker.querySelector("g.federationTile.last-move")).to.not.equal(null);

    const { container: other } = render(FederationTile, {
      props: { federation: Federation.Fed2, numTiles: 1, player: PlayerEnum.Player1 },
      store,
    });
    expect(other.querySelector("g.federationTile.last-move")).to.equal(null);
  });
});
