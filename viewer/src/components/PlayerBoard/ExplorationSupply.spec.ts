import Engine, { Expansion, Faction, Spaceship } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { effectivePreviewPlayer, factionPreviewEngine } from "../../data/faction-preview";
import ExplorationSupply from "./ExplorationSupply.vue";

Vue.use(BootstrapVue);

describe("ExplorationSupply local proposal", () => {
  function setup(count = 2, faction = Faction.Terrans) {
    const engine = factionPreviewEngine(faction);
    // Supply depends only on seat count, not on faction-preview engine's two seats.
    while (engine.players.length < count) engine.players.push(engine.players[1]);
    return { engine, data: engine.players[0].data };
  }

  for (const count of [2, 4]) {
    it(`starts with ${count === 2 ? 2 : 3} shuttles in a ${count}-player game`, () => {
      const props = setup(count);
      const { container } = render(ExplorationSupply, { props });
      expect(container.querySelector("text").textContent).to.equal(count === 2 ? "2" : "3");
    });
  }

  it("prints one black lander and one count, with no track or individual pieces", () => {
    for (const faction of [Faction.Terrans, Faction.Moweyds]) {
      const { container } = render(ExplorationSupply, { props: setup(4, faction) });
      expect(container.querySelectorAll("path")).to.have.length(1);
      const symbol = container.querySelector(".shuttle-symbol");
      expect(symbol.getAttribute("fill")).to.equal("black");
      expect(symbol.getAttribute("opacity")).to.equal("0.8");
      expect(symbol.getAttribute("transform")).to.equal("scale(0.04)");
      // One silhouette with an actual transparent cockpit cutout, not a white/shaded overlay.
      expect(symbol.getAttribute("fill-rule")).to.equal("evenodd");
      expect(symbol.getAttribute("d").match(/M/g)).to.have.length(2);
      expect(container.querySelectorAll("text")).to.have.length(1);
      expect(container.querySelector(".remaining-count").getAttribute("fill")).to.equal("black");
      expect(
        container.querySelector("rect, circle, .planet-fill, .shuttle-slot, .shuttle-token, .shuttle-consumed-mark")
      ).to.equal(null);
    }
  });

  it("counts occupied ships, not the numeric slot indices", async () => {
    const props = setup(4);
    props.data.explorationShips[Spaceship.TFMars] = 4;
    const { container, updateProps } = render(ExplorationSupply, { props });
    expect(container.querySelector("text").textContent).to.equal("2");
    const next = setup(4).data;
    for (const ship of Spaceship.values(Expansion.LostFleet).slice(0, 3)) next.explorationShips[ship] = 2;
    await updateProps({ data: next });
    expect(container.querySelector("text").textContent).to.equal("0");
    expect(container.querySelector(".exploration-supply--empty")).not.to.equal(null);
    expect(container.querySelector("g").getAttribute("aria-label")).to.equal("Exploration shuttles remaining: 0 of 3");
  });

  it("includes the Moweyds starting shuttle", () => {
    const props = setup(4, Faction.Moweyds);
    expect(props.data.exploredShipsCount()).to.equal(1);
    const { container } = render(ExplorationSupply, { props });
    expect(container.querySelector("text").textContent).to.equal("2");
  });

  it("hides the supply in the base game and for Automa", async () => {
    const props = setup();
    const { container, updateProps } = render(ExplorationSupply, { props: { ...props, automa: true } });
    expect(container.querySelector(".exploration-supply")).to.equal(null);
    const engine = new Engine(["init 2 shuttle-base", "p1 faction terrans", "p2 faction xenos"]);
    expect(engine.expansions).not.to.equal(Expansion.LostFleet);
    await updateProps({ engine, automa: false });
    expect(container.querySelector(".exploration-supply")).to.equal(null);
  });

  it("reads effective preview data rather than the uninitialized seat", () => {
    const props = setup(4, Faction.Moweyds);
    const seat = props.engine.players[0];
    seat.board = undefined;
    seat.data.explorationShips = {};
    const data = effectivePreviewPlayer(seat).data;
    const { container } = render(ExplorationSupply, {
      props: { engine: props.engine, data },
    });
    expect(container.querySelector("text").textContent).to.equal("2");
  });
});
