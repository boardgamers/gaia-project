import Engine, { Building, Faction, GaiaHex, Planet } from "@gaia-project/engine";
import { fireEvent, render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { MapModeType } from "../../data/actions";
import { makeStore } from "../../store";
import PlayerBoardInfo from "./Info.vue";

Vue.use(BootstrapVue);

function setup(lostFleet = true, faction = Faction.Terrans) {
  const engine = new Engine(["init 2 compact-board-stats", `p1 faction ${faction}`, "p2 faction xenos"], { lostFleet });
  const player = engine.players[0];
  const store = makeStore();
  store.commit("receiveData", engine);
  return { engine, player, store, props: { player, faction: player.faction, data: player.data, height: 21.4 } };
}

function colony(sector: string, q: number) {
  return new GaiaHex(q, 0, { sector, planet: Planet.Terra, player: 0, building: Building.Mine });
}

describe("PlayerBoardInfo Lost Fleet stats", () => {
  it("preserves the base-game positions, sizes and comma spacing", () => {
    const { props, store } = setup(false);
    const { container } = render(PlayerBoardInfo, { props, store });
    expect(container.querySelector(".exploration-supply")).to.equal(null);
    expect(container.querySelector('[data-board-stat="deep-space-sectors"]')).to.equal(null);
    const satellites = container.querySelector('[data-board-stat="satellites"]');
    const federations = container.querySelector('[data-board-stat="federations"]');
    expect(satellites.getAttribute("transform")).to.equal("translate(15.2, 1.4)");
    expect(satellites.querySelector("text").textContent.trim()).to.equal("0, 25");
    expect(federations.getAttribute("transform")).to.equal("translate(15.2, 3.5)");
    expect(federations.querySelector("image").getAttribute("transform")).to.equal("scale(0.1)");
    expect(federations.querySelector("text").textContent.trim()).to.equal("0, 0");
    expect(container.querySelector('[data-board-stat="sectors"]').getAttribute("transform")).to.equal(
      "translate(12.4, 3.5)"
    );
    expect(container.querySelectorAll(".research-counter")[5].getAttribute("transform")).to.equal(
      "translate(10.6,3.5) scale(1)"
    );
  });

  it("outlines research counters on Lost Fleet Lantids boards without changing base-game counters", () => {
    for (const lostFleet of [false, true]) {
      const { props, store } = setup(lostFleet, Faction.Lantids);
      const { container } = render(PlayerBoardInfo, { props, store });
      const counters = container.querySelectorAll(".research-counter .research-tile");
      expect(counters).to.have.length(6);
      for (const counter of Array.from(counters)) {
        expect(counter.classList.contains("research-tile--outlined")).to.equal(lostFleet);
      }
    }
  });

  it("stacks shuttles above satellites and federations without an extra board row", () => {
    const { props, store } = setup();
    const { container } = render(PlayerBoardInfo, { props, store });
    expect(container.querySelector(".exploration-supply").getAttribute("transform")).to.equal("translate(15.5, 0.65)");
    const satellites = container.querySelector('[data-board-stat="satellites"]');
    const federations = container.querySelector('[data-board-stat="federations"]');
    expect(satellites.getAttribute("transform")).to.equal("translate(15.5, 2.05)");
    expect(federations.getAttribute("transform")).to.equal("translate(15.5, 3.5)");
    expect(satellites.querySelector("text").textContent.trim()).to.equal("0,25");
    expect(federations.querySelector("text").textContent.trim()).to.equal("0,0");
    expect(federations.querySelector("image").getAttribute("transform")).to.equal("scale(0.075)");
    expect(container.querySelectorAll(".research-counter")[5].getAttribute("transform")).to.equal(
      "translate(8.75,3.5) scale(1)"
    );
    expect(container.querySelector(".board-info > rect").getAttribute("height")).to.equal("8");
  });

  it("shows separate ordinary and Deep Space tile counts and keeps the combined sector shortcut", async () => {
    const { props, store, player } = setup();
    player.data.occupied.push(colony("s1", 1), colony("s2", 2), ...[0, 1, 2].map((i) => colony(`DS11_${i}`, 3 + i)));
    const { container } = render(PlayerBoardInfo, { props, store });
    const normal = container.querySelector('[data-board-stat="sectors"]');
    const deep = container.querySelector('[data-board-stat="deep-space-sectors"]');
    expect(normal.querySelector("text").textContent.trim()).to.equal("2");
    expect(deep.querySelector("text").textContent.trim()).to.equal("1");
    expect(deep.getAttribute("title")).to.contain("Deep Space sectors with a colonized planet");
    expect(deep.querySelectorAll("polygon")).to.have.length(3);
    expect(deep.querySelector(".deep-space-sector--white")).not.to.equal(null);
    await fireEvent.click(deep.querySelector("polygon"));
    expect(store.getters.mapModes).to.deep.equal([{ type: MapModeType.sectors, player: 0 }]);
    player.data.occupied.push(colony("DS12_0", 6));
    await Vue.nextTick();
    expect(deep.querySelector("text").textContent.trim()).to.equal("2");
    expect(normal.querySelector("text").textContent.trim()).to.equal("2");
  });

  it("keeps a zero Deep Space count visible", () => {
    const { props, store } = setup();
    const { container } = render(PlayerBoardInfo, { props, store });
    expect(container.querySelector('[data-board-stat="deep-space-sectors"] text').textContent.trim()).to.equal("0");
  });

  it("uses the displayed reference engine for expansion visibility and shuttle limits", () => {
    const { store } = setup(false);
    const referenceEngine = new Engine(
      [
        "init 4 info-reference",
        "p1 faction terrans",
        "p2 faction xenos",
        "p3 faction firaks",
        "p4 faction hadsch-hallas",
      ],
      { lostFleet: true }
    );
    const player = referenceEngine.players[0];
    const { container } = render(PlayerBoardInfo, {
      props: { player, faction: player.faction, data: player.data, referenceEngine, preview: true, height: 21.4 },
      store,
    });
    expect(container.querySelector(".remaining-count").textContent.trim()).to.equal("3");
    expect(container.querySelector('[data-board-stat="deep-space-sectors"]')).not.to.equal(null);
  });
});
