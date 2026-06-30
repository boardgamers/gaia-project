import Engine, { Building, Command, Faction, Phase, PlayerEnum, Spaceship } from "@gaia-project/engine";
import { render, fireEvent } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { mount } from "@vue/test-utils";
import { makeStore } from "../store";
import Commands from "./Commands.vue";

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
        "terrans booster booster1",
        "tinkeroids booster booster2",
      ],
      { lostFleet: true }
    );
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
});
