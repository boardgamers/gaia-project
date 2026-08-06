import Engine, { AuctionVariant, Building, Command, Faction, Phase, Planet, PlayerEnum } from "@gaia-project/engine";
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
    // Both nested boards now start at the same y as each other (and as the outer viewBox), so
    // their own top-anchored content (the research track's level-5 tile, ScoringBoard's index-0
    // FinalScoringTile) renders at the same height - no more of ScoringBoard's own -25 offset that
    // used to shift it, and everything it contains, above the research track's top edge.
    expect(researchBoard.getAttribute("y")).to.equal(null);
    expect(scoringBoard.getAttribute("y")).to.equal(null);

    const [, minY, , height] = svg.getAttribute("viewBox").split(" ").map(Number);
    expect(minY).to.equal(0);
    // ScoringBoard renders at width=90 against its own `viewBox="0 0 80 480"` with no explicit
    // height, so its rendered height auto-scales to preserve aspect ratio: 90 * (480/80) = 540 -
    // the outer viewBox must be at least that tall (starting from y=0) to avoid clipping it.
    expect(height).to.be.at.least(540);

    vm.$el.remove();
    vm.$destroy();
  });

  it("renders Turn Order in a banner at the top of the page (before the map), and gives the Commands column the full row width", () => {
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

    // Turn Order's top-banner placement (PROGRESS.md Gaia 9) no longer depends on whether
    // gameplay has started - unlike the old mobile order-flip it replaced, both engines below
    // should render it identically, at the very top of the page.
    for (const engine of [setupEngine, gameplayEngine]) {
      const store = makeStore();
      const vm = new (Vue.extend(Game as any))({ store }) as any;
      vm.handleData(engine);
      vm.$mount();
      document.body.appendChild(vm.$el);

      const banner = vm.$el.querySelector(".turn-order-banner");
      expect(banner, "expected a top turn-order banner").to.not.equal(null);
      expect(banner.querySelector(".turn-order"), "expected TurnOrder mounted inside the banner").to.not.equal(null);

      // The banner must precede the map/research-board row in document order - "top of the page".
      const mapRow = vm.$el.querySelector(".space-map")?.closest(".row");
      expect(mapRow, "expected the map row").to.not.equal(null);
      expect(banner.compareDocumentPosition(mapRow) & Node.DOCUMENT_POSITION_FOLLOWING).to.not.equal(0);

      // Commands (or the "current player" fallback) no longer shares its row with Turn Order, so
      // the old split-column classes are both gone entirely.
      expect(vm.$el.querySelector(".col-md-4.order-md-1"), "old Turn Order column class should be gone").to.equal(null);
      expect(vm.$el.querySelector(".col-md-8.order-md-2"), "old Commands column class should be gone").to.equal(null);

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
    expect(svg.querySelector(".research-actions-panel")).to.not.equal(null);
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
    // The research board now sits inside its own research/renju swipe drawer (ResearchPanel.vue),
    // which is what precedes the ship row in that column.
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

    // Switching to chess slides a second face through the same responsive box without unmounting
    // the booster/federation source tree. Tile taps leave that face alone; the subtle page dots
    // remain available in both modes.
    const poolSource = poolSidebar.querySelector(".pool-tiles-face");
    await fireEvent.click(poolSource);
    expect(poolSource.getAttribute("aria-hidden")).to.equal(null);
    expect(poolSidebar.querySelector(".pool-chess-overlay")).to.equal(null);

    const chessDot = poolSidebar.querySelector('[data-mode="chess"]');
    expect(chessDot.getAttribute("aria-label")).to.equal("Show shared chess board");
    await fireEvent.click(chessDot);
    expect(poolSource.getAttribute("aria-hidden")).to.equal("true");
    expect(poolSidebar.querySelector(".pool-chess-overlay")).to.not.equal(null);
    expect(poolSidebar.querySelector(".pool-tiles-face")).to.equal(poolSource);
    expect(chessDot.getAttribute("aria-pressed")).to.equal("true");
    await fireEvent.click(poolSidebar.querySelector('[data-mode="pool"]'));
    expect(poolSource.getAttribute("aria-hidden")).to.equal(null);
    expect(poolSidebar.querySelector(".pool-chess-overlay")?.getAttribute("aria-hidden")).to.equal("true");

    // The buttons column still narrows to the map's own width on desktop - now with nothing sharing
    // its row (the ship boards moved above), so the remaining col-md-5 space is simply left blank.
    const commandsCol = vm.$el.querySelector("#move")?.closest(".col-12");
    expect(commandsCol, "expected the buttons wrapper to carry col-12").to.not.equal(null);
    expect(commandsCol.classList.contains("col-md-7")).to.equal(true);

    vm.$el.remove();
    vm.$destroy();
  });

  it("aligns the off-turn auto-leech control with the mobile chat toggle above the premove bar", () => {
    const store = makeStore();
    const vm = new (Vue.extend(Game as any))({ store }) as any;

    expect(vm.offTurnAutoLeechBottomOffset).to.equal(24);
    vm.premoveBarHeight = 86;
    expect(vm.offTurnAutoLeechBottomOffset).to.equal(98);

    vm.$destroy();
  });

  describe("premove (hosted mode)", () => {
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

    function mountAsSeat(seatIndex: number | undefined, engine: Engine = new Engine(SETUP_MOVES)) {
      const store = makeStore();
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

    it("offers the premove sticky bar for a locked seat whose turn it isn't", () => {
      // playerToMove is 0 (terrans); this session is locked to seat 1 (nevlas).
      const vm = mountAsSeat(1);

      expect(vm.premoveOffered).to.equal(true);
      expect(vm.$el.textContent).to.contain("Sequential premove");
      expect(vm.$el.textContent).to.contain("Priority premove");

      vm.$el.remove();
      vm.$destroy();
    });

    it("keeps offering it while the round is paused on someone else's leech decision", () => {
      // The state a live async game actually sits in between turns: terrans upgrading next to
      // nevlas offers 2 power, which costs a VP and parks the game in Phase.RoundLeech until nevlas
      // answers. Seat 0 is off-turn there and used to be shown no premove UI at all.
      const engine = new Engine(SETUP_MOVES);
      engine.players[0].data.credits = 20;
      engine.players[0].data.ores = 20;
      engine.move("terrans build ts -1x2.");
      engine.generateAvailableCommandsIfNeeded();
      expect(engine.phase).to.equal(Phase.RoundLeech);

      const vm = mountAsSeat(0, engine);

      expect(vm.canPlay).to.equal(false);
      expect(vm.premoveOffered).to.equal(true);
      expect(vm.showPremoveBar).to.equal(true);
      expect(vm.$el.textContent).to.contain("Sequential premove");

      // ...and composing from there says so, rather than quietly previewing a board that is still
      // waiting on an answer.
      vm.onStartNewPremove({ mode: "sequential", switchingModes: false });
      expect(vm.premoveComposeCaveat).to.contain("power-charge decision");

      vm.$el.remove();
      vm.$destroy();
    });

    it("hides Commands (canPlay false) for everyone while locked to hosted.ts's pending placeholder seat", () => {
      // playerToMove is 0 (terrans) - a real lock to seat 0 would make canPlay true, but the
      // impossible placeholder index hosted.ts locks to before its real seat lock resolves
      // (see hosted.ts's "close a race" comment) must keep canPlay false regardless of whose turn
      // it actually is, so no viewer sees the active player's in-progress picks during that window.
      const vm = mountAsSeat(-1);

      expect(vm.engine.playerToMove).to.equal(0);
      expect(vm.canPlay).to.equal(false);
      // Regression check: myLockedSeat must reject the out-of-range placeholder rather than pass
      // it through - premoveOffered calls into the engine with it and previously threw.
      expect(vm.myLockedSeat).to.equal(undefined);
      expect(() => vm.premoveOffered).to.not.throw();
      expect(vm.premoveOffered).to.equal(false);

      vm.$el.remove();
      vm.$destroy();
    });

    it("does not offer a premove for the seat currently on turn", () => {
      const vm = mountAsSeat(0);

      expect(vm.premoveOffered).to.equal(false);

      vm.$el.remove();
      vm.$destroy();
    });

    it("does not offer a premove with no seat lock (spectator or hot-seat test game)", () => {
      const vm = mountAsSeat(undefined);

      expect(vm.premoveOffered).to.equal(false);
      expect(vm.$el.textContent).to.not.contain("Sequential premove");

      vm.$el.remove();
      vm.$destroy();
    });

    it("onStartNewPremove swaps into a preview clone where it's the locked seat's turn, and cancelPremoveMode restores the real state", () => {
      const vm = mountAsSeat(1);

      vm.onStartNewPremove({ mode: "sequential", switchingModes: false });

      expect(vm.premoveMode).to.equal(true);
      expect(vm.premoveEditSeq).to.equal(null);
      expect(vm.canPlay).to.equal(true);
      expect(vm.engine.playerToMove).to.equal(1);

      vm.cancelPremoveMode();

      expect(vm.premoveMode).to.equal(false);
      expect(vm.engine.playerToMove).to.equal(0);

      vm.$el.remove();
      vm.$destroy();
    });

    it("composing a full turn via premoveMove enables Queue this move, and queuing dispatches it with the locked seat", () => {
      const vm = mountAsSeat(1);
      vm.onStartNewPremove({ mode: "sequential", switchingModes: false });

      const dispatched: any[] = [];
      const originalDispatch = vm.$store.dispatch.bind(vm.$store);
      vm.$store.dispatch = (type: string, payload: unknown) => {
        dispatched.push({ type, payload });
        return originalDispatch(type, payload);
      };

      expect(vm.premoveReady).to.equal(false);
      // A research track upgrade completes the turn in one command (no further prompts).
      vm.applyPremoveMove("nevlas up terra.");
      expect(vm.premoveReady).to.equal(true);

      vm.queueCurrentPremove();

      expect(dispatched).to.deep.equal([
        { type: "queuePremove", payload: { seat: 1, move: "nevlas up terra.", mode: "sequential" } },
      ]);
      expect(vm.premoveMode).to.equal(false);

      vm.$el.remove();
      vm.$destroy();
    });

    it("editing a queued premove stages the change: cancelPremoveMode before confirming leaves the original queue untouched", () => {
      const vm = mountAsSeat(1);
      vm.$store.commit("premoveState", {
        premoves: [{ seat: 1, seq: 1, move: "nevlas up terra.", mode: "sequential", queued_move_count: 0 }],
        failures: [],
      });

      vm.startEditPremove(1);

      expect(vm.premoveMode).to.equal(true);
      expect(vm.premoveEditSeq).to.equal(1);

      const dispatched: any[] = [];
      const originalDispatch = vm.$store.dispatch.bind(vm.$store);
      vm.$store.dispatch = (type: string, payload: unknown) => {
        dispatched.push({ type, payload });
        return originalDispatch(type, payload);
      };

      // Backing out without confirming must not touch the backend at all.
      vm.cancelPremoveMode();

      expect(dispatched).to.deep.equal([]);
      expect(vm.premoveMode).to.equal(false);
      expect(vm.premoveEditSeq).to.equal(null);

      vm.$el.remove();
      vm.$destroy();
    });

    it("confirming an edit dispatches editPremove (not queuePremove) with the original seq", () => {
      const vm = mountAsSeat(1);
      vm.$store.commit("premoveState", {
        premoves: [{ seat: 1, seq: 1, move: "nevlas up terra.", mode: "sequential", queued_move_count: 0 }],
        failures: [],
      });
      vm.startEditPremove(1);

      const dispatched: any[] = [];
      const originalDispatch = vm.$store.dispatch.bind(vm.$store);
      vm.$store.dispatch = (type: string, payload: unknown) => {
        dispatched.push({ type, payload });
        return originalDispatch(type, payload);
      };

      vm.applyPremoveMove("nevlas up nav.");
      vm.queueCurrentPremove();

      expect(dispatched).to.deep.equal([{ type: "editPremove", payload: { seat: 1, seq: 1, move: "nevlas up nav." } }]);

      vm.$el.remove();
      vm.$destroy();
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
