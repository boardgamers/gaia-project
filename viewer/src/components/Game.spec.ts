import Engine, { AuctionVariant, Building, Command, Faction, Phase, Planet, PlayerEnum } from "@gaia-project/engine";
import { move as bgsMove, stripSecret } from "@gaia-project/engine/wrapper";
import { fireEvent } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { MAX_ANALYSIS_LINES } from "../logic/analysis";
import { makeStore } from "../store";
import Game from "./Game.vue";

Vue.use(BootstrapVue);

describe("Game", () => {
  afterEach(() => {
    // A failed assertion must not leave a mounted board and its watchers running into the next test.
    for (const element of Array.from(document.body.children)) {
      const vm = (element as any).__vue__;
      if (vm) vm.$destroy();
      element.remove();
    }
  });
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
    expect(store.state.data.moveHistory[store.state.data.moveHistory.length - 1]).to.equal(
      "tinkeroids booster booster2"
    );

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
    const moweydsState = createMoweydsPiUpgradeState();
    let { persisted } = moweydsState;
    const { partial, coordinates } = moweydsState;

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

  it("aligns the final scoring tiles' top edge with the research track's top, and keeps the viewBox tall enough that ScoringBoard isn't clipped (base game only - Lost Fleet moved final scoring onto the map itself)", () => {
    const engine = new Engine(["init 2 lf-freeze-28"]);
    engine.players.forEach((pl, index) => {
      pl.faction = [Faction.Terrans, Faction.Lantids][index];
      pl.loadFaction(null, engine.expansions);
    });

    const store = makeStore();
    const vm = new (Vue.extend(Game as any))({ store }) as any;
    vm.handleData(engine);
    vm.$mount();
    document.body.appendChild(vm.$el);

    const svg = vm.$el.querySelector("svg.scoring-research-board");
    const researchBoard = svg.querySelector("svg.research-board");
    const scoringBoard = researchBoard.nextElementSibling;
    expect(scoringBoard.tagName).to.equal("svg");
    // Base game framing: the research board at the viewBox origin, and the side ScoringBoard
    // anchored at y=0 so its top aligns with the research tracks' top (owner report, 2026-09).
    expect(researchBoard.getAttribute("y")).to.equal(null);
    expect(scoringBoard.getAttribute("y")).to.equal("0");

    const [, minY, , height] = svg.getAttribute("viewBox").split(" ").map(Number);
    expect(minY).to.equal(0);
    // The scoring column is 446 tall (the research board's 440 + the ~6 units the general tech
    // tiles extend past it), so its bottom aligns with the tech tiles' bottom edge.
    expect(scoringBoard.getAttribute("viewBox")).to.contain("446");
    // The canvas still reserves room for the power/QIC action row below the tracks.
    expect(height).to.equal(505);

    vm.$el.remove();
    vm.$destroy();
  });

  it("renders Turn Order compactly in the commands row (the pre-Gaia-9 placement - the full-width top banner was reverted)", () => {
    const setupEngine = new Engine(["init 2 lf-freeze-28"]);

    const gameplayEngine = new Engine(["init 2 lf-freeze-28"]);
    gameplayEngine.players.forEach((pl, index) => {
      pl.faction = [Faction.Terrans, Faction.Lantids][index];
      pl.loadFaction(null, gameplayEngine.expansions);
    });
    gameplayEngine.phase = Phase.RoundMove;
    gameplayEngine.round = 1;
    gameplayEngine.turnOrder = gameplayEngine.players.map((pl) => pl.player);
    gameplayEngine.currentPlayer = PlayerEnum.Player1;

    // The restored compact TurnOrder sits in the commands row (col-md-4, order-flipped against
    // the commands column on mobile) - identical for setup and in-progress engines.
    for (const engine of [setupEngine, gameplayEngine]) {
      const store = makeStore();
      const vm = new (Vue.extend(Game as any))({ store }) as any;
      vm.handleData(engine);
      vm.$mount();
      document.body.appendChild(vm.$el);

      const turnOrder = vm.$el.querySelector(".turn-order");
      expect(turnOrder, "expected TurnOrder to render").to.not.equal(null);
      // No banner chrome, and it shares the row with the commands column.
      expect(vm.$el.querySelector(".turn-order-banner"), "no top banner").to.equal(null);
      expect(vm.$el.querySelector(".col-md-4.order-md-1"), "Turn Order column class").to.not.equal(null);

      vm.$el.remove();
      vm.$destroy();
    }
  });

  it("suppresses the standalone Turn Order banner in hosted mode (folded into HostedBar.vue instead, PROGRESS.md Gaia 10)", () => {
    const originalSearch = window.location.search;
    window.history.pushState({}, "", "?game=some-game-id");
    try {
      const engine = new Engine(["init 2 lf-freeze-28"]);
      const store = makeStore();
      const vm = new (Vue.extend(Game as any))({ store }) as any;
      vm.handleData(engine);
      vm.$mount();
      document.body.appendChild(vm.$el);

      expect(vm.$el.querySelector(".turn-order-banner"), "hosted mode should not render its own banner").to.equal(null);

      vm.$el.remove();
      vm.$destroy();
    } finally {
      window.history.pushState({}, "", `${window.location.pathname}${originalSearch}`);
    }
  });

  it("shows faction-pick controls in hot-seat test games (no hosted seat lock), but hides them for a locked non-turn hosted seat", async () => {
    const engine = new Engine(["init 2 hosted-faction-picker-visibility"], { lostFleet: true });
    const mountWithSeat = (seatIndex: number | undefined) => {
      const store = makeStore();
      store.commit("hosted", new URLSearchParams(window.location.search).has("game"));
      if (seatIndex !== undefined) {
        store.commit("player", { index: seatIndex });
      } else {
        store.state.player = null;
      }
      const vm = new (Vue.extend(Game as any))({ store }) as any;
      vm.handleData(Engine.fromData(JSON.parse(JSON.stringify(engine))));
      vm.$mount();
      document.body.appendChild(vm.$el);
      return vm;
    };

    const hotSeatVm = mountWithSeat(undefined);
    await Vue.nextTick();
    expect(hotSeatVm.canPlay).to.equal(true);
    expect(hotSeatVm.$el.querySelector("#move")).to.not.equal(null);
    hotSeatVm.$el.remove();
    hotSeatVm.$destroy();

    const lockedVm = mountWithSeat(1);
    await Vue.nextTick();
    expect(lockedVm.canPlay).to.equal(false);
    expect(lockedVm.$el.querySelector("#move-buttons")).to.equal(null);
    expect(lockedVm.$el.textContent).to.not.contain("Sequential premove");
    lockedVm.$el.remove();
    lockedVm.$destroy();
  });

  it("hides the current player's action buttons for a spectator (hosted player message with no seat)", async () => {
    const engine = new Engine(["init 2 spectator-no-buttons"], { lostFleet: true });
    const store = makeStore();
    // A spectator's `player` message is an empty object - no `index`. The viewer must NOT fall
    // through to hot-seat `canPlay = true` here (that made a spectator see the current move).
    store.commit("player", {});
    const vm = new (Vue.extend(Game as any))({ store }) as any;
    vm.handleData(Engine.fromData(JSON.parse(JSON.stringify(engine))));
    vm.$mount();
    document.body.appendChild(vm.$el);
    await Vue.nextTick();

    expect(vm.canPlay).to.equal(false);
    expect(vm.$el.querySelector("#move")).to.equal(null);

    vm.$el.remove();
    vm.$destroy();
  });

  it("hides ScoringBoard for a Lost Fleet game - final scoring, the 7th adv-tech tile, and the round scoring tiles all moved into ResearchBoard's own extra column", () => {
    const engine = new Engine(["init 2 lf-scoring-extension"], { lostFleet: true });
    engine.players.forEach((pl, index) => {
      pl.faction = [Faction.Terrans, Faction.Lantids][index];
      pl.loadFaction(null, engine.expansions);
    });

    const store = makeStore();
    const vm = new (Vue.extend(Game as any))({ store }) as any;
    vm.handleData(engine);
    vm.$mount();
    document.body.appendChild(vm.$el);

    const svg = vm.$el.querySelector("svg.scoring-research-board");
    const researchBoard = svg.querySelector("svg.research-board");

    // ScoringBoard.vue's own fixed `viewBox="0 0 80 480"` is distinctive - assert no such element
    // is mounted anywhere in the shared svg (BoardAction is also svg-tagged, so checking tagName
    // alone wouldn't distinguish it).
    const scoringBoardViewBox = [...svg.querySelectorAll("svg")].find(
      (el) => el.getAttribute("viewBox") === "0 0 80 480"
    );
    expect(scoringBoardViewBox).to.equal(undefined);
    expect(researchBoard.querySelector(".techTile.adv-ext")).to.not.equal(null);
    expect(researchBoard.querySelectorAll(".scoringTile").length).to.be.greaterThan(0);

    // The nested board now declares its exact 6-track + extension width and the outer canvas ends
    // at that same edge. This prevents the preserveAspectRatio letterboxing that left wide empty
    // gutters around the board on phones. The extension column is sized to its own content (round /
    // final scoring tiles), so the whole board is centered in its panel with no wide right gutter.
    expect(researchBoard.getAttribute("width")).to.equal("430");
    const [minX, , canvasWidth, canvasHeight] = svg.getAttribute("viewBox").split(" ").map(Number);
    expect(minX).to.equal(-50);
    expect(canvasWidth).to.equal(430);
    // The canvas reserves room for the power-action row's ACTUAL painted bottom edge. Each octagon is
    // translated to y = 445 (baseResearchBoardHeight + 5) but BoardAction.vue's inner
    // `viewBox="-28 -28 56 56"` shifts it +28 down and its own box reaches ~19 past that center, so its
    // real bottom is 445 + 28 + 19 = 492; +5 breathing => 497. The earlier 474 assumed the octagon sat
    // at its bare translate, which left the row spilling ~18px past the panel into the ship boards.
    expect(canvasHeight).to.equal(497);
    expect(svg.getAttribute("width")).to.equal("430");
    expect(svg.getAttribute("height")).to.equal("497");
    // The rounded panel rect behind the board is gone (owner request, 2026-09) - the boards
    // render on the page background in both Lost Fleet and base games.
    expect(svg.querySelector(".research-actions-panel")).to.equal(null);
    expect(svg.closest(".game-board-layout")).to.not.equal(null);

    // The whole action row is left-aligned within the board panel (per the owner's brief), hugging
    // the panel's left edge in line with the research tracks' own left inset, and leaving the extra
    // space on the right - it is NOT centered between two equal margins. Each octagon paints +28 from
    // its translate on both axes, so the leftmost octagon's real left edge is min(translate) + 28 - 26
    // and the rightmost's real right edge is max(translate) + 28 + 19.
    const panelLeft = minX + 1;
    const panelRight = minX + 1 + (canvasWidth - 2);
    const actionGroups = [...svg.querySelectorAll("g.boardAction")];
    expect(actionGroups.length).to.be.greaterThan(0);
    const translateXs = actionGroups.map((g) => {
      const m = /translate\(\s*(-?[\d.]+)/.exec(g.getAttribute("transform") || "");
      return m ? Number(m[1]) : NaN;
    });
    const firstLeft = Math.min(...translateXs) + 28 - 26;
    const lastRight = Math.max(...translateXs) + 28 + 19;
    const leftMargin = firstLeft - panelLeft;
    const rightMargin = panelRight - lastRight;
    expect(leftMargin, "power-action row should hug the panel's left edge").to.be.closeTo(1, 3);
    expect(rightMargin, "left-aligned row leaves the extra space on the right").to.be.greaterThan(leftMargin + 20);

    vm.$el.remove();
    vm.$destroy();
  });

  it("nests the ship boards directly under the research board (same column, normal document flow) and narrows the buttons row to the map's own width", async () => {
    const engine = new Engine(["init 2 lf-ship-board-width"], { lostFleet: true });
    engine.players.forEach((pl, index) => {
      pl.faction = [Faction.Terrans, Faction.Lantids][index];
      pl.loadFaction(null, engine.expansions);
    });

    const store = makeStore();
    const vm = new (Vue.extend(Game as any))({ store }) as any;
    // This test is about the desktop layout, and jsdom has no matchMedia, so isDesktopViewport()
    // defaults to mobile - where round 0 deliberately moves the buttons out of this column (see
    // `setupActionsAtTop`). Say so explicitly rather than depending on the default.
    vm.isDesktopViewport = true;
    vm.handleData(engine);
    vm.$mount();
    document.body.appendChild(vm.$el);

    // Stacked directly below the research board SVG in the same col-md-5 div (not a separate
    // Bootstrap row) so it hugs the power/QIC action row's actual bottom edge at every viewport
    // width, instead of waiting for a shared row to clear the taller of the map/research columns
    // above it (which left a resize-dependent gap whenever the map ended up taller).
    const researchCol = vm.$el.querySelector(".scoring-research-board")?.closest(".col-md-5");
    expect(researchCol, "expected a col-md-5 wrapping the research board").to.not.equal(null);
    expect(researchCol.classList.contains("game-board-side-column")).to.equal(true);
    const shipsRow = researchCol.querySelector(".lost-fleet-ships-row");
    expect(shipsRow, "expected the ship boards' row inside the research board's own column").to.not.equal(null);
    // The research board sits inside its own panel (ResearchPanel.vue), which is what precedes the
    // ship row in that column.
    const researchPanel = shipsRow.previousElementSibling;
    expect(researchPanel?.classList.contains("research-panel")).to.equal(true);
    expect(researchPanel.querySelector(".scoring-research-board")).to.not.equal(null);
    expect(shipsRow.querySelector(".lost-fleet-ships")).to.not.equal(null);

    // The round-booster/federation-token Pool sits beside the ships in that same row (in "compact"
    // mode - no page-gutter padding) instead of its own full-width section further down the page -
    // exactly one Pool renders for a Lost Fleet game, and it's this sidebar one, not both.
    const poolSidebar = shipsRow.querySelector(".lost-fleet-pool-sidebar");
    expect(poolSidebar, "expected the Pool sidebar beside the ships").to.not.equal(null);
    expect(vm.$el.querySelectorAll(".pool").length, "expected exactly one Pool for a Lost Fleet game").to.equal(1);

    // Tile taps leave the booster/federation face alone.
    const poolSource = poolSidebar.querySelector(".pool-tiles-face");
    await fireEvent.click(poolSource);
    expect(poolSource.getAttribute("aria-hidden")).to.equal(null);

    // The buttons column still narrows to the map's own width on desktop - now with nothing sharing
    // its row (the ship boards moved above), so the remaining col-md-5 space is simply left blank.
    const commandsCol = vm.$el.querySelector("#move")?.closest(".col-12");
    expect(commandsCol, "expected the buttons wrapper to carry col-12").to.not.equal(null);
    expect(commandsCol.classList.contains("col-md-7")).to.equal(true);

    vm.$el.remove();
    vm.$destroy();
  });

  describe("analysis mode", () => {
    const SETUP_MOVES = [
      "init 2 randomSeed",
      "p1 faction terrans",
      "p2 faction nevlas",
      "terrans build m -1x2",
      "nevlas build m -1x0",
      "nevlas build m 0x-4",
      "terrans build m -4x-1",
      "nevlas booster booster7",
      "terrans booster booster3",
    ];

    function researchGame() {
      const engine = new Engine(SETUP_MOVES);
      for (const player of engine.players) player.data.knowledge = 12;
      engine.clearAvailableCommands();
      engine.generateAvailableCommands();
      return engine;
    }

    function mountAsSeat(seatIndex: number | undefined, engine: Engine = new Engine(SETUP_MOVES)) {
      const store = makeStore();
      store.commit("hosted", new URLSearchParams(window.location.search).has("game"));
      if (seatIndex !== undefined) {
        store.commit("player", { index: seatIndex });
      } else {
        store.state.player = null;
      }
      const vm = new (Vue.extend(Game as any))({ store }) as any;
      vm.handleData(engine);
      vm.$mount();
      document.body.appendChild(vm.$el);
      return vm;
    }

    function spyDispatch(vm: any): any[] {
      const dispatched: any[] = [];
      const originalDispatch = vm.$store.dispatch.bind(vm.$store);
      vm.$store.dispatch = (type: string, payload: unknown) => {
        dispatched.push({ type, payload });
        return originalDispatch(type, payload);
      };
      return dispatched;
    }

    afterEach(() => {
      window.localStorage.clear();
    });

    it("is offered to a locked seat any time - round 1+, setup, and off-turn alike - but not to an unlocked (hot-seat) seat off-turn", () => {
      // playerToMove is 0 (terrans) after setup.
      const onTurn = mountAsSeat(0);
      expect(onTurn.analysisOffered).to.equal(true);
      onTurn.$el.remove();
      onTurn.$destroy();

      // Off-turn is now ALSO offered for a locked seat: applySoloRoundFlow already forces the
      // clone's turn order to whichever seat you enter as, regardless of the real playerToMove at
      // entry, so the entry gate no longer needs to require canPlay for a locked seat.
      const offTurn = mountAsSeat(1);
      expect(offTurn.canPlay).to.equal(false); // Commands.vue itself still correctly stays hidden
      expect(offTurn.analysisOffered).to.equal(true);
      offTurn.$el.remove();
      offTurn.$destroy();

      // Phase 4 (§2.6/decision #6): "Round 0 / setup. Playable." - offered during setup too.
      const duringSetup = mountAsSeat(0, new Engine(["init 2 randomSeed"]));
      expect(duringSetup.engine.round).to.equal(0);
      expect(duringSetup.canPlay).to.equal(true);
      expect(duringSetup.analysisOffered).to.equal(true);
      duringSetup.$el.remove();
      duringSetup.$destroy();

      // Hot-seat/pass-and-play (no locked seat) has no "my seat" identity to be off-turn from -
      // canPlay is already unconditionally true there, so this stays offered exactly as before.
      const hotSeat = mountAsSeat(undefined);
      expect(hotSeat.myLockedSeat).to.equal(undefined);
      expect(hotSeat.analysisOffered).to.equal(true);
      hotSeat.$el.remove();
      hotSeat.$destroy();
    });

    it("offers a compact simulation control on turn, with no empty planning card", async () => {
      const vm = mountAsSeat(0);
      await Vue.nextTick();
      expect(vm.$el.querySelector(".premove-queue")).to.equal(null);
      const start = vm.$el.querySelector("#move-title .planning-entry");
      expect(start.textContent).to.contain("Simulate moves");
      await fireEvent.click(start);
      expect(vm.analysisMode).to.equal(true);
      expect(vm.$el.querySelector(".premove-queue")).not.to.equal(null);
      vm.exitAnalysisMode();
      await Vue.nextTick();
      expect(vm.$el.querySelector(".premove-queue")).to.equal(null);
      vm.$el.remove();
      vm.$destroy();
    });

    it("still shows queued moves and cancellation while on turn", async () => {
      const position = new Engine(SETUP_MOVES);
      position.automation = {
        version: 1,
        plans: {
          0: {
            moves: ["terrans up nav."],
            revision: 1,
            round: 1,
            requestId: "queued",
          },
        },
        increments: [0, 0],
        turns: [0, 0],
        liveUpdate: false,
      };
      const vm = mountAsSeat(0, position);
      await Vue.nextTick();
      expect(vm.$el.querySelector(".premove-queue").textContent).to.contain("Cancel all");
      const stopped = JSON.parse(JSON.stringify(vm.engine));
      stopped.automation.plans[0].moves = [];
      stopped.automation.plans[0].notice = { kind: "stopped", text: "Premoves stopped: insufficient ore" };
      await vm.$store.dispatch("externalData", stopped);
      await Vue.nextTick();
      expect(vm.$el.querySelector(".premove-queue")).to.equal(null);
      expect(vm.$el.querySelector(".premove-notice").textContent).to.contain("Premoves stopped: insufficient ore");
      vm.$el.remove();
      vm.$destroy();
    });

    it("actually lets an off-turn locked seat compose and complete their own turn inside the sandbox", () => {
      // Seat 1 (nevlas) is locked but it's genuinely seat 0's (terrans') turn right now.
      const vm = mountAsSeat(1);
      expect(vm.canPlay).to.equal(false);
      expect(vm.engine.playerToMove).to.equal(0);

      vm.enterAnalysisMode();

      expect(vm.analysisMode).to.equal(true);
      expect(vm.analysisSeat).to.equal(1);
      // applySoloRoundFlow forced the clone's turn to seat 1 outright, regardless of the real
      // playerToMove at entry - this is the actual proof the widened gate is backed by working
      // mechanics, not just an open door to a sandbox that silently can't be used.
      expect(vm.engine.playerToMove).to.equal(1);

      vm.applyAnalysisMove("nevlas up nav.");
      expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "nevlas up nav." }]);

      vm.$el.remove();
      vm.$destroy();
    });

    it("is offered to every locked seat during a simultaneous sealed-bid round, even though canPlay only ever reads true for one of them (the original owner-reported case)", () => {
      // Silent Auction ban/pick, stopping right at the secret-bid phase - nobody has bid yet, so
      // playerToMove/currentPlayer sits on whichever seat bids first (seat 0), not the OTHER locked
      // seats this test checks.
      const engine = new Engine(
        [
          "init 3 lf-silent-sealed",
          "p1 banFaction terrans",
          "p2 banFaction lantids",
          "p3 banFaction hadsch-hallas",
          "p1 faction itars",
          "p2 faction xenos",
          "p3 faction taklons",
        ],
        { auction: AuctionVariant.Silent }
      );
      expect(engine.phase).to.equal(Phase.SetupSilentBid);

      const notOnTurn = mountAsSeat(2, engine);
      expect(notOnTurn.canPlay).to.equal(false); // the pre-existing, still-correct behavior for Commands.vue
      expect(notOnTurn.analysisOffered).to.equal(true); // but this seat genuinely has a bid to make right now
      notOnTurn.$el.remove();
      notOnTurn.$destroy();
    });

    it("enters a clone (real state untouched) and exits back to the exact real state, dispatching nothing either way", () => {
      const vm = mountAsSeat(0);
      const beforeMoveHistory = [...vm.engine.moveHistory];
      const dispatched = spyDispatch(vm);

      vm.enterAnalysisMode();
      expect(vm.analysisMode).to.equal(true);
      expect(vm.analysisSeat).to.equal(0);
      expect(vm.canPlay).to.equal(true);

      // The clone, not the real engine, is what's on screen - taking a real move in it must not
      // touch the backup.
      vm.applyAnalysisMove("terrans up nav.");
      expect(vm.engine.moveHistory[vm.engine.moveHistory.length - 1]).to.equal("terrans up nav (0 ⇒ 1).");
      expect(JSON.parse(JSON.stringify(vm.analysisBackup)).moveHistory).to.deep.equal(beforeMoveHistory);

      vm.exitAnalysisMode();
      expect(vm.analysisMode).to.equal(false);
      expect(vm.engine.moveHistory).to.deep.equal(beforeMoveHistory);
      expect(dispatched).to.deep.equal([]);

      vm.$el.remove();
      vm.$destroy();
    });

    it("commits a completed turn to the line automatically, with no separate confirm step", () => {
      const vm = mountAsSeat(0);
      vm.enterAnalysisMode();

      expect(vm.analysisEntries).to.deep.equal([]);
      vm.applyAnalysisMove("terrans up nav.");
      expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);

      vm.$el.remove();
      vm.$destroy();
    });

    // The owner-reported bug, reproduced in a real browser: in sandbox mode every press of the action
    // area's Back button charged 1 power. Back and "Charge 1" are unkeyed sibling `v-if`s over the
    // same `<div class="move-button">` and are never on screen together (`canUndo` vs
    // `showAnalysisChargeButtons`), so Vue's `sameVnode` patched one into the other and re-pointed the
    // SAME DOM button at `$emit('analysis-charge')`. Browsers run a microtask checkpoint between event
    // listeners, so that re-render landed mid-dispatch and the still-bubbling click ran the new
    // handler - one `{kind:"adjust",charge:1}` entry per press.
    //
    // jsdom does NOT run that checkpoint between listeners, which is exactly why an earlier pass over
    // this bug found nothing here and called it cosmetic. So the guard that matters is the second
    // test, which asserts the DOM reuse itself rather than the timing that exploits it - remove the
    // keys and that one fails, in jsdom, today.
    describe("the action area's Back button (owner report, 2026-08-19)", () => {
      // Round 2, so the top-level menu carries the sandbox Charge buttons and a submenu to go into.
      const ROUND_2 = [...SETUP_MOVES, "terrans pass booster4", "nevlas pass booster5"];

      async function sandboxInASubmenu() {
        const vm = mountAsSeat(0, new Engine(ROUND_2));
        vm.enterAnalysisMode();
        await Vue.nextTick();
        await Vue.nextTick();

        const shown = () =>
          (
            Array.from(
              document.querySelectorAll(".move-button > button, .analysis-simulation__button")
            ) as HTMLElement[]
          ).filter((b) => !(b.parentElement as HTMLElement).className.includes("d-none"));
        // Both, because these buttons split their wording between the two: the sandbox Charge button
        // says "Charge 1" in its text and something else entirely in its tooltip.
        const titleOf = (b: HTMLElement) =>
          `${b.getAttribute("title") ?? ""} ${b.textContent ?? ""}`.replace(/\s+/g, " ");

        expect(
          shown().some((b) => titleOf(b).includes("Simulate charge")),
          "Charge 1 is on the top menu"
        ).to.equal(true);
        const research = shown().find((b) => titleOf(b).includes("Research"));
        await fireEvent.click(research!);
        await Vue.nextTick();
        await Vue.nextTick();

        return { vm, shown, titleOf };
      }

      it("does not charge power, or touch the line at all", async () => {
        const { vm, shown, titleOf } = await sandboxInASubmenu();
        const powerBefore = JSON.stringify(vm.engine.players[0].data.power);

        const back = shown().find((b) => titleOf(b).includes("Back"))!;
        // The badge's own hit-circle is what a real press lands on, not the button box around it.
        await fireEvent.click(back.querySelector("circle.undo-button") ?? back);
        await Vue.nextTick();
        await Vue.nextTick();

        expect(vm.analysisEntries).to.deep.equal([]);
        expect(JSON.stringify(vm.engine.players[0].data.power)).to.equal(powerBefore);
        expect(
          shown().some((b) => titleOf(b).includes("Simulate charge")),
          "and it really did go back"
        ).to.equal(true);

        vm.$el.remove();
        vm.$destroy();
      });

      it("never lets Vue reuse Back's element as the Charge 1 button", async () => {
        // The root cause, asserted directly: with distinct keys the element is destroyed and rebuilt
        // rather than re-pointed, so no click can ever be delivered to the wrong handler.
        const { vm, shown, titleOf } = await sandboxInASubmenu();
        const backElement = shown().find((b) => titleOf(b).includes("Back"))!;

        vm.undoMove();
        await Vue.nextTick();
        await Vue.nextTick();

        const charge = shown().find((b) => titleOf(b).includes("Simulate charge"));
        expect(charge, "back to the top menu").to.not.equal(undefined);
        expect(charge).to.not.equal(backElement);

        vm.$el.remove();
        vm.$destroy();
      });

      it("dispatches undo once per press, not twice", async () => {
        // Separately real: the badge's hit-circle carried its own @click AND sat inside a b-btn with
        // the same handler, so one press went back a level and then undid a command as well.
        const { vm, shown, titleOf } = await sandboxInASubmenu();
        let undos = 0;
        const unsub = vm.$store.subscribeAction(({ type }: { type: string }) => {
          if (type === "undo") undos++;
        });

        const back = shown().find((b) => titleOf(b).includes("Back"))!;
        await fireEvent.click(back.querySelector("circle.undo-button") ?? back);

        expect(undos).to.equal(1);

        unsub();
        vm.$el.remove();
        vm.$destroy();
      });
    });

    it("undo pops the last entry and replays back to the prior board", () => {
      const vm = mountAsSeat(0);
      vm.enterAnalysisMode();
      vm.applyAnalysisMove("terrans up nav.");
      const knowledgeAfterFirst = vm.engine.players[0].data.research.nav;

      vm.undoLastAnalysisEntry();

      expect(vm.analysisEntries).to.deep.equal([]);
      expect(vm.engine.players[0].data.research.nav).to.not.equal(knowledgeAfterFirst);
      expect(vm.engine.moveHistory).to.deep.equal(vm.analysisBackup.moveHistory);

      vm.$el.remove();
      vm.$destroy();
    });

    it("reset clears every entry in one step", () => {
      const vm = mountAsSeat(0);
      vm.enterAnalysisMode();
      vm.applyAnalysisMove("terrans up nav.");

      vm.resetAnalysisLine();

      expect(vm.analysisEntries).to.deep.equal([]);
      expect(vm.engine.moveHistory).to.deep.equal(vm.analysisBackup.moveHistory);

      vm.$el.remove();
      vm.$destroy();
    });

    // The state a live async game spends most of its time in: somebody built inside leech range and
    // the round is parked on the opponent's accept/decline answer.
    function leechPausedGame() {
      const engine = new Engine(SETUP_MOVES);
      engine.players[0].data.credits = 20;
      engine.players[0].data.ores = 20;
      engine.move("terrans build ts -1x2.");
      engine.generateAvailableCommandsIfNeeded();
      expect(engine.phase).to.equal(Phase.RoundLeech);
      return engine;
    }

    it("opens a playable board even when the real game is parked on an opponent's leech answer", () => {
      // Entering here used to leave the clone sitting on the opponent's prompt: canPlay false, no
      // commands for this seat, and applyAnalysisMove a silent no-op - a sandbox with nothing in it
      // and no way forward but leaving. enterAnalysisMode never resolved opponent decisions (only the
      // per-entry replay did, which an empty line skips) and applySoloRoundFlow returns early outside
      // RoundMove.
      const vm = mountAsSeat(0, leechPausedGame());

      vm.enterAnalysisMode();

      expect(vm.engine.phase).to.equal(Phase.RoundMove);
      expect(vm.engine.playerToMove).to.equal(0);
      expect(vm.canPlay).to.equal(true);
      vm.applyAnalysisMove("terrans up nav.");
      expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);

      vm.$el.remove();
      vm.$destroy();
    });

    it("rolls a seat that has already passed into the next round, and commits nothing from it", () => {
      // applySoloRoundFlow used to wipe passedPlayers outright, handing back a full turn - Pass button
      // and all - in a round this seat is out of, and reporting those moves as committable.
      const vm = mountAsSeat(0, new Engine([...SETUP_MOVES, "terrans pass booster4"]));

      vm.enterAnalysisMode();

      expect(vm.analysisRolledForward).to.equal(true);
      expect(vm.engine.round).to.equal(2);
      expect(vm.analysisBaseRound).to.equal(2);
      expect(vm.engine.playerToMove).to.equal(0);

      vm.applyAnalysisMove("terrans up nav.");
      expect(vm.analysisEntries).to.have.length(1);
      expect(vm.analysisCommittableMoves).to.deep.equal([]);

      vm.$el.remove();
      vm.$destroy();
    });

    it("keeps planning usable after next-round income when the opponent has manual income enabled", async () => {
      const engine = new Engine([
        "init 2 Gaudy-plow-4506",
        "p1 faction itars",
        "p2 faction ivits",
        "itars build m 3B3",
        "itars build m 2B2",
        "ivits build PI 4B3",
        "ivits booster booster3",
        "itars booster booster8",
        "ivits income t",
        "itars pass booster9",
      ]);
      engine.players.forEach((player) => {
        player.settings.autoIncome = false;
        player.settings.autoBrainstone = false;
      });
      const original = JSON.stringify(engine);
      const vm = mountAsSeat(0, Engine.fromData(stripSecret(engine, 0)));
      vm.$store.commit("hosted", true);
      const dispatched = spyDispatch(vm);
      vm.enterAnalysisMode();
      expect(vm.engine.round).to.equal(2);
      expect(vm.engine.phase).to.equal(Phase.RoundIncome);
      expect(vm.engine.playerToMove).to.equal(0);

      vm.applyAnalysisMove("itars income t");
      await Vue.nextTick();

      expect(vm.engine.phase).to.equal(Phase.RoundMove);
      expect(vm.engine.playerToMove).to.equal(0);
      expect(vm.engine.turnOrder).to.deep.equal([0]);
      expect(vm.canPlay).to.equal(true);
      expect(vm.$el.textContent).to.contain("Plan A");
      expect(vm.$el.textContent).to.contain("Clear plan");
      expect(vm.$el.textContent).to.contain("Return to live game");
      vm.applyAnalysisMove("itars up nav.");
      await Vue.nextTick();
      expect(vm.analysisEntries).to.have.length(2);
      expect(vm.analysisCommittableMoves).to.deep.equal(["itars income t", "itars up nav."]);
      expect(vm.analysisCommitPlan.timings).to.deep.equal([
        { round: 2, phase: Phase.RoundIncome },
        { round: 2, phase: Phase.RoundMove },
      ]);
      expect(vm.$el.textContent).to.contain("appropriate round and phase");

      vm.addAnalysisLine();
      await Vue.nextTick();
      expect(vm.$el.textContent).to.contain("Plan B");
      vm.resetAnalysisLine();
      expect(vm.analysisEntries).to.have.length(0);
      vm.exitAnalysisMode();
      expect(vm.engine.moveHistory).to.deep.equal(JSON.parse(original).moveHistory);
      expect(vm.engine.players.map((player) => player.settings)).to.deep.equal(
        JSON.parse(original).players.map((player) => player.settings)
      );
      expect(dispatched.filter((action) => ["move", "submitPlan"].includes(action.type))).to.have.length(0);
      vm.$destroy();
    });

    it("keeps plan controls available after a simulated final pass", async () => {
      const engine = new Engine(SETUP_MOVES);
      engine.round = 6;
      engine.clearAvailableCommands();
      engine.generateAvailableCommands();
      const vm = mountAsSeat(0, engine);
      vm.enterAnalysisMode();
      vm.applyAnalysisMove("terrans pass");
      await Vue.nextTick();

      expect(vm.engine.ended).to.equal(true);
      expect(vm.canPlay).to.equal(false);
      expect(vm.$el.textContent).to.contain("Plan A");
      expect(vm.$el.textContent).to.contain("Clear plan");
      expect(vm.$el.textContent).to.contain("Return to live game");
      expect(vm.$el.querySelectorAll("button.move-button")).to.have.length(0);
      const clear = Array.from(vm.$el.querySelectorAll("button")).find(
        (button: HTMLButtonElement) => button.textContent.trim() === "Clear plan"
      ) as HTMLButtonElement;
      await fireEvent.click(clear);
      expect(vm.engine.ended).to.equal(false);
      expect(vm.canPlay).to.equal(true);
      expect(vm.analysisEntries).to.have.length(0);
      vm.$destroy();
    });

    it("commits nothing off-turn in self-contained play, where there is no queue to put it in", () => {
      // Seat 1 is locked; it is genuinely seat 0's turn. Commit used to dispatch move 1 as a live
      // `move` the real game cannot accept - after exiting the sandbox and clearing the saved line,
      // so the whole line was silently lost.
      const vm = mountAsSeat(1);
      vm.enterAnalysisMode();
      vm.applyAnalysisMove("nevlas up nav.");
      expect(vm.analysisSeatIsOnTurnForReal).to.equal(false);
      expect(vm.analysisCommittableMoves).to.deep.equal([]);

      const dispatched = spyDispatch(vm);
      vm.commitAnalysisLine();

      expect(dispatched).to.deep.equal([]);
      expect(vm.analysisMode, "and the sandbox stays open, line intact").to.equal(true);

      vm.$el.remove();
      vm.$destroy();
    });

    it("never dispatches move, however many turns are composed in the clone", () => {
      const vm = mountAsSeat(0);
      vm.enterAnalysisMode();
      const dispatched = spyDispatch(vm);

      vm.addMove("terrans up nav.");

      expect(dispatched.map((d) => d.type)).to.deep.equal(["analysisMove"]);
      expect(dispatched.some((d) => d.type === "move")).to.equal(false);

      vm.$el.remove();
      vm.$destroy();
    });

    it("persists the line across a fresh mount for the same seat, and keeps different seats separate", () => {
      const first = mountAsSeat(0);
      first.enterAnalysisMode();
      first.applyAnalysisMove("terrans up nav.");
      first.$el.remove();
      first.$destroy();

      const second = mountAsSeat(0);
      second.enterAnalysisMode();
      expect(second.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);
      second.$el.remove();
      second.$destroy();
    });

    describe("real resources and the compact status (§12)", () => {
      it("leaves the seat's real resources alone on entry - nothing is injected any more", () => {
        const vm = mountAsSeat(0);
        const realCredits = vm.engine.players[0].data.credits;

        vm.enterAnalysisMode();

        expect(vm.engine.players[0].data.credits).to.equal(realCredits);
        expect(vm.engine.players[0].data.analysis).to.equal(true);

        vm.$el.remove();
        vm.$destroy();
      });

      it("reports nothing overdrawn and no assumed power for an untouched line", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();

        expect(vm.analysisStatus.overdrawn).to.deep.equal([]);
        expect(vm.analysisStatus.assumedPower).to.equal(0);
        expect(vm.analysisStatus.chargedPower).to.equal(0);

        vm.$el.remove();
        vm.$destroy();
      });

      it("refuses a power action without enough power", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        const before = JSON.stringify(vm.engine.players[0].data.power);
        vm.applyAnalysisMove("terrans action power3.");
        expect(vm.analysisEntries).to.deep.equal([]);
        expect(JSON.stringify(vm.engine.players[0].data.power)).to.equal(before);
        expect(vm.analysisStatus.assumedPower).to.equal(0);
        vm.$el.remove();
        vm.$destroy();
      });

      it("keeps a running total of the Charge 1 presses, which the bowls alone cannot answer for", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();

        vm.chargeAnalysisPower();
        vm.chargeAnalysisPower();
        expect(vm.analysisStatus.chargedPower).to.equal(2);

        vm.undoAnalysisCharge();
        expect(vm.analysisStatus.chargedPower).to.equal(1);

        vm.$el.remove();
        vm.$destroy();
      });

      it("keeps a half-composed turn alive across a Charge 1 press instead of silently dropping it", () => {
        // The reported bug: Charge 1 replays the line from the origin, and a turn in progress is not
        // a line entry - so pressing it after clicking into a build or an action wiped that turn out,
        // and the bowls moved by whatever the turn had spent rather than by the 1 power charged.
        const position = new Engine(SETUP_MOVES);
        position.players[0].data.power.area3 = 4;
        const vm = mountAsSeat(0, position);
        vm.enterAnalysisMode();
        vm.chargeAnalysisPower();

        vm.applyAnalysisMove("terrans action power3"); // no trailing "." - the turn is still open
        expect(vm.currentMove).to.equal("terrans action power3");
        const oresMidTurn = vm.engine.players[0].data.ores;

        vm.chargeAnalysisPower();

        expect(vm.currentMove).to.equal("terrans action power3");
        expect(vm.engine.players[0].data.ores).to.equal(oresMidTurn); // the action is still applied
        // The mid-turn press is held rather than filed ahead of the turn - see the bowl-order test
        // below for why that matters - but it counts towards the header total either way.
        expect(vm.analysisEntries).to.deep.equal([{ kind: "adjust", charge: 1 }]);
        expect(vm.analysisPendingCharge).to.equal(1);
        expect(vm.analysisStatus.chargedPower).to.equal(2);

        vm.undoAnalysisCharge();
        expect(vm.currentMove).to.equal("terrans action power3");
        expect(vm.analysisPendingCharge).to.equal(0);
        expect(vm.analysisEntries).to.deep.equal([{ kind: "adjust", charge: 1 }]);

        vm.$el.remove();
        vm.$destroy();
      });

      it("charges from bowl 1 whenever bowl 1 has tokens, even mid-turn (owner report, 2026-08-20)", () => {
        // Charge 1 used to append its entry to the LINE, which replays before any turn still being
        // composed. A free action is the normal way to be mid-turn here (the button chain is back at
        // the top-level menu, which is the only place the button shows at all), so a player who had
        // just spent 4 power was looking at a refilled bowl 1 while the charge was being applied to
        // the position before that spend - and watched a token go from bowl 2 to bowl 3.
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        // Charge everything up out of bowl 1, so bowl 1 is only refilled by the spend below.
        vm.setAnalysisEntries([{ kind: "adjust", charge: 8 }]);
        expect(vm.engine.players[0].data.power.area1).to.equal(0);

        vm.applyAnalysisMove("terrans spend 4pw for 1q"); // free action - turn still open
        const before = { ...vm.engine.players[0].data.power };
        expect(before.area1).to.be.greaterThan(0);

        vm.chargeAnalysisPower();

        const after = vm.engine.players[0].data.power;
        expect(after.area1).to.equal(before.area1 - 1);
        expect(after.area2).to.equal(before.area2 + 1);
        expect(after.area3).to.equal(before.area3);

        // And once the turn completes, the charge is stored BEHIND the move - the order it was
        // played in, and the order that replays back to exactly what was on screen.
        vm.applyAnalysisMove("terrans spend 4pw for 1q. up nav.");
        expect(vm.analysisEntries).to.deep.equal([
          { kind: "adjust", charge: 8 },
          { kind: "move", move: "terrans spend 4pw for 1q. up nav." },
          { kind: "adjust", charge: 1 },
        ]);
        expect(vm.analysisPendingCharge).to.equal(0);

        vm.$el.remove();
        vm.$destroy();
      });

      it("hides research after spending the last knowledge and restores it on undo while off turn", async () => {
        const position = new Engine(SETUP_MOVES);
        position.players[1].data.knowledge = 4;
        const vm = mountAsSeat(1, position);
        vm.enterAnalysisMode();
        await Vue.nextTick();
        const choices = () =>
          Array.from(vm.$el.querySelectorAll("#move-buttons button")).map((b: any) => b.textContent.trim());
        expect(choices()).to.include("Research");
        vm.applyAnalysisMove("nevlas up nav.");
        await Vue.nextTick();
        expect(vm.engine.players[1].data.knowledge).to.equal(0);
        expect(choices()).not.to.include("Research");
        vm.applyAnalysisMove("nevlas up gaia.");
        expect(vm.analysisEntries).to.have.length(1);
        expect(vm.engine.players[1].data.knowledge).to.equal(0);
        vm.undoLastAnalysisEntry();
        await Vue.nextTick();
        expect(choices()).to.include("Research");
        vm.$el.remove();
        vm.$destroy();
      });

      it("spends real resources, so the board's own numbers move with the line", () => {
        const vm = mountAsSeat(0);
        const realKnowledge = vm.engine.players[0].data.knowledge;
        const realQics = vm.engine.players[0].data.qics;
        vm.enterAnalysisMode();

        // A research upgrade costs a flat 4 knowledge (UPGRADE_RESEARCH_COST); navigation's first
        // level also grants 1 QIC (research-tracks.ts). Both land on the real numbers now, which is
        // what the player board renders - no wallet in between to subtract back out.
        vm.applyAnalysisMove("terrans up nav.");

        expect(vm.engine.players[0].data.knowledge).to.equal(realKnowledge - 4);
        expect(vm.engine.players[0].data.qics).to.equal(realQics + 1);

        vm.$el.remove();
        vm.$destroy();
      });

      it("rejects research when the position has no knowledge", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        // Every replay restarts from analysisOrigin, so that is where a "this seat is broke" setup
        // has to land - mutating vm.engine would be overwritten by the next replay.
        vm.analysisOrigin.players[0].data.knowledge = 0;
        vm.setAnalysisEntries([]);
        vm.applyAnalysisMove("terrans up nav.");
        expect(vm.analysisEntries).to.deep.equal([]);
        expect(vm.engine.players[0].data.knowledge).to.equal(0);
        expect(vm.analysisStatus.overdrawn).to.deep.equal([]);

        vm.$el.remove();
        vm.$destroy();
      });

      it("clears the status on exit, so nothing stale lingers over the real board", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("terrans up nav.");

        vm.exitAnalysisMode();

        expect(vm.analysisStatus).to.equal(null);

        vm.$el.remove();
        vm.$destroy();
      });
    });

    describe("Phase 3 - round flow (§2.5/§2.8/§3.7)", () => {
      it("shrinks turnOrder to just this seat on entry", () => {
        const vm = mountAsSeat(0);

        vm.enterAnalysisMode();

        expect(vm.engine.turnOrder).to.deep.equal([0]);
        expect(vm.engine.passedPlayers).to.deep.equal([]);

        vm.$el.remove();
        vm.$destroy();
      });

      it("never renders another seat's commands from round 1 on, so an unresolved leech cannot strand the player (§12)", () => {
        // The reported bug: building within leech range paused the engine on the opponent's
        // accept/decline prompt, and because analysis mode forces canPlay true, THAT prompt was
        // rendered in place of the player's own commands with no way to continue. Opponent decisions
        // are auto-declined now, but the gate is the backstop: from round 1 on, only this seat's own
        // turn renders anything.
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        expect(vm.canPlay).to.equal(true);

        // The store's engine is markRaw'd, so a direct mutation would not re-evaluate the getter -
        // hand the new state in the way every real update arrives instead.
        const stranded = Engine.fromData(JSON.parse(JSON.stringify(vm.engine)));
        stranded.turnOrder = [0, 1];
        stranded.currentPlayer = 1; // an opponent left on turn, however that happened
        vm.handleData(stranded);

        expect(vm.canPlay).to.equal(false);

        vm.$el.remove();
        vm.$destroy();
      });

      it("still renders every seat's commands during setup, which is what pass-and-play needs (§2.6)", () => {
        const vm = mountAsSeat(0, new Engine(SETUP_MOVES.slice(0, -1))); // still mid-setup
        vm.enterAnalysisMode();

        // Round 0: whoever the clone points at is whose choice the player is making.
        const opponentsTurn = Engine.fromData(JSON.parse(JSON.stringify(vm.engine)));
        opponentsTurn.currentPlayer = 1;
        vm.handleData(opponentsTurn);

        expect(vm.canPlay).to.equal(true);

        vm.$el.remove();
        vm.$destroy();
      });

      it("a solo pass reaches round 2's RoundMove via the engine's real phase transitions, self-sustaining turnOrder", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        const boosterCmd = vm.engine.findAvailableCommand(0, Command.Pass);
        const booster = boosterCmd.data.boosters[0];

        vm.applyAnalysisMove(`terrans pass ${booster}`);

        expect(vm.engine.phase).to.equal(Phase.RoundMove);
        expect(vm.engine.round).to.equal(2);
        expect(vm.engine.turnOrder).to.deep.equal([0]);
        expect(vm.canPlay).to.equal(true);

        vm.$el.remove();
        vm.$destroy();
      });

      it("allows planning through multiple round boundaries", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        expect(vm.engine.availableCommands.some((c) => c.name === Command.Pass)).to.equal(true);
        const booster = vm.engine.findAvailableCommand(0, Command.Pass).data.boosters[0];

        vm.applyAnalysisMove(`terrans pass ${booster}`); // round 1 -> round 2, the one bonus round

        expect(vm.engine.availableCommands.some((c) => c.name === Command.Pass)).to.equal(true);
        const nextBooster = vm.engine.findAvailableCommand(0, Command.Pass).data.boosters[0];
        vm.applyAnalysisMove(`terrans pass ${nextBooster}`);
        expect(vm.engine.round).to.equal(3);
        expect(vm.canPlay).to.equal(true);

        vm.$el.remove();
        vm.$destroy();
      });

      it("auto-resolves an opponent's leech offer triggered by the analysis player's own move (§2.8)", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode(); // the sandbox wallet (§4.1) already covers the trading-station cost

        vm.applyAnalysisMove("terrans build ts -1x2.");

        // Without §2.8's resolution this would still be paused on Phase.RoundLeech with nevlas (1)
        // on turn, waiting for an answer nobody in analysis mode can ever give.
        expect(vm.engine.phase).to.not.equal(Phase.RoundLeech);
        expect(vm.canPlay).to.equal(true);

        vm.$el.remove();
        vm.$destroy();
      });
    });

    describe("Phase 4 - setup-phase play (§2.6/§2.7/decision #7)", () => {
      // Both factions picked; it is genuinely terrans' (this session's own locked seat 0) turn to
      // place the first setup mine next.
      const PARTIAL_SETUP_MOVES = ["init 2 randomSeed", "p1 faction terrans", "p2 faction nevlas"];

      it("is offered during setup, not just round 1+", () => {
        const vm = mountAsSeat(0, new Engine(PARTIAL_SETUP_MOVES));
        expect(vm.engine.round).to.equal(0);
        expect(vm.engine.playerToMove).to.equal(0);
        expect(vm.analysisOffered).to.equal(true);

        vm.$el.remove();
        vm.$destroy();
      });

      it("places the opponents' setup mines for them, so only this seat is ever asked (owner instruction, 2026-08-19)", () => {
        // This used to be decision #7's pass-and-play: the player placed EVERY seat's starting mines
        // by hand, and the opponent's move went into the line as an ordinary entry. The owner's
        // instruction is "no mine placement for other factions" - you pick a faction and place your
        // own - so the opponents' placements are made for them and never touch the line.
        const vm = mountAsSeat(0, new Engine(PARTIAL_SETUP_MOVES));
        vm.enterAnalysisMode();

        vm.applyAnalysisMove("terrans build m -1x2"); // this seat's own first mine

        expect(vm.engine.playerToMove, "control comes straight back to me").to.equal(0);
        expect(vm.engine.players[1].data.occupied.length, "their mines went down on their own").to.be.greaterThan(0);
        expect(vm.analysisEntries.map((e: { move: string }) => e.move)).to.deep.equal(["terrans build m -1x2"]);

        vm.$el.remove();
        vm.$destroy();
      });

      it("carries a setup line through to round 1 with the seat's real resources intact (§12)", () => {
        // terrans still owes their own booster pick - the last setup move before round 1.
        const vm = mountAsSeat(0, new Engine(SETUP_MOVES.slice(0, -1)));
        vm.enterAnalysisMode();
        expect(vm.analysisBaseRound).to.equal(1); // §3.7 - "setup gives you setup plus round 1"

        vm.applyAnalysisMove("terrans booster booster3");

        expect(vm.engine.phase).to.equal(Phase.RoundMove);
        expect(vm.engine.round).to.equal(1);
        // Round 1 income, and nothing else: no wallet is granted at the handover any more, so this
        // is exactly what the same moves produce in a real game.
        const plain = new Engine([...SETUP_MOVES.slice(0, -1), "terrans booster booster3"]);
        expect(vm.engine.players[0].data.credits).to.equal(plain.players[0].data.credits);
        expect(vm.analysisStatus.overdrawn).to.deep.equal([]);

        vm.$el.remove();
        vm.$destroy();
      });

      it("nulls the sealed-bid backend for the duration and restores it on exit (§2.7)", () => {
        const vm = mountAsSeat(0, new Engine(PARTIAL_SETUP_MOVES));
        const backend = { submit: async () => {}, refresh: async () => {} };
        vm.$store.commit("setSealedBidBackend", backend);

        vm.enterAnalysisMode();
        expect(vm.$store.state.sealedBidBackend).to.equal(null);
        expect(vm.$store.state.analysisMode).to.equal(true);

        vm.exitAnalysisMode();
        expect(vm.$store.state.sealedBidBackend).to.equal(backend);
        expect(vm.$store.state.analysisMode).to.equal(false);

        vm.$el.remove();
        vm.$destroy();
      });
    });

    describe("Phase 5 - visual treatment (§5)", () => {
      it("adds analysis-mode-active to the root classes only while active, scoping the dimmed map stripes (§5.2/§2.10)", () => {
        const vm = mountAsSeat(0);
        expect(vm.classes).to.not.include("analysis-mode-active");

        vm.enterAnalysisMode();
        expect(vm.classes).to.include("analysis-mode-active");

        vm.exitAnalysisMode();
        expect(vm.classes).to.not.include("analysis-mode-active");

        vm.$el.remove();
        vm.$destroy();
      });
    });

    // §13's line strip. Everything below is about the strip staying an honest description of what is
    // stored and what is on the board - a tab that says one thing while the board shows another is
    // strictly worse than no strip at all, since the whole point is to compare without switching.
    describe("§13 - several lines at once", () => {
      it("opens with exactly one line, already active, with no Save step", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();

        expect(vm.analysisLines).to.deep.equal([[]]);
        expect(vm.analysisActiveLine).to.equal(0);

        vm.$el.remove();
        vm.$destroy();
      });

      it("keeps each line's moves separate and puts the opened one on the board", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("terrans up nav.");
        expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);

        // `+` forks: the new line opens carrying what the old one had, so the shared prefix does not
        // have to be re-clicked (and cannot be mis-clicked) to compare two continuations of it.
        vm.addAnalysisLine();
        expect(vm.analysisActiveLine).to.equal(1);
        expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);

        vm.resetAnalysisLine(); // ...and Reset is still the one press that blanks it
        expect(vm.analysisEntries).to.deep.equal([]);
        vm.applyAnalysisMove("terrans up gaia.");
        expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up gaia." }]);

        // ...and Line 1 is untouched throughout, and comes back exactly as it was left.
        vm.selectAnalysisLine(0);
        expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);
        expect(vm.analysisLines).to.deep.equal([
          [{ kind: "move", move: "terrans up nav." }],
          [{ kind: "move", move: "terrans up gaia." }],
        ]);

        vm.$el.remove();
        vm.$destroy();
      });

      it("undo and reset act on the open line only", () => {
        const vm = mountAsSeat(0, researchGame());
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("terrans up nav.");
        vm.addAnalysisLine(); // forks, so Line 2 starts as [up nav]
        vm.applyAnalysisMove("terrans up gaia.");
        expect(vm.analysisEntries.length).to.equal(2);

        vm.undoLastAnalysisEntry();
        expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);
        expect(vm.analysisLines[0]).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);

        vm.resetAnalysisLine();
        expect(vm.analysisLines[1]).to.deep.equal([]);
        expect(vm.analysisLines[0]).to.deep.equal([{ kind: "move", move: "terrans up nav." }]); // untouched

        vm.$el.remove();
        vm.$destroy();
      });

      // The fork must not share entry objects with the line it came from.
      it("forks a copy, not a second reference to the same line", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("terrans up nav.");
        vm.addAnalysisLine();

        expect(vm.analysisLines[0]).to.deep.equal(vm.analysisLines[1]);
        expect(vm.analysisLines[0]).to.not.equal(vm.analysisLines[1]);
        expect(vm.analysisLines[0][0]).to.not.equal(vm.analysisLines[1][0]);

        vm.$el.remove();
        vm.$destroy();
      });

      it("carries every line, and which one was open, across leaving and re-entering", () => {
        const first = mountAsSeat(0);
        first.enterAnalysisMode();
        first.applyAnalysisMove("terrans up nav.");
        first.addAnalysisLine();
        first.resetAnalysisLine();
        first.applyAnalysisMove("terrans up gaia.");
        first.exitAnalysisMode();
        first.$el.remove();
        first.$destroy();

        const second = mountAsSeat(0);
        second.enterAnalysisMode();
        expect(second.analysisLines).to.deep.equal([
          [{ kind: "move", move: "terrans up nav." }],
          [{ kind: "move", move: "terrans up gaia." }],
        ]);
        expect(second.analysisActiveLine).to.equal(1);
        expect(second.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up gaia." }]);

        second.$el.remove();
        second.$destroy();
      });

      it("stops adding lines at the cap", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        for (let i = 0; i < MAX_ANALYSIS_LINES + 3; i++) {
          vm.addAnalysisLine();
        }
        expect(vm.analysisLines.length).to.equal(MAX_ANALYSIS_LINES);

        vm.$el.remove();
        vm.$destroy();
      });

      it("closes a line without shifting a different one onto the board", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("terrans up nav.");
        vm.addAnalysisLine();
        vm.resetAnalysisLine();
        vm.applyAnalysisMove("terrans up gaia.");

        // Closing Line 1 while Line 2 is open: the open line must stay the one the player is looking
        // at, which means the active index has to follow it down rather than stay put.
        vm.closeAnalysisLine(0);
        expect(vm.analysisLines).to.deep.equal([[{ kind: "move", move: "terrans up gaia." }]]);
        expect(vm.analysisActiveLine).to.equal(0);
        expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up gaia." }]);

        // ...and the last line is never closable - the strip always has an open tab.
        vm.closeAnalysisLine(0);
        expect(vm.analysisLines.length).to.equal(1);

        vm.$el.remove();
        vm.$destroy();
      });

      it("gives every tab its own outcome, so comparing needs no switching", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("terrans up nav.");
        vm.addAnalysisLine();

        vm.resetAnalysisLine(); // blank the fork, so the two tabs describe different lines

        const summaries = vm.analysisLineSummaries;
        expect(summaries.length).to.equal(2);
        expect(summaries[0].moves).to.equal(1);
        expect(summaries[1].moves).to.equal(0);
        // Line 1's figure is still readable while Line 2 is the one on the board.
        expect(vm.analysisActiveLine).to.equal(1);

        vm.$el.remove();
        vm.$destroy();
      });

      it("submitting keeps every variation until its moves actually execute", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("terrans up nav.");
        vm.addAnalysisLine();
        vm.resetAnalysisLine();
        vm.applyAnalysisMove("terrans up gaia.");
        vm.selectAnalysisLine(0);
        spyDispatch(vm);

        vm.commitAnalysisLine();

        const reopened = mountAsSeat(0);
        reopened.enterAnalysisMode();
        expect(reopened.analysisLines).to.deep.equal([
          [{ kind: "move", move: "terrans up nav." }],
          [{ kind: "move", move: "terrans up gaia." }],
        ]);

        reopened.$el.remove();
        reopened.$destroy();
        vm.$el.remove();
        vm.$destroy();
      });
    });

    describe("Phase 6 - staleness on re-entry (§3.5)", () => {
      it("restores a stored line silently, with no notice, when nothing changed since it was saved", () => {
        const first = mountAsSeat(0);
        first.enterAnalysisMode();
        first.applyAnalysisMove("terrans up nav.");
        first.$el.remove();
        first.$destroy();

        const second = mountAsSeat(0); // same base engine/moveHistory as `first` - baseMoveCount unchanged
        second.enterAnalysisMode();

        expect(second.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);
        expect(second.analysisNotice).to.equal(null);
        expect(second.analysisPendingRestore).to.equal(null);

        second.$el.remove();
        second.$destroy();
      });

      it("auto-replays a stored line and shows a notice when only opponents moved since it was saved", () => {
        const first = mountAsSeat(0);
        first.enterAnalysisMode();
        first.applyAnalysisMove("terrans up nav.");
        const savedBaseMoveCount = first.analysisBaseMoveCount;
        first.$el.remove();
        first.$destroy();

        // A real opponent (nevlas, seat 1) move landed on the live game since the line was saved -
        // pushed directly onto moveHistory rather than actually played, since resolveAnalysisStaleness
        // only ever reads the move strings' leading tokens, never re-executes them.
        const liveEngine = new Engine(SETUP_MOVES);
        liveEngine.moveHistory.push("nevlas up nav (0 ⇒ 1).");
        expect(liveEngine.moveHistory.length).to.be.greaterThan(savedBaseMoveCount);

        const second = mountAsSeat(0, liveEngine);
        second.enterAnalysisMode();

        expect(second.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);
        expect(second.analysisPendingRestore).to.equal(null);
        expect(second.analysisNotice).to.contain("board changed");

        second.$el.remove();
        second.$destroy();
      });

      it("automatically trims matching manual moves after reloading every variation", () => {
        const first = mountAsSeat(0, researchGame());
        first.enterAnalysisMode();
        first.applyAnalysisMove("terrans up nav.");
        first.applyAnalysisMove("terrans up nav.");
        first.addAnalysisLine();
        first.undoLastAnalysisEntry();
        first.applyAnalysisMove("terrans up gaia.");
        first.addAnalysisLine();
        first.resetAnalysisLine();
        first.applyAnalysisMove("terrans build m 2A3.");
        first.$el.remove();
        first.$destroy();

        const live = bgsMove(JSON.parse(JSON.stringify(researchGame())), "terrans up nav.", 0);
        const second = mountAsSeat(0, live);
        second.enterAnalysisMode();
        expect(second.analysisPendingRestore).to.equal(null);
        expect(second.analysisLines).to.deep.equal([
          [{ kind: "move", move: "terrans up nav." }],
          [{ kind: "move", move: "terrans up gaia." }],
          [{ kind: "move", move: "terrans build m 2A3." }],
        ]);
        second.exitAnalysisMode();
        second.enterAnalysisMode();
        expect(second.analysisLines[0]).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);
        second.$el.remove();
        second.$destroy();
      });

      it("preserves plans across an unanswered rollback recovery prompt", () => {
        const first = mountAsSeat(0, new Engine([...SETUP_MOVES, "terrans build m 5A2."]));
        first.enterAnalysisMode();
        first.applyAnalysisMove("terrans up nav.");
        first.$el.remove();
        first.$destroy();
        for (let attempt = 0; attempt < 2; attempt++) {
          const vm = mountAsSeat(0, new Engine(SETUP_MOVES));
          vm.enterAnalysisMode();
          expect(vm.analysisPendingRestore).to.not.equal(null);
          expect(window.localStorage.getItem("analysis-mode::0")).to.contain("terrans up nav.");
          vm.exitAnalysisMode();
          vm.$el.remove();
          vm.$destroy();
        }
      });

      it("stays open through a refetch that carries no new move, even when the origin auto-played opponents", () => {
        // The other half of the same root cause as the re-anchor gate: the no-op-refetch guard read
        // `analysisOrigin.moveHistory`, which settleAnalysisClone/advancePastOwnPass have already
        // grown past the real history. A plain refetch then looked like a new move and force-closed
        // the sandbox - the "minimize/reopen closes sandbox mode" bug, in every game where anything
        // had to be auto-played (a leech pause, or this seat having passed).
        const vm = mountAsSeat(0, new Engine([...SETUP_MOVES, "terrans pass booster5"]));
        vm.enterAnalysisMode();
        expect(vm.analysisOrigin.moveHistory.length).to.be.greaterThan(vm.analysisBaseMoveCount);
        vm.applyAnalysisMove("terrans up nav.");

        // The same real state arriving again - nobody moved.
        vm.$store.dispatch("externalData", JSON.parse(JSON.stringify(vm.analysisBackup)));

        expect(vm.analysisMode).to.equal(true);
        expect(vm.analysisNotice).to.equal(null);
        expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);
        vm.$el.remove();
        vm.$destroy();
      });

      it("discardPendingAnalysisLine clears the prompt and starts fresh instead of restoring", () => {
        const first = mountAsSeat(0, new Engine([...SETUP_MOVES, "terrans build m 5A2."]));
        first.enterAnalysisMode();
        first.applyAnalysisMove("terrans up nav.");
        first.$el.remove();
        first.$destroy();

        const liveEngine = new Engine(SETUP_MOVES);

        const second = mountAsSeat(0, liveEngine);
        second.enterAnalysisMode();
        expect(second.analysisPendingRestore).to.not.equal(null);

        second.discardPendingAnalysisLine();

        expect(second.analysisPendingRestore).to.equal(null);
        expect(second.analysisEntries).to.deep.equal([]);
        // Discard is now what actually deletes it - the prompt no longer wipes storage up front, so
        // without this the discarded line would be offered again on the next entry.
        expect(window.localStorage.getItem("analysis-mode::0")).to.not.contain("terrans up nav.");

        second.$el.remove();
        second.$destroy();
      });

      it("keeps a stored plan when the live game advances several rounds", () => {
        const first = mountAsSeat(0);
        first.enterAnalysisMode();
        first.applyAnalysisMove("terrans up nav.");
        first.$el.remove();
        first.$destroy();

        const liveEngine = new Engine(SETUP_MOVES);
        liveEngine.moveHistory.push("nevlas up nav (0 ⇒ 1).");
        liveEngine.round = 3; // baseRound was 1, so round > baseRound + 1 - the window has moved on

        const second = mountAsSeat(0, liveEngine);
        second.enterAnalysisMode();

        expect(second.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);
        expect(second.analysisPendingRestore).to.equal(null);
        expect(second.analysisNotice).to.contain("board changed");

        second.$el.remove();
        second.$destroy();
      });

      it("setAnalysisEntries trims analysisEntries down to the prefix that actually replayed", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();

        const applied = vm.setAnalysisEntries([
          { kind: "move", move: "terrans up nav." },
          { kind: "move", move: "terrans build m 99x99." }, // illegal - no such hex
        ]);

        expect(applied).to.equal(1);
        expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);

        vm.$el.remove();
        vm.$destroy();
      });

      it("dismissAnalysisNotice clears a shown notice", () => {
        const vm = mountAsSeat(0);
        vm.analysisNotice = "something happened";

        vm.dismissAnalysisNotice();

        expect(vm.analysisNotice).to.equal(null);
        vm.$el.remove();
        vm.$destroy();
      });

      it("trims a matching manual move without closing planning, and persists the remainder", () => {
        const vm = mountAsSeat(0, researchGame());
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("terrans up nav.");
        vm.applyAnalysisMove("terrans up gaia.");
        const arrived = bgsMove(JSON.parse(JSON.stringify(vm.analysisBackup)), "terrans up nav.", 0);
        vm.$store.dispatch("externalData", arrived);
        expect(vm.analysisMode).to.equal(true);
        expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up gaia." }]);
        vm.$el.remove();
        vm.$destroy();
        const second = mountAsSeat(0, Engine.fromData(JSON.parse(JSON.stringify(arrived))));
        second.enterAnalysisMode();
        expect(second.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up gaia." }]);
        second.$el.remove();
        second.$destroy();
      });

      it("keeps the sandbox OPEN and re-bases the line when an opponent moves - their turn does not invalidate it", () => {
        // The reported bug: any incoming move closed sandbox mode, so a line was treated as dead
        // because somebody built on the far side of the map.
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("terrans up nav.");
        const baseBefore = vm.analysisBaseMoveCount;

        const arrived = JSON.parse(JSON.stringify(vm.analysisBackup));
        arrived.moveHistory = [...arrived.moveHistory, "nevlas up nav."];
        vm.$store.dispatch("externalData", arrived);

        expect(vm.analysisMode).to.equal(true);
        expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);
        // Re-anchored onto the new history, so the stored line is not stale next time either.
        expect(vm.analysisBaseMoveCount).to.equal(baseBefore + 1);
        expect(vm.analysisNotice).to.contain("plans were updated");
        // Exiting now restores the NEW real board, not the one from before the opponent moved.
        vm.exitAnalysisMode();
        expect(vm.engine.moveHistory.length).to.equal(arrived.moveHistory.length);

        vm.$el.remove();
        vm.$destroy();
      });

      it("truncates and says so when an opponent's move genuinely does invalidate part of the line", () => {
        // Seat 1 (nevlas) analyses taking a board action while seat 0 is on turn; seat 0 then takes
        // that very action for real. Board actions are single-use, so the line really is dead.
        const position = new Engine(SETUP_MOVES);
        position.players[1].data.power.area3 = 4;
        const vm = mountAsSeat(1, position);
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("nevlas action power3.");
        expect(vm.analysisEntries).to.have.length(1);

        const real = Engine.fromData(JSON.parse(JSON.stringify(position)));
        real.players[0].data.power.area3 = 8; // enough for terrans to actually afford it
        real.clearAvailableCommands();
        real.generateAvailableCommands();
        real.move("terrans action power3.");
        real.generateAvailableCommandsIfNeeded();

        vm.$store.dispatch("externalData", JSON.parse(JSON.stringify(real)));

        expect(vm.analysisMode).to.equal(true); // still in the sandbox - just with less line
        expect(vm.analysisAppliedEntries).to.deep.equal([]); // nothing of it is on the board
        expect(vm.analysisNotice).to.contain("no longer apply");
        // ...but the entry itself is NOT deleted: the strip flags the line (applied < moves) and the
        // player decides. Silently destroying it was the old behaviour, and it had no undo.
        expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "nevlas action power3." }]);
        expect(vm.analysisLineSummaries[0].moves).to.equal(1);
        expect(vm.analysisLineSummaries[0].applied).to.equal(0);

        // Undo is what drops a tail that no longer applies - one press, and only when asked.
        vm.undoLastAnalysisEntry();
        expect(vm.analysisEntries).to.deep.equal([]);

        vm.$el.remove();
        vm.$destroy();
      });

      it("restores the REST of a line the player then played for real, instead of nothing at all", () => {
        // The reported bug: follow your sandbox line at the table, come back, press Restore anyway,
        // and get "0 moves restored" - because the replay starts at entry 1, which is exactly the
        // move that has just been played and can never be played twice.
        const first = mountAsSeat(0);
        first.enterAnalysisMode();
        first.applyAnalysisMove("terrans build m 2A3.");
        first.applyAnalysisMove("terrans up nav.");
        expect(first.analysisEntries).to.have.length(2);
        first.$el.remove();
        first.$destroy();

        // The real game now contains the line's first move, played for real.
        const second = mountAsSeat(0, new Engine([...SETUP_MOVES, "terrans build m 2A3."]));
        second.enterAnalysisMode();
        expect(second.analysisPendingRestore).to.equal(null);

        expect(second.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);
        expect(second.analysisNotice).to.contain("already played");
        second.$el.remove();
        second.$destroy();
      });

      it("leaves a line the player did NOT play alone - nothing is dropped without a real move behind it", () => {
        const first = mountAsSeat(0);
        first.enterAnalysisMode();
        first.applyAnalysisMove("terrans build m 2A3.");
        first.$el.remove();
        first.$destroy();

        // This seat played something else entirely; the line's own first move is still ahead of them.
        const second = mountAsSeat(0, new Engine([...SETUP_MOVES, "terrans build m 5A2."]));
        second.enterAnalysisMode();
        second.restoreAnalysisLine();

        expect(second.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans build m 2A3." }]);
        expect(second.analysisNotice).to.contain("board changed");
        second.$el.remove();
        second.$destroy();
      });

      it("keeps re-anchoring after an opponent's move even when the sandbox had to auto-play opponents at entry", () => {
        // The clone's own moveHistory grows whenever settleAnalysisClone/advancePastOwnPass play an
        // opponent's decline, booster or pass through engine.move(). Comparing THAT against the
        // incoming real history made the two disagree at entry, so every later opponent turn
        // force-closed the sandbox - in exactly the states an async game sits in most of the time.
        const vm = mountAsSeat(0, new Engine([...SETUP_MOVES, "terrans pass booster5"]));
        vm.enterAnalysisMode();
        expect(vm.analysisRolledForward).to.equal(true);
        expect(vm.analysisOrigin.moveHistory.length).to.be.greaterThan(vm.analysisBaseMoveCount);

        const arrived = JSON.parse(JSON.stringify(vm.analysisBackup));
        arrived.moveHistory = [...arrived.moveHistory, "nevlas up nav."];
        vm.$store.dispatch("externalData", arrived);

        expect(vm.analysisMode).to.equal(true);
        expect(vm.analysisBaseMoveCount).to.equal(arrived.moveHistory.length);
        vm.$el.remove();
        vm.$destroy();
      });

      it("keeps planning open when the incoming state advances several rounds", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("terrans up nav.");

        const arrived = JSON.parse(JSON.stringify(vm.analysisBackup));
        arrived.moveHistory = [...arrived.moveHistory, "nevlas up nav."];
        arrived.round = 3; // baseRound was 1 - no amount of re-basing brings that window back
        vm.$store.dispatch("externalData", arrived);

        expect(vm.analysisMode).to.equal(true);
        vm.$el.remove();
        vm.$destroy();
      });

      it("still force-exits when the incoming history diverged instead of growing", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("terrans up nav.");

        const arrived = JSON.parse(JSON.stringify(vm.analysisBackup));
        arrived.moveHistory = [...arrived.moveHistory.slice(0, -1), "nevlas up terra.", "nevlas up nav."];
        vm.$store.dispatch("externalData", arrived);

        expect(vm.analysisMode).to.equal(false);
        vm.$el.remove();
        vm.$destroy();
      });

      it("leaves the sandbox open when the same state is refetched (a reconnect, not a move)", () => {
        // Minimizing the tab and reopening it dispatches externalData with the SAME real state,
        // which used to force-close the sandbox as if somebody had moved.
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("terrans up nav.");

        vm.$store.dispatch("externalData", JSON.parse(JSON.stringify(vm.analysisBackup)));

        expect(vm.analysisMode).to.equal(true);
        expect(vm.analysisNotice).to.equal(null);
        expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);
        vm.$el.remove();
        vm.$destroy();
      });
    });

    // §4.4's manual "assume I leech N power" stepper is gone from the UI (§12): the engine now tops
    // up a power cost the seat cannot cover and reports it as assumed power, which answers the same
    // question without a control. `adjust` entries still replay, so any line saved before this
    // still loads - covered in analysis.spec.ts.
    describe("Phase 7 - the commit path (§6, decision #13)", () => {
      it("commits move 1 live only in self-contained/hot-seat play, never queuing anything", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("terrans up nav.");
        const dispatched = spyDispatch(vm);

        vm.commitAnalysisLine();

        expect(dispatched).to.deep.equal([{ type: "move", payload: "terrans up nav." }]);
        expect(vm.analysisMode).to.equal(false);

        vm.$el.remove();
        vm.$destroy();
      });

      it("keeps the persisted plan while waiting for the submitted move", () => {
        const first = mountAsSeat(0);
        first.enterAnalysisMode();
        first.applyAnalysisMove("terrans up nav.");
        first.commitAnalysisLine();
        first.$el.remove();
        first.$destroy();

        const second = mountAsSeat(0);
        second.enterAnalysisMode();
        expect(second.analysisEntries).to.deep.equal([{ kind: "move", move: "terrans up nav." }]);
        second.$el.remove();
        second.$destroy();
      });

      it("does nothing when nothing in the line is committable", () => {
        const vm = mountAsSeat(0);
        vm.enterAnalysisMode();
        const dispatched = spyDispatch(vm);

        vm.commitAnalysisLine();

        expect(dispatched).to.deep.equal([]);
        expect(vm.analysisMode).to.equal(true); // never exited - there was nothing to commit

        vm.$el.remove();
        vm.$destroy();
      });

      it("keeps variations on queue acknowledgement and trims them after execution while planning stays open", async () => {
        const vm = mountAsSeat(1, researchGame());
        vm.$store.commit("hosted", true);
        const real = vm.engine;
        real.automation = { version: 1, plans: {}, increments: [0, 0], turns: [0, 0], liveUpdate: false };
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("nevlas up nav.");
        vm.addAnalysisLine();
        vm.applyAnalysisMove("nevlas up gaia.");
        vm.selectAnalysisLine(0);
        const dispatched = spyDispatch(vm);
        vm.commitAnalysisLine();
        expect(dispatched[0].payload.moves).to.deep.equal(["nevlas up nav."]);
        vm.$store.commit("submittingPlan", dispatched[0].payload);
        const saved = bgsMove(JSON.parse(JSON.stringify(real)), dispatched[0].payload, 1);
        await vm.$store.dispatch("externalData", stripSecret(saved, 1));
        expect(vm.analysisMode).to.equal(false);
        vm.enterAnalysisMode();
        expect(vm.analysisLines.map((line) => line.length)).to.deep.equal([1, 2]);
        vm.selectAnalysisLine(1);
        const executed = bgsMove(saved, "terrans build ts -1x2.", 0);
        await vm.$store.dispatch("externalData", stripSecret(executed, 1));
        expect(vm.analysisMode).to.equal(true);
        expect(vm.analysisLines).to.deep.equal([[], [{ kind: "move", move: "nevlas up gaia." }]]);
        expect(vm.myPremovePlan.moves).to.deep.equal([]);
        // An unchanged refresh must never consume the remaining plan twice.
        await vm.$store.dispatch("externalData", stripSecret(executed, 1));
        expect(vm.analysisEntries).to.deep.equal([{ kind: "move", move: "nevlas up gaia." }]);
        vm.$el.remove();
        vm.$destroy();
      });

      it("keeps the sandbox and a partial turn open across this seat's automatic leech", async () => {
        const real = new Engine(SETUP_MOVES);
        const vm = mountAsSeat(1, real);
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("nevlas build ts -1x0");
        const draft = vm.currentMove;
        expect(draft).not.to.equal("");
        const incoming = bgsMove(JSON.parse(JSON.stringify(real)), "terrans build ts -1x2.", 0);
        expect(incoming.moveHistory.slice(-1)[0]).to.match(/^nevlas charge/);
        await vm.$store.dispatch("externalData", JSON.parse(JSON.stringify(incoming)));
        expect(vm.analysisMode).to.equal(true);
        expect(vm.currentMove).to.equal(draft);
        vm.$el.remove();
        vm.$destroy();
      });

      it("keeps the live queue cancellable while viewing an earlier turn", async () => {
        const vm = mountAsSeat(1);
        vm.$store.commit("hosted", true);
        const saved = bgsMove(
          JSON.parse(JSON.stringify(vm.engine)),
          { type: "premoves", requestId: "queued", moves: ["nevlas up nav."], revision: 0, turn: 0, round: 1 },
          1
        );
        await vm.$store.dispatch("externalData", stripSecret(saved, 1));
        vm.startReplay();
        vm.replayTo(7);
        const history = [...vm.engine.moveHistory];
        expect(vm.premoveAvailable).to.equal(true);
        expect(vm.myPremovePlan.moves).to.deep.equal(["nevlas up nav."]);
        const dispatched = spyDispatch(vm);
        vm.cancelPremoves();
        vm.$store.commit("submittingPlan", dispatched[0].payload);
        const cancelled = bgsMove(saved, dispatched[0].payload, 1);
        await vm.$store.dispatch("externalData", stripSecret(cancelled, 1));
        expect(vm.myPremovePlan.moves).to.have.length(0);
        expect(vm.engine.moveHistory).to.deep.equal(history);
        await vm.$store.dispatch("replayEnd");
        expect(vm.engine.moveHistory).to.deep.equal(saved.moveHistory);
        expect(vm.myPremovePlan.moves).to.have.length(0);
        vm.$el.remove();
        vm.$destroy();
      });

      it("keeps queued moves inspectable and cancellable inside the sandbox", async () => {
        const vm = mountAsSeat(1);
        vm.$store.commit("hosted", true);
        const saved = bgsMove(
          JSON.parse(JSON.stringify(vm.engine)),
          { type: "premoves", requestId: "queued", moves: ["nevlas up nav."], revision: 0, turn: 0, round: 1 },
          1
        );
        await vm.$store.dispatch("externalData", stripSecret(saved, 1));
        vm.enterAnalysisMode();
        vm.applyAnalysisMove("nevlas up terra.");
        await Vue.nextTick();
        expect(vm.$el.textContent).to.contain("nevlas up nav.");
        const dispatched = spyDispatch(vm);
        vm.cancelPremoves();
        vm.$store.commit("submittingPlan", dispatched[0].payload);
        const cancelled = bgsMove(saved, dispatched[0].payload, 1);
        await vm.$store.dispatch("externalData", stripSecret(cancelled, 1));
        expect(vm.analysisMode).to.equal(true);
        expect(vm.analysisEntries[0].move).to.equal("nevlas up terra.");
        expect(vm.myPremovePlan.moves).to.have.length(0);
        vm.$el.remove();
        vm.$destroy();
      });
    });
  });

  describe("round 0 action placement", () => {
    // `setupActionsAtTop` is the switch that decides whether the pick/ban action area renders under
    // the setup status strip (mobile) or stays in the commands column (desktop) - the two mount
    // points are mutually exclusive on it, so exactly one Commands instance ever exists.
    function setupVm(moves: string[] = []) {
      const engine = new Engine(["init 3 round0-placement", ...moves], { auction: AuctionVariant.Silent });
      engine.generateAvailableCommandsIfNeeded();
      const store = makeStore();
      store.commit("receiveData", engine);
      return new (Vue.extend(Game as any))({ store }) as any;
    }

    it("moves the action area to the top on mobile during round 0", () => {
      const vm = setupVm();
      vm.isDesktopViewport = false;

      expect(vm.engine.phase).to.equal(Phase.SetupFactionBan);
      expect(vm.setupActionsAtTop).to.equal(true);

      vm.$destroy();
    });

    it("leaves the desktop layout alone", () => {
      const vm = setupVm();
      vm.isDesktopViewport = true;

      expect(vm.setupActionsAtTop).to.equal(false);

      vm.$destroy();
    });

    it("stops moving it once round 1 starts, even on mobile", () => {
      const vm = setupVm();
      vm.isDesktopViewport = false;
      vm.engine.round = 1;

      expect(vm.setupActionsAtTop).to.equal(false);

      vm.$destroy();
    });
  });
});
