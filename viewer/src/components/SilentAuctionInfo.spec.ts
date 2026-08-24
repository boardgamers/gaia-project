import Engine, { AuctionVariant, Faction, PlayerEnum } from "@gaia-project/engine";
import { mount } from "@vue/test-utils";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import SilentAuctionInfo from "./SilentAuctionInfo.vue";

Vue.use(BootstrapVue);

/**
 * The explainer's worked example is hardcoded, so it can silently drift away from what the engine
 * actually does. This replays the example as a real game and pins every number in it - the bids,
 * every step of the resolution log, the prices paid and the resulting turn order - against
 * `resolveSilentAuction`'s real output.
 */
describe("SilentAuctionInfo", () => {
  const seats = ["A", "B", "C"];
  const factions = [Faction.Itars, Faction.Taklons, Faction.Xenos];
  const factionLabel = { [Faction.Itars]: "Itars", [Faction.Taklons]: "Taklons", [Faction.Xenos]: "Xenos" };

  const info = new SilentAuctionInfo();

  const bidFor = (player: string, faction: string) =>
    info.exampleBids.find((row) => row.faction === faction)[player] as number;

  async function openModal() {
    const wrapper = mount(SilentAuctionInfo, { attachTo: document.body });
    wrapper.vm.$bvModal.show("silent-auction-info");
    await Vue.nextTick();
    await Vue.nextTick();
    return wrapper;
  }

  it("explains that a higher bid means you want the faction more", async () => {
    const wrapper = await openModal();
    const text = document.body.textContent ?? "";

    expect(text).to.contain("most Victory Points you will pay");
    expect(text).to.contain("highest on the one you want most");
    expect(text).to.contain("You never pay more than you bid");
    // This used to say "Bid 0 on your favorite", which is exactly backwards: the bid is what you
    // are willing to pay, so your favourite faction gets your highest number, not 0.
    expect(text.toLowerCase()).to.not.contain("0 on your favorite");

    wrapper.destroy();
  });

  it("defines a deal in its own highlighted box, with a worked example inside it", async () => {
    const wrapper = await openModal();
    const box = document.body.querySelector(".deal-box");

    expect(box, "the deal definition needs its own highlighted box").to.not.equal(null);
    const boxText = box?.textContent ?? "";
    expect(boxText).to.contain("your bid");
    expect(boxText).to.contain("cost you right now");
    // Costs and a concrete example both belong inside the box, not scattered through the prose.
    expect(boxText).to.contain("price + 1");
    expect(boxText).to.contain("free Taklons is still a deal of");

    // The rule the box exists to support.
    expect(document.body.textContent).to.contain("you always take the faction giving you your best deal");

    wrapper.destroy();
  });

  it("matches the engine for the worked example", () => {
    const bids = seats.map(
      (seat, i) =>
        `p${i + 1} silentBid itars ${bidFor(seat, "Itars")} taklons ${bidFor(seat, "Taklons")} xenos ${bidFor(
          seat,
          "Xenos"
        )}`
    );

    const engine = new Engine(
      [
        "init 3 silent-auction-info",
        "p1 banFaction terrans",
        "p2 banFaction lantids",
        "p3 banFaction hadsch-hallas",
        // Picks are made in seat order, and `setup` keeps that order - which is also the turn order
        // the explainer's last table claims.
        "p1 faction itars",
        "p2 faction taklons",
        "p3 faction xenos",
        ...bids,
      ],
      { auction: AuctionVariant.Silent }
    );

    expect(engine.setup).to.deep.equal(factions);

    const actualSteps = engine.silentAuctionLog.map((step, i) => ({
      step: i + 1,
      player: seats[step.player],
      faction: factionLabel[step.faction],
      action: step.skipped ? "passes" : `takes at ${step.price}`,
    }));

    expect(actualSteps).to.deep.equal(
      info.exampleSteps.map(({ step, player, faction, action }) => ({ step, player, faction, action }))
    );

    const actualResult = factions.map((faction, i) => {
      const winner = engine.players.find((pl) => pl.faction === faction);
      return {
        faction: factionLabel[faction],
        winner: seats[winner.player as PlayerEnum],
        pays: winner.data.bid,
        turnOrder: ["1st", "2nd", "3rd"][engine.turnOrderAfterSetupAuction.indexOf(winner.player as PlayerEnum)],
      };
    });

    expect(actualResult).to.deep.equal(info.exampleResult);
  });
});
