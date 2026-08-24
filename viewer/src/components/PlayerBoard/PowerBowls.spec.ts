import Engine, { AuctionVariant, Faction, Phase, Spaceship } from "@gaia-project/engine";
import Event from "@gaia-project/engine/src/events";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../../store";
import PowerBowls from "./PowerBowls.vue";

describe("PowerBowls", () => {
  it("shows a bowl III income indicator once the Power artifact's ongoing +2 income is loaded", () => {
    const engine = new Engine(["init 2 power-bowls-artifact", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });
    const player = engine.players[0];
    player.loadEvents(Event.parse(["+2ta3"], Spaceship.Twilight));

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PowerBowls, { props: { player }, store });

    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).to.include("+2");
  });

  it("does not show a bowl III income indicator without the artifact", () => {
    const engine = new Engine(["init 2 power-bowls-no-artifact", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });
    const player = engine.players[0];

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PowerBowls, { props: { player }, store });

    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).to.not.include("+2");
  });

  it("shows the bowl I power-token income hint from the faction's base income before the board loads", () => {
    // Every player has picked (Phase.SetupPreferenceBid) but the auction hasn't resolved, so
    // `pl.board`/`pl.data` are still unloaded - same state as PlayerInfo.spec.ts's bid-phase tests.
    const engine = new Engine(
      ["init 3 power-bowls-unloaded", "p1 faction itars", "p2 faction terrans", "p3 faction hadsch-hallas"],
      { auction: AuctionVariant.PreferenceSplit, auctionBudget: 30 }
    );
    expect(engine.phase).to.equal(Phase.SetupPreferenceBid);

    const player = engine.players[0];
    expect(player.faction).to.equal(Faction.Itars);
    expect(player.board, "board is not loaded yet").to.equal(null);

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PowerBowls, { props: { player }, store });
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);

    // Itars' standard board round income is "+o,k,t": +1 power token into bowl I every round.
    expect(texts).to.include("+1");
  });
});
