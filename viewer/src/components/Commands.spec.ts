import Engine, {
  AuctionVariant,
  AvailableCommand,
  Building,
  Command,
  Faction,
  Federation,
  Phase,
  Planet,
  PlayerEnum,
  Spaceship,
  SpaceshipFederation,
} from "@gaia-project/engine";
import { GaiaHex } from "@gaia-project/engine/src/gaia-hex";
import { fireEvent, render } from "@testing-library/vue";
import { mount } from "@vue/test-utils";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { loadScenarioEngine } from "../self-contained-scenarios";
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

  function occupyConnectedPlanets(engine: Engine, player: PlayerEnum, count: number): GaiaHex[] {
    const pl = engine.player(player);
    const start = [...engine.map.grid.values()].find(
      (hex) => hex.hasPlanet() && hex.data.spaceship === undefined && !hex.occupied()
    );

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

    const tinkeroidsIcon = buttonFor("Tinkeroids")?.querySelector<SVGElement>("svg[data-planet]");
    const darkaniansIcon = buttonFor("Darkanians")?.querySelector<SVGElement>("svg[data-planet]");
    const moweydsIcon = buttonFor("Moweyds")?.querySelector<SVGElement>("svg[data-planet]");
    const spaceGiantsIcon = buttonFor("Space Giants")?.querySelector<SVGElement>("svg[data-planet]");

    expect(tinkeroidsIcon).to.not.equal(null);
    expect(darkaniansIcon).to.not.equal(null);
    expect(moweydsIcon).to.not.equal(null);
    expect(spaceGiantsIcon).to.not.equal(null);
    expect(tinkeroidsIcon?.getAttribute("data-planet")).to.equal(Planet.Asteroid);
    expect(darkaniansIcon?.getAttribute("data-planet")).to.equal(Planet.Asteroid);
    expect(moweydsIcon?.getAttribute("data-planet")).to.equal(Planet.Protoplanet);
    expect(spaceGiantsIcon?.getAttribute("data-planet")).to.equal(Planet.Protoplanet);
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

  it("submits the federation location tapped directly on touch devices", async () => {
    const engine = createLostFleetRoundMoveEngine();
    const previousMatchMedia = window.matchMedia;
    const locations = ["1A9", "6A6"];

    (window as any).matchMedia = () =>
      ({
        matches: false,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;

    try {
      const command: AvailableCommand<Command.FormFederation> = {
        name: Command.FormFederation,
        player: PlayerEnum.Player1,
        data: {
          tiles: [Federation.Fed4],
          federations: locations.map((hexes) => ({ hexes, warnings: [] })),
          claimableFederations: [],
        },
      };
      engine.availableCommands = [command];

      const store = makeStore();
      store.commit("receiveData", engine);
      const wrapper = mount(Commands, { propsData: { currentMove: "" }, store });
      const visibleButtons = () =>
        wrapper.findAll("#move-buttons button.move-button").filter((button) => button.isVisible());
      const buttonWithText = (text: string) => visibleButtons().wrappers.find((button) => button.text().includes(text));

      await buttonWithText("Form federation")!.trigger("click");
      await Vue.nextTick();
      await buttonWithText("Location 2")!.trigger("click");
      await Vue.nextTick();

      const okButton = buttonWithText("OK 2");
      expect(okButton, "the confirmation must identify the tapped location").to.not.equal(undefined);
      await okButton!.trigger("click");
      await Vue.nextTick();
      await buttonWithText("7vp,2o")!.trigger("click");
      await Vue.nextTick();

      const emitted = wrapper.emitted("command");
      expect(emitted).to.not.equal(undefined);
      expect(emitted![0][0]).to.equal(`terrans federation ${locations[1]} fed4`);
      wrapper.destroy();
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
    const labels = () => visibleButtons().map((button) => button.textContent?.trim() ?? "");

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

  it("labels Lost Fleet hex-target buttons with the planet they build on", async () => {
    // Eclipse's credit action targets Asteroids on Interspace/Deep Space hexes, whose addresses
    // (IS3, DS14_1) don't reference a visible sector number like base coordinates do - the
    // buttons must therefore show the target planet (colored dot + name) next to the address.
    const engine = loadScenarioEngine("lost-fleet-eclipse-asteroid-mine");
    const prefix = engine.player(engine.currentPlayer).faction;
    const partial = Engine.fromData(JSON.parse(JSON.stringify(engine)));

    partial.move(`${prefix} ${Command.SpaceshipAction} eclipse credit`);
    partial.generateAvailableCommandsIfNeeded();

    const store = makeStore();
    store.commit("receiveData", partial);

    const { container } = render(Commands, {
      props: { currentMove: `${prefix} ${Command.SpaceshipAction} eclipse credit` },
      store,
    });

    const visibleButtons = () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>("#move-buttons button.move-button")).filter(
        (button) => !button.classList.contains("d-none")
      );

    // the Build-a-Mine command button renders as a building icon; "Mine" is in its title,
    // which carries shortcut markup ("Build a <u>M</u>ine")
    const mineButton = visibleButtons().find((button) =>
      button
        .getAttribute("title")
        ?.replace(/<[^>]+>/g, "")
        .includes("Mine")
    );
    expect(mineButton, "expected a Build-a-Mine command button").to.not.equal(undefined);

    await fireEvent.click(mineButton!);
    await Vue.nextTick();

    const asteroidTarget = visibleButtons().find((button) => button.querySelector('[data-planet="a"]'));
    expect(asteroidTarget, "expected a hex button with an Asteroid planet dot").to.not.equal(undefined);
    expect(asteroidTarget!.textContent).to.contain("Asteroid");
  });

  it("Silent Auction: shows a ban button per available faction, and asks for confirmation before emitting a banFaction move", async () => {
    const engine = new Engine(["init 3 lf-silent-ban"], { auction: AuctionVariant.Silent });
    engine.generateAvailableCommandsIfNeeded();

    expect(engine.availableCommands.map((command) => command.name)).to.deep.equal([Command.BanFaction]);

    const store = makeStore();
    store.commit("receiveData", engine);

    const wrapper = mount(Commands, { propsData: { currentMove: "" }, store, attachTo: document.body });
    // MoveButton only wires up its buttonController (needed by the modal click handler) in its
    // `updated()` hook, not `mounted()` - force one settle cycle first, same as the render passes
    // that naturally happen before a real user can click.
    wrapper.vm.$forceUpdate();
    await Vue.nextTick();
    const terransButton = wrapper
      .findAll("#move-buttons button.move-button")
      .filter((w) => w.text().includes("Terrans"));

    expect(terransButton.length).to.equal(1);

    await terransButton.at(0).trigger("click");
    await Vue.nextTick();

    // A ban, just like a faction pick, must be confirmed via a modal instead of banning immediately.
    expect(wrapper.emitted("command")).to.equal(undefined);
    const modalTitle = document.querySelector(".gaia-viewer-modal .modal-title");
    expect(modalTitle?.textContent).to.contain("Terrans");
    const okButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".gaia-viewer-modal .modal-footer button")
    ).find((b) => b.textContent?.includes("ban"));
    expect(okButton, "expected an 'OK, I ban this one!' confirm button").to.not.equal(undefined);

    await fireEvent.click(okButton!);
    await Vue.nextTick();

    const emitted = wrapper.emitted("command");
    expect(emitted).to.not.equal(undefined);
    expect(emitted![0][0]).to.equal("p1 banFaction terrans");

    wrapper.destroy();
  });

  it("Silent Auction: sends the player to the simultaneous bid panel instead of bidding here", async () => {
    // Bidding became simultaneous on 2026-08-12: the form is SilentAuctionBid.vue, up in Game.vue's
    // round-0 strip, so that every seat can fill it in at once rather than one per turn. This panel
    // is only ever rendered for the seat the engine points at, so it must not carry a second copy.
    const engine = new Engine(
      [
        "init 3 lf-silent-bid",
        "p1 banFaction terrans",
        "p2 banFaction lantids",
        "p3 banFaction hadsch-hallas",
        "p1 faction itars",
        "p2 faction xenos",
        "p3 faction taklons",
      ],
      { auction: AuctionVariant.Silent }
    );
    engine.generateAvailableCommandsIfNeeded();

    expect(engine.availableCommands.map((command) => command.name)).to.deep.equal([Command.SilentBid]);

    const store = makeStore();
    store.commit("receiveData", engine);
    store.commit("setSealedBidBackend", { submit: async () => undefined, refresh: async () => undefined });

    const wrapper = mount(Commands, { propsData: { currentMove: "" }, store });

    expect(wrapper.findAll(".silent-bid-form").length).to.equal(0);
    expect(wrapper.findAll(".silent-bid-submit").length).to.equal(0);

    wrapper.destroy();
  });

  it("Silent Auction: still bids from here in a hosted game that had already started doing so", async () => {
    // The one exception, and the reason the old form survives: a game that was already recording
    // `silentBid` moves one seat at a time when bidding went simultaneous has those seats in its
    // move log, so it has to finish the way it started (viewer/src/logic/sealed-bid.ts).
    const engine = new Engine(
      [
        "init 3 lf-silent-bid",
        "p1 banFaction terrans",
        "p2 banFaction lantids",
        "p3 banFaction hadsch-hallas",
        "p1 faction itars",
        "p2 faction xenos",
        "p3 faction taklons",
        "p1 silentBid itars 15 xenos 0 taklons 10",
      ],
      { auction: AuctionVariant.Silent }
    );
    engine.generateAvailableCommandsIfNeeded();

    const store = makeStore();
    store.commit("receiveData", engine);
    store.commit("setSealedBidBackend", { submit: async () => undefined, refresh: async () => undefined });

    const wrapper = mount(Commands, { propsData: { currentMove: "" }, store, attachTo: document.body });
    const inputs = wrapper.findAll(".silent-bid-form input[type=number]");

    expect(inputs.length).to.equal(3);

    // Only the three factions up for auction are offered - not every faction in the box - and each
    // is a real button that opens that faction's sheet.
    const sheetButtons = wrapper.findAll(".silent-bid-form .faction-sheet-button");
    expect(sheetButtons.wrappers.map((w) => w.text().trim())).to.deep.equal(["Itars", "Xenos", "Taklons"]);

    await inputs.at(0).setValue("12");
    await inputs.at(1).setValue("0");
    await inputs.at(2).setValue("8");
    await wrapper.find(".silent-bid-submit").trigger("click");
    await Vue.nextTick();

    const emitted = wrapper.emitted("command");
    expect(emitted).to.not.equal(undefined);
    const command = emitted![emitted!.length - 1][0] as string;

    // p2's provisional faction is already "xenos" by this point (picked in the previous phase),
    // so the viewer addresses the move by faction name rather than seat.
    expect(command).to.match(/^xenos silentBid /);
    expect(command).to.include("itars 12");
    expect(command).to.include("xenos 0");
    expect(command).to.include("taklons 8");

    wrapper.destroy();
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

  it("duplicates the status line inside #move-buttons (for the mobile sticky bar) once round 1+ starts, alongside the standalone copy for wider viewports", () => {
    const engine = createLostFleetRoundMoveEngine();
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(Commands, { props: { currentMove: "" }, store });

    const moveButtons = container.querySelector("#move-buttons");
    const inBarTitle = moveButtons?.querySelector(".sticky-bar-title");
    expect(inBarTitle, "expected a status line inside #move-buttons").to.not.equal(null);
    expect(inBarTitle!.textContent).to.contain("Round 1");

    const standaloneTitle = container.querySelector("#move-title");
    expect(standaloneTitle?.classList.contains("hide-on-mobile-sticky")).to.equal(true);
    expect(standaloneTitle!.textContent).to.contain("Round 1");
  });

  it("does not duplicate the status line before round 1 (faction picking) - only #move-title renders it", () => {
    const engine = new Engine(["init 2 lf-no-auction"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(Commands, { props: { currentMove: "" }, store });

    expect(container.querySelector("#move-buttons .sticky-bar-title")).to.equal(null);
    expect(container.querySelector("#move-title")?.classList.contains("hide-on-mobile-sticky")).to.equal(false);
  });

  describe("the frozen bottom bar during round 0", () => {
    // `new Engine(moves)` leaves availableCommands null (executeMove clears it after every move);
    // the real app always comes through Engine.fromData, which regenerates. Mirror that here, or the
    // button list this bar's visibility depends on is empty for the wrong reason.
    function setupEngine(extraBuilds: number): Engine {
      const engine = new Engine(["init 2 lf-no-auction", "p1 faction terrans", "p2 faction nevlas"]);
      for (let i = 0; i < extraBuilds; i++) {
        engine.generateAvailableCommandsIfNeeded();
        const build = engine.availableCommands.find((c) => c.name === Command.Build);
        const faction = engine.players[engine.playerToMove].faction;
        engine.move(`${faction} ${Command.Build} m ${(build.data as any).buildings[0].coordinates}`);
      }
      engine.generateAvailableCommandsIfNeeded();
      return engine;
    }

    function pinned(engine: Engine, props: Record<string, unknown> = {}): boolean {
      const store = makeStore();
      store.commit("receiveData", engine);
      const { container } = render(Commands, { props: { currentMove: "", ...props }, store });
      return container.querySelector("#move-buttons .sticky-bar-title") !== null;
    }

    // Owner instruction: the round-0 presses that pair with looking at the map - the starting mines
    // and the booster - belong in the frozen bar too. The faction pick/ban/bid rows do not: they are
    // read once and answered once, and are wider than the strip.
    it("pins it for the starting mines and the booster pick", () => {
      const mines = setupEngine(0);
      expect(mines.phase).to.equal(Phase.SetupBuilding);
      expect(pinned(mines), "starting mines").to.equal(true);

      const boosters = setupEngine(4);
      expect(boosters.phase).to.equal(Phase.SetupBooster);
      expect(pinned(boosters), "booster pick").to.equal(true);
    });

    it("leaves it unpinned for the faction pick", () => {
      const engine = Engine.fromData(JSON.parse(JSON.stringify(new Engine(["init 2 lf-no-auction"]))));
      expect(engine.phase).to.equal(Phase.SetupFaction);
      expect(pinned(engine)).to.equal(false);
    });

    it("leaves it unpinned for sandbox mode's own faction seed - that is a faction pick too", () => {
      // Same position that pins above; the only difference is the seed picker taking the area over.
      const engine = setupEngine(0);
      expect(pinned(engine, { analysisMode: true })).to.equal(true);
      expect(
        pinned(engine, {
          analysisMode: true,
          analysisFactionChoices: [{ faction: Faction.Terrans, name: "Terrans" }],
        })
      ).to.equal(false);
    });
  });

  describe("sandbox mode's Charge 1 / Undo Charge buttons", () => {
    /** The main menu the owner means: Research / Free action / Pass, i.e. the top-level round-move
     * list. `new Engine(...)` leaves availableCommands null, so generate them or the menu is empty. */
    function roundMoveMenu(): Engine {
      const engine = createLostFleetRoundMoveEngine();
      engine.generateAvailableCommandsIfNeeded();
      return engine;
    }

    function sandbox(engine: Engine) {
      const store = makeStore();
      store.commit("receiveData", engine);
      const { container } = render(Commands, { props: { currentMove: "", analysisMode: true }, store });
      const labels = () =>
        Array.from(container.querySelectorAll<HTMLButtonElement>("#move-buttons button.move-button")).map(
          (button) => button.textContent?.trim() ?? ""
        );
      const button = (label: string) =>
        Array.from(container.querySelectorAll<HTMLButtonElement>("#move-buttons button.move-button")).find(
          (candidate) => candidate.textContent?.trim() === label
        );
      return { container, labels, button };
    }

    // Owner instruction: they belong on the main menu - the one with Build/Explore/Research/Special
    // action on it - and nowhere else.
    it("shows both on the top-level round-move menu", () => {
      const { labels } = sandbox(roundMoveMenu());

      expect(labels()).to.include("Research"); // a real menu, not an empty one
      expect(labels()).to.include("Charge 1");
      expect(labels()).to.include("Undo Charge");
    });

    it("hides them on the round-0 booster pick, which is not that menu", () => {
      const engine = new Engine(["init 2 lf-no-auction", "p1 faction terrans", "p2 faction nevlas"]);
      for (let i = 0; i < 4; i++) {
        engine.generateAvailableCommandsIfNeeded();
        const build = engine.availableCommands.find((c) => c.name === Command.Build);
        const faction = engine.players[engine.playerToMove].faction;
        engine.move(`${faction} ${Command.Build} m ${(build.data as any).buildings[0].coordinates}`);
      }
      engine.generateAvailableCommandsIfNeeded();
      expect(engine.phase).to.equal(Phase.SetupBooster);

      const { labels } = sandbox(engine);

      expect(labels().length, "expected the booster buttons themselves").to.be.greaterThan(0);
      expect(labels()).to.not.include("Charge 1");
      expect(labels()).to.not.include("Undo Charge");
    });

    it("hides them once a button is drilled into (a sub-menu is not the main menu)", async () => {
      const { labels, button } = sandbox(roundMoveMenu());
      expect(labels()).to.include("Charge 1");

      const research = button("Research");
      expect(research, "expected a Research button to drill into").to.not.equal(undefined);
      await fireEvent.click(research!);

      expect(labels()).to.not.include("Charge 1");
      expect(labels()).to.not.include("Undo Charge");
    });

    // The keycap styling in the sticky bar is a `.move-button .btn` DESCENDANT rule, so these have to
    // sit inside a `.move-button` wrapper like MoveButton.vue's own root or they render with square
    // corners next to properly rounded neighbours.
    it("wraps them the same way MoveButton does, so they pick up the same button styling", () => {
      const { button } = sandbox(roundMoveMenu());

      expect(button("Charge 1")?.parentElement?.classList.contains("move-button")).to.equal(true);
      expect(button("Undo Charge")?.parentElement?.classList.contains("move-button")).to.equal(true);
    });
  });

  it("hides the auto-leech select before round 1 (faction picking) - nothing to leech from yet", () => {
    const engine = new Engine(["init 2 lf-no-auction"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(Commands, { props: { currentMove: "" }, store });

    expect(container.querySelector(".auto-leech-select")).to.equal(null);
  });

  it("shows the auto-leech select once round 1 starts, reachable from both the standalone title and the mobile sticky bar", () => {
    const engine = createLostFleetRoundMoveEngine();
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(Commands, { props: { currentMove: "" }, store });

    const selects = container.querySelectorAll(".auto-leech-select");
    expect(selects.length).to.equal(2);
    expect(container.querySelector("#move-title .auto-leech-select")).to.not.equal(null);
    expect(container.querySelector("#move-buttons .sticky-bar-title .auto-leech-select")).to.not.equal(null);
  });

  it("only shows after-passing auto-leech cap choices once the viewing seat has passed", () => {
    const engine = createLostFleetRoundMoveEngine();
    const store = makeStore();
    store.commit("preferences", { autoChargePower: "4", autoChargeMaxPassedRoundLeech: "3" });
    store.commit("receiveData", engine);

    const beforePass = render(Commands, { props: { currentMove: "" }, store });
    expect(beforePass.container.textContent).to.not.contain("After passing:");
    expect(beforePass.container.textContent).to.not.contain("cap 3");

    engine.passedPlayers = [PlayerEnum.Player1];
    store.commit("receiveData", engine);

    const afterPass = render(Commands, { props: { currentMove: "" }, store });
    expect(afterPass.container.textContent).to.contain("After passing: max 3 total power");
    expect(afterPass.container.textContent).to.contain("Leech: 4 cap 3");
  });

  it("hides the auto-leech select during analysis mode, putting the line's controls in its place instead (§2.9/§12)", () => {
    const engine = createLostFleetRoundMoveEngine();
    const store = makeStore();
    store.commit("receiveData", engine);
    const status = { overdrawn: [{ kind: "c", amount: -7 }], assumedPower: 2 };

    const { container } = render(Commands, {
      props: { currentMove: "", analysisMode: true, analysisStatus: status, analysisMoveCount: 3 },
      store,
    });

    expect(container.querySelector(".auto-leech-select")).to.equal(null);
    const controls = container.querySelectorAll(".analysis-controls");
    expect(controls.length).to.equal(2); // one in #move-title, one in the mobile sticky bar
    const title = container.querySelector("#move-title .analysis-controls");
    expect(title.textContent).to.contain("3 moves");
    expect(title.textContent).to.contain("-7c");
    expect(title.textContent).to.contain("+2 power");
  });

  it("puts round 0's faction seed in the action area as one button per faction, announced in the header", async () => {
    // Owner instruction: every sandbox press belongs in this one action area. The picker used to be a
    // select plus a "Try this faction" button in AnalysisPanel.vue, above the map.
    const engine = new Engine(["init 2 lf-viewer-temporary-range"]);
    const store = makeStore();
    store.commit("receiveData", engine);
    const choices = [
      { faction: Faction.Terrans, name: "Terrans" },
      { faction: Faction.Nevlas, name: "Nevlas" },
    ];

    const { container, emitted } = render(Commands, {
      props: { currentMove: "", analysisMode: true, analysisFactionChoices: choices },
      store,
    });

    expect(container.querySelector("#move-title").textContent).to.contain("choose a faction to play as");
    const buttons = Array.from(container.querySelectorAll("#move-buttons .faction-picker-buttons button"));
    expect(buttons.map((b) => b.textContent.trim())).to.deep.equal(["Terrans", "Nevlas"]);

    await fireEvent.click(buttons[1]);

    expect(emitted()["analysis-seed-faction"]).to.have.length(1);
    expect(emitted()["analysis-seed-faction"][0]).to.deep.equal([Faction.Nevlas]);
  });

  it("renders the info modal exactly once even though the controls are rendered in both headers", () => {
    // Two copies of one b-modal id make the button open whichever Bootstrap-Vue registered first -
    // the trap SetupStatus.vue's own comment warns about, which is why the modal lives outside
    // AnalysisHeaderControls.vue.
    const engine = createLostFleetRoundMoveEngine();
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(Commands, {
      props: { currentMove: "", analysisMode: true },
      store,
    });

    expect(container.querySelectorAll("#analysis-mode-info").length).to.be.at.most(1);
    expect(container.querySelectorAll(".analysis-controls__info").length).to.equal(2);
    // The commit confirmation is subject to exactly the same trap, and for the same reason - it is
    // opened by a button inside those twice-rendered controls.
    expect(container.querySelectorAll("#analysis-commit-confirm").length).to.be.at.most(1);
  });

  it("asks before committing instead of firing the moves off the button press (§6)", async () => {
    const engine = createLostFleetRoundMoveEngine();
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container, emitted } = render(Commands, {
      props: {
        currentMove: "",
        analysisMode: true,
        analysisMoveCount: 2,
        analysisCommittableMoves: 2,
        analysisCommitPlan: {
          live: "terrans up nav.",
          queued: ["terrans pass booster3"],
          dropped: [],
          cut: null,
          limit: "line",
        },
      },
      store,
    });

    const commit = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Commit")
    ) as HTMLButtonElement;
    await fireEvent.click(commit);
    await Vue.nextTick();

    // Nothing leaves the sandbox on the press itself - the modal's own confirm is what emits.
    expect(emitted()["analysis-commit"]).to.equal(undefined);
    expect((document.body.querySelector(".modal")?.textContent ?? "").replace(/\s+/g, " ")).to.contain(
      "terrans up nav."
    );
  });

  it("stripes both headers and reads SANDBOX during sandbox mode, without exiting when tapped (§5.1/§12)", async () => {
    const engine = createLostFleetRoundMoveEngine();
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container, emitted } = render(Commands, {
      props: { currentMove: "", analysisMode: true },
      store,
    });

    expect(container.querySelector("#move-title").textContent).to.contain("SANDBOX");
    expect(container.querySelector("#move-title").classList.contains("move-title--analysis")).to.equal(true);
    expect(
      container.querySelector("#move-buttons .sticky-bar-title").classList.contains("sticky-bar-title--analysis")
    ).to.equal(true);

    // Tap-to-exit is gone (§12): the header now hosts Undo/Reset/Commit, so a press meant for one of
    // those must never be read as "leave analysis mode". The map's corner button is the only way out.
    await fireEvent.click(container.querySelector("#move-title"));

    expect(emitted()["analysis-exit"]).to.equal(undefined);
  });

  it("drives the mobile sticky-bar spacer's height from a CSS custom property, not a direct inline height", () => {
    // The spacer must render as ~0 height on wide viewports (nothing fixed-position there to
    // compensate for) and only take up real space under the narrow-viewport media query - a
    // direct inline `height: Npx` would apply unconditionally everywhere instead, doubling the
    // button list's own footprint with an identical blank gap on desktop.
    const engine = createLostFleetRoundMoveEngine();
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(Commands, { props: { currentMove: "" }, store });

    const spacer = container.querySelector(".mobile-sticky-actions-spacer") as HTMLElement;
    expect(spacer, "expected the sticky-bar spacer to render once round 1+ starts").to.not.equal(null);
    expect(spacer.style.height).to.equal("");
    expect(spacer.style.getPropertyValue("--sticky-bar-height")).to.not.equal("");
  });

  it("suppresses the in-place sticky-bar spacer when hideSpacer is set, letting a caller reserve that space elsewhere instead", () => {
    // Game.vue's graphical layout sets this so the reserved gap moves from right after Turn Order
    // (a large dead gap before the first faction board) down to the end of the page.
    const engine = createLostFleetRoundMoveEngine();
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(Commands, { props: { currentMove: "", hideSpacer: true }, store });

    expect(container.querySelector(".mobile-sticky-actions-spacer")).to.equal(null);
  });
});
