import type { Player } from "@gaia-project/engine";
import Engine, { Building, Faction, Planet, PlayerEnum, Resource } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { createLocalVue } from "@vue/test-utils";
import { expect } from "chai";
import type { VueConstructor } from "vue";
import { makeStore } from "../store";

function position(seat = PlayerEnum.Player1, shared = 2) {
  const factions = [Faction.HadschHallas, Faction.HadschHallas];
  factions[seat] = Faction.Lantids;
  const engine = new Engine([
    "init 2 shared-mine-slots",
    ...factions.map((faction, i) => `p${i + 1} faction ${faction}`),
  ]);
  const player = engine.players[seat];
  const host = engine.players[1 - seat];
  const hexes = [...engine.map.grid.values()];
  const normal = hexes.filter((hex) => hex.data.planet === Planet.Terra).slice(0, 2);
  const targets = hexes.filter((hex) => hex.data.planet === Planet.Oxide).slice(0, shared);
  // Use the engine's build bookkeeping, not hand-written occupied/buildings counters.
  normal.forEach((hex) => player.build(Building.Mine, hex, [], engine.map));
  targets.forEach((hex) => {
    host.build(Building.Mine, hex, [], engine.map);
    player.build(Building.Mine, hex, [], engine.map);
  });
  return { engine, player, host, normal, targets };
}

