import Engine, { Building, Command, Faction, Phase, PlayerEnum, Spaceship, SpaceshipFederation } from "@gaia-project/engine";
import { render, fireEvent } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { mount } from "@vue/test-utils";
import { makeStore } from "../store";
import Commands from "./Commands.vue";
import { GaiaHex } from "@gaia-project/engine/src/gaia-hex";
import { loadScenarioEngine } from "../self-contained-scenarios";

Vue.use(BootstrapVue);

describe("Commands", () => {
  function createLostFleetRoundMoveEngine() {
    const engine = new Engine(["init 3 lf-viewer-temporary-range"], { lostFleet: true });
    const factions = [Faction.Terrans, Faction.Lantids, Faction.HadschHallas];

    engine.players.forEach((pl, index) => {
      pl.faction = factions[index];
      pl.loadFaction(null, engine.expansions);
      pl.data.victoryPoints = 30;
      pl.data.credits = 20;
      pl.data.knowledge = 10;
      pl.data.ores = 10;
      pl.data.qics = 0;
    });

    engine.phase = Phase.RoundMove;
    engine.round = 1;
    engine.turnOrder = engine.players.map((pl) => pl.player);
    engine.currentPlayer = PlayerEnum.Player1;

    return engine;
  }

  function occupyConnectedPlanets(engine: Engine, player: PlayerEnum, count: number): GaiaHex[] {
    const pl = engine.player(player);
    const start = [...engine.map.grid.values()].find((hex) => hex.hasPlanet() && hex.data.spaceship === undefined && !hex.occupied());

    expect(start, "need a starting planet for federation setup").to.not.equal(undefined);

    const queue: GaiaHex[] = [start!];
    const visited = new Set<GaiaHex>();
    const cluster: GaiaHex[] = [];

    while (queue.length > 0 && cluster.length < count) {
      const hex = queue.shift()!;
      if (visited.has(hex)) {
        continue;
      }

      visited.add(hex);

      if (hex.hasPlanet() && hex.data.spaceship === undefined && !hex.occupied()) {
        cluster.push(hex);
        for (const neighbor of engine.map.grid.neighbours(hex)) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }
    }

    expect(cluster, `need ${count} connected planets for federation setup`).to.have.length(count);

    for (const hex of cluster) {
      hex.data.player = player;
      hex.data.building = Building.Mine;
      pl.data.occupied.push(hex);
    }

    pl.data.buildings[Building.Mine] = pl.data.occupied.length;

    return cluster;
  }

  it("renders Lost Fleet faction picker dots with Asteroid/Protoplanet colors", () => {
    const engine = new Engine(["init 2 lf-faction-colors"], { lostFleet: true });
    engine.generateAvailableCommandsIfNeeded();

    expect(engine.availableCommands.map((command) => command.name)).to.deep.equal([Command.ChooseFaction]);

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(Commands, {
      props: { currentMove: "" },
      store,
    });

    const buttonFor = (name: string) =>
      Array.from(container.querySelectorAll<HTMLButtonElement>("#move-buttons button.move-button")).find((button) =>
        button.textContent?.includes(name)
      );

    const tinkeroidsIcon = buttonFor("Tinkeroids")?.querySelector<HTMLElement>("i.planet");
    const darkaniansIcon = buttonFor("Darkanians")?.querySelector<HTMLElement>("i.planet");
    const moweydsIcon = buttonFor("Moweyds")?.querySelector<HTMLElement>("i.planet");
    const spaceGiantsIcon = buttonFor("Space Giants")?.querySelector<HTMLElement>("i.planet");

    expect(tinkeroidsIcon).to.not.equal(null);
    expect(darkaniansIcon).to.not.equal(null);
    expect(moweydsIcon).to.not.equal(null);
    expect(spaceGiantsIcon).to.not.equal(null);
    expect(tinkeroidsIcon?.getAttribute("style")).to.contain("#ff66b3");
    expect(darkaniansIcon?.getAttribute("style")).to.contain("#ff66b3");
    expect(moweydsIcon?.getAttribute("style")).to.contain("#30d5c8");
    expect(spaceGiantsIcon?.getAttribute("style")).to.contain("#30d5c8");
  });

  it("renders Tinkeroids' round-start tinkering choice after Lost Fleet setup", async () => {
    const engine = new Engine(
      [
        "init 2 lf-freeze-check",
        "p1 faction tinkeroids",
        "p2 faction terrans",
        "terrans build m 3A11",
        "terrans build m 4A6",
        "tinkeroids build PI IS1",
      ],
      { lostFleet: true }
    );
    const chooseBooster = () => {
      const player = engine.currentPlayer;
      const faction = engine.player(player).faction;
      const command = engine.findAvailableCommand(player, Command.ChooseRoundBooster);

      expect(command, `expected ${faction} to have a booster choice`).to.not.equal(null);
      engine.move(`${faction} booster ${command!.data.boosters[0]}`);
    };

    chooseBooster();
    chooseBooster();
    engine.generateAvailableCommandsIfNeeded();

    expect(engine.availableCommands.map((command) => command.name)).to.deep.equal([Command.ChooseTinkeringTile]);

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(Commands, {
      props: { currentMove: "" },
      store,
    });

    const chooser = container.querySelector<HTMLButtonElement>("#move-buttons button.move-button");
    expect(chooser).to.not.equal(null);
    expect(chooser?.textContent).to.contain("Choose Tinkering Tile");

    await fireEvent.click(chooser!);

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("#move-buttons button.move-button")).map(
      (button) => button.textContent?.trim() ?? ""
    );

    expect(buttons).to.include("Terraform 1 Step");
    expect(buttons).to.include("2: Charge 4 Power");
    expect(buttons).to.include("3: Gain 1 QIC");
  });

  it("uses player temporary range for Lost Fleet ship-action build overlays", async () => {
    const engine = createLostFleetRoundMoveEngine();
    const player = engine.player(PlayerEnum.Player1);
    player.data.explorationShips[Spaceship.Twilight] = 1;
    player.data.temporaryRange = 3;

    const homeHex = [...engine.map.grid.values()].find(
      (hex) => hex.hasPlanet() && hex.data.spaceship === undefined && !hex.occupied()
    );

    expect(homeHex, "need an initial colonized planet").to.not.equal(undefined);

    homeHex.data.player = PlayerEnum.Player1;
    homeHex.data.building = Building.Mine;
    player.data.occupied.push(homeHex);
    player.data.buildings[Building.Mine] = 1;

    engine.generateAvailableCommandsIfNeeded();
    expect(engine.availableCommands.map((command) => command.name)).to.include(Command.Build);

    const store = makeStore();
    store.commit("receiveData", engine);

    const wrapper = mount(Commands, {
      propsData: { currentMove: "terrans spaceshipAction twilight knowledge" },
      store,
    });

    expect((wrapper.vm as any).temporaryRange).to.equal(3);

    const buildMineButton = (wrapper.vm as any).buttons.find((button) => button.command === "build m");
    expect(buildMineButton, "need Mine build button").to.not.equal(undefined);

    const highlighted = buildMineButton.hexes?.hexes;
    expect(highlighted).to.not.equal(undefined);

    const outOfBaseRangeEmptyHexes = [...highlighted.entries()].filter(
      ([hex, highlight]) =>
        hex.data.planet === "e" &&
        highlight.preventClick &&
        highlight.class?.includes("range") &&
        engine.map.distance(homeHex, hex) > player.data.range
    );

    expect(outOfBaseRangeEmptyHexes.length).to.be.greaterThan(
      0,
      "temporary +3 range should extend the empty-hex overlay beyond the player's base range"
    );
  });

  it("renders ship federation claim choices when forming a Lost Fleet federation", async () => {
    const engine = createLostFleetRoundMoveEngine();
    const player = engine.player(PlayerEnum.Player1);
    const federationCluster = occupyConnectedPlanets(engine, PlayerEnum.Player1, 6);
    const previousMatchMedia = window.matchMedia;

    (window as any).matchMedia = () =>
      ({
        matches: true,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;

    try {
      federationCluster[0].data.building = Building.ResearchLab;
      player.data.buildings[Building.Mine] = federationCluster.length - 1;
      player.data.buildings[Building.ResearchLab] = 1;
      player.data.explorationShips[Spaceship.Twilight] = 1;
      engine.tiles.spaceshipFederations[Spaceship.Twilight] = SpaceshipFederation.Credit;
      engine.generateAvailableCommandsIfNeeded();

      const store = makeStore();
      store.commit("receiveData", engine);

      const { container } = render(Commands, {
        props: { currentMove: "" },
        store,
      });

      const visibleButtons = () =>
        Array.from(container.querySelectorAll<HTMLButtonElement>("#move-buttons button.move-button")).filter(
          (button) => !button.classList.contains("d-none")
        );
      const buttonWithText = (text: string) =>
        visibleButtons().find((button) => button.textContent?.includes(text)) ?? null;

      await fireEvent.click(buttonWithText("Form federation")!);
      await Vue.nextTick();
      expect(visibleButtons().some((button) => button.textContent?.includes("Location 1"))).to.equal(true);

      await fireEvent.click(buttonWithText("Location 1")!);
      await Vue.nextTick();

      const labels = visibleButtons().map((button) => button.textContent?.trim() ?? "");
      expect(labels.some((label) => label.includes("8vp,q"))).to.equal(true);
      expect(labels.some((label) => label.includes("8vp,8c"))).to.equal(true);
    } finally {
      (window as any).matchMedia = previousMatchMedia;
    }
  });

  it("renders Lost Fleet ship tech choices in the normal tech-pick command", async () => {
    const engine = loadScenarioEngine("lost-fleet-ship-tech-claim");
    const prefix = engine.player(engine.currentPlayer).faction;
    const partial = Engine.fromData(JSON.parse(JSON.stringify(engine)));

    partial.move(`${prefix} ${Command.SpaceshipAction} rebellion qic`);
    partial.generateAvailableCommandsIfNeeded();

    const store = makeStore();
    store.commit("receiveData", partial);

    const { container } = render(Commands, {
      props: { currentMove: `${prefix} ${Command.SpaceshipAction} rebellion qic` },
      store,
    });

    const visibleButtons = () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>("#move-buttons button.move-button")).filter(
        (button) => !button.classList.contains("d-none")
      );
    const labels = () =>
      visibleButtons().map(
        (button) => button.textContent?.trim() ?? ""
      );

    expect(labels()).to.include("Pick tech tile");

    const chooseTechButton = visibleButtons().find((button) => button.textContent?.includes("Pick tech tile"));
    expect(chooseTechButton).to.not.equal(undefined);

    await fireEvent.click(chooseTechButton!);
    await Vue.nextTick();

    const expandedLabels = labels();

    expect(expandedLabels).to.include("Pick tech tile");
    const rebellionTile = Array.from(container.querySelectorAll<SVGElement>("#move-buttons svg.techTile")).find(
      (tile) => tile.classList.contains(Spaceship.Rebellion)
    );
    expect(rebellionTile).to.not.equal(undefined);
    // the ship tech tile renders through TechContent's icon system (o + 3k), not a text shortcut
    expect(rebellionTile!.querySelector("rect.ore")).to.not.equal(null);
  });

  it("renders Moweyds' power-ring special action without crashing", () => {
    const engine = loadScenarioEngine("lost-fleet-moweyds-power-ring");
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(Commands, {
      props: { currentMove: "" },
      store,
    });

    const labels = () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>("#move-buttons button.move-button")).map(
        (button) => button.textContent?.trim() ?? ""
      );

    expect(labels()).to.include("Special Action");
  });
});
