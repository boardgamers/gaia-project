import Engine, { Building, Command, Faction, Phase, Planet, PlayerEnum } from "@gaia-project/engine";
import { fireEvent } from "@testing-library/vue";
import { expect } from "chai";
import Vue from "vue";
import BootstrapVue from "bootstrap-vue";
import { makeStore } from "../store";
import Game from "./Game.vue";

Vue.use(BootstrapVue);

describe("Game", () => {
  function createMoweydsPiUpgradeState(withLeech = false) {
    const persisted = new Engine(["init 2 lf-moweyds-pi-endturn"], { lostFleet: true });

    persisted.players.forEach((pl, index) => {
      pl.faction = [Faction.Moweyds, Faction.Terrans][index];
      pl.loadFaction(null, persisted.expansions);
      pl.data.victoryPoints = 30;
      pl.data.qics = 10;
      pl.data.credits = 20;
      pl.data.knowledge = 10;
      pl.data.ores = 10;
    });

    persisted.phase = Phase.RoundMove;
    persisted.round = 3;
    persisted.turnOrder = persisted.players.map((pl) => pl.player);
    persisted.currentPlayer = PlayerEnum.Player1;

    const hex = [...persisted.map.grid.values()].find(
      (space) =>
        space.hasPlanet() &&
        space.data.planet !== Planet.Transdim &&
        space.data.planet !== Planet.Gaia &&
        space.data.spaceship === undefined &&
        !space.occupied()
    );

    expect(hex, "expected an available Trading Station location").to.not.equal(undefined);

    hex!.data.player = PlayerEnum.Player1;
    hex!.data.building = Building.TradingStation;
    persisted.player(PlayerEnum.Player1).data.occupied.push(hex!);
    persisted.player(PlayerEnum.Player1).data.buildings[Building.TradingStation] = 1;

    persisted.clearAvailableCommands();
    persisted.generateAvailableCommands();
    const build = persisted.findAvailableCommand(PlayerEnum.Player1, Command.Build);
    const upgrade = build?.data.buildings.find((entry) => entry.building === Building.PlanetaryInstitute);

    expect(upgrade, "expected a Planetary Institute upgrade").to.not.equal(undefined);

    if (withLeech) {
      const upgradeHex = persisted.map.getS(upgrade!.coordinates);
      const leechHex = [...persisted.map.grid.values()].find(
        (space) =>
          space !== upgradeHex &&
          space.hasPlanet() &&
          space.data.planet !== Planet.Transdim &&
          space.data.planet !== Planet.Gaia &&
          space.data.spaceship === undefined &&
          !space.occupied() &&
          persisted.map.distance(upgradeHex, space) <= 2
      );

      expect(leechHex, "expected an adjacent opponent mine for leeching").to.not.equal(undefined);

      leechHex!.data.player = PlayerEnum.Player2;
      leechHex!.data.building = Building.Mine;
      persisted.player(PlayerEnum.Player2).data.occupied.push(leechHex!);
      persisted.player(PlayerEnum.Player2).data.buildings[Building.Mine] = 1;
    }

    const partial = Engine.fromData(JSON.parse(JSON.stringify(persisted)));
    partial.move(`moweyds build PI ${upgrade!.coordinates}`);
    partial.generateAvailableCommandsIfNeeded();

    return { persisted, partial, coordinates: upgrade!.coordinates };
  }

  it("keeps the raw partial move after Tinkeroids income selection", () => {
    const base = new Engine(
      [
        "init 2 lf-freeze-28",
        "p1 faction tinkeroids",
        "p2 faction terrans",
        "terrans build m 3A11",
        "terrans build m 4A6",
        "tinkeroids build PI IS1",
        "terrans booster booster10",
        "tinkeroids booster booster2",
      ],
      { lostFleet: true }
    );
    const partial = Engine.fromData(JSON.parse(JSON.stringify(base)));
    partial.move("tinkeroids chooseTinkeringTile tinkering-power4. income t");
    partial.generateAvailableCommandsIfNeeded();

    const restored = Engine.fromData(JSON.parse(JSON.stringify(partial)));
    const store = makeStore();
    const vm = new (Vue.extend(Game as any))({ store }) as any;

    vm.handleData(restored);

    expect(vm.currentMove).to.equal("tinkeroids chooseTinkeringTile tinkering-power4. income t");
    expect(vm.currentMove).to.not.contain("⇒");
    expect(store.state.data.moveHistory[store.state.data.moveHistory.length - 1]).to.equal("tinkeroids booster booster2");

    vm.$destroy();
  });

  it("keeps the remaining setup-income choices clickable after Tinkeroids picks the first 4 power income", async () => {
    let persisted = new Engine(
      [
        "init 2 lf-freeze-28",
        "p1 faction tinkeroids",
        "p2 faction terrans",
        "terrans build m 3A11",
        "terrans build m 4A6",
        "tinkeroids build PI IS1",
        "terrans booster booster10",
        "tinkeroids booster booster9",
      ],
      { lostFleet: true }
    );
    persisted.generateAvailableCommandsIfNeeded();

    const store = makeStore();
    const vm = new (Vue.extend(Game as any))({ store }) as any;
    vm.$mount();
    document.body.appendChild(vm.$el);

    const unsub = store.subscribeAction(({ type, payload }) => {
      if (type !== "move") {
        return;
      }

      const copy = Engine.fromData(JSON.parse(JSON.stringify(persisted)));
      copy.move(payload as string);
      copy.generateAvailableCommandsIfNeeded();

      if (copy.newTurn) {
        persisted = copy;
      }

      vm.handleData(Engine.fromData(JSON.parse(JSON.stringify(copy))));
    });

    const buttons = () =>
      Array.from(vm.$el.querySelectorAll<HTMLButtonElement>("#move-buttons button.move-button")).filter(
        (button) => !button.classList.contains("d-none")
      );
    const labels = () => buttons().map((button) => button.textContent?.trim() ?? "");
    const buttonWithText = (text: string, occurrence = 0) =>
      buttons().filter((button) => button.textContent?.includes(text))[occurrence] ?? null;

    vm.handleData(Engine.fromData(JSON.parse(JSON.stringify(persisted))));
    await Vue.nextTick();

    await fireEvent.click(buttonWithText("Choose Tinkering Tile")!);
    await Vue.nextTick();
    await fireEvent.click(buttonWithText("Charge 4 Power")!);
    await Vue.nextTick();

    expect(labels().filter((label) => label.includes("Income 4pw"))).to.have.length(2);
    expect(labels()).to.include("1: Income t");

    await fireEvent.click(buttonWithText("Income 4pw")!);
    await Vue.nextTick();

    expect(labels().filter((label) => label.includes("Income 4pw"))).to.have.length(1);
    expect(labels()).to.include("1: Income t");
    expect(vm.currentMove).to.equal("tinkeroids chooseTinkeringTile tinkering-power4. income 4pw");

    await fireEvent.click(buttonWithText("Income 4pw")!);
    await Vue.nextTick();

    expect(vm.currentMove).to.equal("");
    expect(store.state.data.availableCommands.map((command) => command.name)).to.include.members(["build", "explore"]);
    expect(labels().length).to.be.greaterThan(0);
    expect(labels().some((label) => label.includes("Income"))).to.equal(false);

    unsub();
    vm.$el.remove();
    vm.$destroy();
  });

  it("replays Moweyds' PI upgrade cleanly when confirming End Turn in self-contained mode", async () => {
    let { persisted, partial, coordinates } = createMoweydsPiUpgradeState();

    const store = makeStore();
    const vm = new (Vue.extend(Game as any))({ store }) as any;
    vm.$mount();
    document.body.appendChild(vm.$el);

    const unsub = store.subscribeAction(({ type, payload }) => {
      if (type !== "move") {
        return;
      }

      const copy = Engine.fromData(JSON.parse(JSON.stringify(persisted)));
      copy.move(payload as string);
      copy.generateAvailableCommandsIfNeeded();

      if (copy.newTurn) {
        persisted = copy;
      }

      vm.handleData(Engine.fromData(JSON.parse(JSON.stringify(copy))));
    });

    const buttons = () =>
      Array.from(vm.$el.querySelectorAll<HTMLButtonElement>("#move-buttons button.move-button")).filter(
        (button) => !button.classList.contains("d-none")
      );
    const buttonWithText = (text: string, occurrence = 0) =>
      buttons().filter((button) => button.textContent?.includes(text))[occurrence] ?? null;

    vm.handleData(Engine.fromData(JSON.parse(JSON.stringify(partial))));
    await Vue.nextTick();

    expect(vm.currentMove).to.equal(`moweyds build PI ${coordinates}`);
    expect(buttonWithText("End Turn")).to.not.equal(null);

    await fireEvent.click(buttonWithText("End Turn")!);
    await Vue.nextTick();
    await fireEvent.click(buttonWithText("Confirm End Turn")!);
    await Vue.nextTick();

    expect(vm.currentMove).to.equal("");
    expect(store.state.data.currentPlayer).to.equal(PlayerEnum.Player2);
    expect(store.state.data.map.getS(coordinates).data.building).to.equal(Building.PlanetaryInstitute);

    unsub();
    vm.$el.remove();
    vm.$destroy();
  });

});