/** Run against each UI's actual SFC: the legacy subclass has its own template and building tokens. */
export function sharedMineBuildingGroupTests(Component: VueConstructor, tokenSelector: string) {
  const localVue = createLocalVue();
  // Leave tooltip titles in the DOM without Bootstrap's portal/hover behaviour.
  localVue.directive("b-tooltip", {});

  function mount(engine: Engine, player: Player, building = Building.Mine, revealIncome = false) {
    const store = makeStore();
    store.commit("receiveData", engine);
    return render(Component, {
      store,
      localVue,
      props: {
        player,
        building,
        nBuildings: player.board.buildings[building].income.length,
        placed: player.data.buildings[building],
        resource: building === Building.Mine ? [Resource.Ore] : [],
        revealIncome,
      },
    });
  }

  const slots = (container: HTMLElement) => [...container.querySelectorAll(".building-group > g:not(.resource)")];
  const marked = (container: HTMLElement) =>
    slots(container).flatMap((slot, i) => (slot.querySelector(".shared-mine-mark") ? [i] : []));

  function expectMineTrack(container: HTMLElement, placed: number, shared: number) {
    const track = slots(container);
    expect(track).to.have.length(8);
    expect(container.querySelectorAll(tokenSelector), "shared mines are already included in placed").to.have.length(
      8 - placed
    );
    expect(marked(container)).to.deep.equal(Array.from({ length: shared }, (_, i) => i));
    track.forEach((slot, i) => {
      const isShared = i < shared && i < placed;
      expect(!!slot.querySelector(tokenSelector), `slot ${i + 1} token`).to.equal(i >= placed);
      expect(!!slot.querySelector(".resource .ore"), `slot ${i + 1} ore (third slot is blank)`).to.equal(
        i < placed && !isShared && i !== 2
      );
      expect(slot.getAttribute("title")).to.equal(
        [
          isShared ? "Shared mine (cannot be upgraded)" : "Mine",
          "Cost: 2c, o",
          i === 2 ? "~" : "Income: o",
          "Power Value: 1",
        ].join("<br/>")
      );
      const mark = slot.querySelector(".shared-mine-mark");
      if (mark) {
        expect(mark.getAttribute("transform"), "X is centered, not a corner badge").to.equal(null);
        expect(mark.querySelector("circle"), "no opaque white badge over the income").to.equal(null);
        expect(mark.querySelectorAll('g[transform="scale(0.05)"] > line')).to.have.length(2);
        expect(mark.querySelector("title")?.textContent).to.equal("Shared mine (cannot be upgraded)");
        expect(slot.querySelector(".resource"), "crossed-slot income moves to the left icon").to.equal(null);
      }
    });
    // Only income printed under crossed slots is folded into the basic income: slot 3 adds nothing.
    const leftIncome = container.querySelector(".building-group > .resource .resource-count");
    expect(leftIncome?.textContent?.trim()).to.equal(String(1 + shared - (shared > 2 ? 1 : 0)));
    const renderedOre = [...container.querySelectorAll(".resource")]
      .filter((resource) => resource.querySelector(".ore"))
      .reduce((total, resource) => total + Number(resource.querySelector(".resource-count")?.textContent), 0);
    expect(renderedOre, "left icon plus remaining slots must not lose or double-count income").to.equal(
      1 + placed - (placed > 2 ? 1 : 0)
    );
  }

  describe("Lantids shared-mine markers", () => {
    for (const seat of [PlayerEnum.Player1, PlayerEnum.Player2]) {
      for (const shared of [0, 1, 2, 3]) {
        it(`marks the first ${shared} slots for seat ${seat}, preserving supply and total ore income`, () => {
          const { engine, player, targets, normal } = position(seat, shared);
          expect(player.player).to.equal(seat);
          expect(normal.map((hex) => hex.data.additionalMine)).to.deep.equal([undefined, undefined]);
          expect(targets.map((hex) => hex.data.additionalMine)).to.deep.equal(Array(shared).fill(seat));
          expect(player.data.buildings[Building.Mine]).to.equal(2 + shared);
          const oreIncome = player.resourceIncome(Resource.Ore);
          const boardIncome = JSON.stringify(player.board.income);
          expect(oreIncome).to.equal(shared < 2 ? 3 : shared + 2);
          const { container } = mount(engine, player);
          expectMineTrack(container, 2 + shared, shared);
          expect(JSON.stringify(player.board.income), "display aggregation must not mutate board rewards").to.equal(
            boardIncome
          );
          expect(player.resourceIncome(Resource.Ore)).to.equal(oreIncome);
        });
      }
    }

    it("returns an upgraded normal mine and builds another without moving either shared-mine X", async () => {
      const { engine, player, normal } = position();
      const view = mount(engine, player);
      expectMineTrack(view.container, 4, 2);
      const markedBeforeUpgrade = marked(view.container);
      player.build(Building.TradingStation, normal[0], [], engine.map);
      expect(player.data.buildings[Building.Mine]).to.equal(3);
      expect(player.resourceIncome(Resource.Ore)).to.equal(3);
      await view.updateProps({ placed: player.data.buildings[Building.Mine] });
      expectMineTrack(view.container, 3, 2);
      expect(marked(view.container)).to.deep.equal(markedBeforeUpgrade);

      const next = [...engine.map.grid.values()].find((hex) => hex.data.planet === Planet.Terra && !hex.occupied());
      player.build(Building.Mine, next, [], engine.map);
      await view.updateProps({ placed: player.data.buildings[Building.Mine] });
      expectMineTrack(view.container, 4, 2);
      expect(marked(view.container)).to.deep.equal(markedBeforeUpgrade);
    });

    it("keeps shared mines when their host upgrades, including after serialization", () => {
      const { engine, player, host, targets } = position();
      host.build(Building.TradingStation, targets[0], [], engine.map);
      expect(targets[0].data.building).to.equal(Building.TradingStation);
      expect(targets[0].data.additionalMine).to.equal(player.player);
      const restored = Engine.fromData(JSON.parse(JSON.stringify(engine)));
      const { container } = mount(restored, restored.players[player.player]);
      expectMineTrack(container, 4, 2);
    });

    it("reveals all printed income but no Xs or tokens in faction previews", () => {
      const { engine, player } = position();
      const { container } = mount(engine, player, Building.Mine, true);
      expect(slots(container)).to.have.length(8);
      expect(marked(container)).to.deep.equal([]);
      expect(container.querySelector(tokenSelector)).to.equal(null);
      expect(container.querySelectorAll(".resource .ore")).to.have.length(8);
      container.querySelectorAll(".resource-count").forEach((count) => expect(count.textContent.trim()).to.equal("1"));
      expect(slots(container)[2].querySelector(".resource")).to.equal(null);
      slots(container).forEach((slot) => expect(slot.getAttribute("title")).to.match(/^Mine<br\/>/));
    });

    it("does not mark ordinary Lantids mines or the other faction hosting shared mines", () => {
      const ordinary = position(PlayerEnum.Player1, 0);
      expectMineTrack(mount(ordinary.engine, ordinary.player).container, 2, 0);
      // Seat 1's occupied list includes additionalMine === 0, which is not its own mine.
      const { engine, host } = position();
      expectMineTrack(mount(engine, host).container, 2, 0);
    });

    for (const building of [Building.TradingStation, Building.PlanetaryInstitute, Building.GaiaFormer]) {
      it(`does not mark a placed ${building} even when the player has shared mines`, () => {
        const { engine, player, normal } = position();
        if (building === Building.GaiaFormer) {
          const transdim = [...engine.map.grid.values()].find((hex) => hex.data.planet === Planet.Transdim);
          player.build(building, transdim, [], engine.map);
        } else {
          player.build(Building.TradingStation, normal[0], [], engine.map);
          if (building === Building.PlanetaryInstitute) {
            player.build(building, normal[0], [], engine.map);
          }
        }
        expect(player.data.buildings[building]).to.equal(1);
        const { container } = mount(engine, player, building);
        expect(container.querySelector(".shared-mine-mark")).to.equal(null);
        expect(container.textContent).to.not.contain("Shared mine");
      });
    }

    for (const sharedLostPlanet of [false, true]) {
      it(`${sharedLostPlanet ? "uses supply and marks a shared opponent" : "uses no supply and adds no X for an own"} Lost Planet`, () => {
        const { engine, player, host } = position(PlayerEnum.Player1, 1);
        const lost = [...engine.map.grid.values()].find((hex) => hex.data.planet === Planet.Empty);
        lost.data.planet = Planet.Lost;
        if (sharedLostPlanet) host.build(Building.Mine, lost, [], engine.map);
        player.build(Building.Mine, lost, [], engine.map);
        expect(player.data.lostPlanet).to.equal(sharedLostPlanet ? 0 : 1);
        expect(lost.data.additionalMine).to.equal(sharedLostPlanet ? player.player : undefined);
        expect(player.data.buildings[Building.Mine]).to.equal(sharedLostPlanet ? 4 : 3);
        expect(player.resourceIncome(Resource.Ore)).to.equal(sharedLostPlanet ? 4 : 3);
        const { container } = mount(engine, player);
        expectMineTrack(container, sharedLostPlanet ? 4 : 3, sharedLostPlanet ? 2 : 1);
      });
    }
  });
}
