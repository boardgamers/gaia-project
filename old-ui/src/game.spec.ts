import Engine, { AuctionVariant, Command } from "@gaia-project/engine";
import betaFixture from "@gaia-project/engine/fixtures/Beta-2.json";
import { move, stripSecret } from "@gaia-project/engine/wrapper";
import { loadScenarioEngine, selfContainedScenarios } from "../../viewer/src/self-contained-scenarios";
import launch from "./launcher";

const federationFixture = () => {
  const data = JSON.parse(JSON.stringify(betaFixture));
  expect(data.map.some((hex: any) => hex.data?.federations?.length)).toBe(true);
  return data;
};

const planningEngine = () => {
  const engine = new Engine(
    Engine.parseMoves(`init 2 randomSeed
p1 faction terrans
p2 faction nevlas
terrans build m -1x2
nevlas build m -1x0
nevlas build m 0x-4
terrans build m -4x-1
nevlas booster booster7
terrans booster booster3`)
  );
  engine.players[0].data.knowledge = 12;
  return engine;
};

describe("old UI on the current engine", () => {
  beforeAll(() => {
    const Observer = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    };
    vi.stubGlobal("IntersectionObserver", Observer);
    vi.stubGlobal("ResizeObserver", Observer);
    Object.defineProperty(HTMLElement.prototype, "checkVisibility", { configurable: true, value: () => true });
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    delete HTMLElement.prototype.checkVisibility;
  });
  it.each([true, false])("labels the faction buttons only when banning (ban=%s)", async (ban) => {
    const engine = new Engine(["init 3 ban-label"], ban ? { auction: AuctionVariant.Silent } : {});
    engine.generateAvailableCommandsIfNeeded();
    expect(engine.availableCommands[0].name).toBe(ban ? Command.BanFaction : Command.ChooseFaction);
    const host = document.createElement("div");
    host.id = "old-ban-test";
    document.body.append(host);
    const viewer = launch("#old-ban-test");
    try {
      viewer.emit("player", { index: 0 });
      viewer.emit("state", JSON.parse(JSON.stringify(engine)));
      await vi.waitFor(() => expect(host.querySelector("#move-buttons .faction-picker-buttons")).not.toBeNull());
      const picker = host.querySelector("#move-buttons .faction-picker-buttons")!;
      const prompt = picker.querySelector(".faction-picker-prompt");
      if (ban) {
        expect(prompt?.textContent).toBe("Ban a faction");
        expect(prompt?.nextElementSibling?.querySelector("button.move-button")).not.toBeNull();
        expect(prompt?.closest("#move-title, .sticky-bar-title, .alert")).toBeNull();
      } else {
        expect(prompt).toBeNull();
      }
    } finally {
      viewer.app.$destroy();
      document.body.replaceChildren();
    }
  });

  it("shows stopped premoves and opens their remaining steps with read-only played history", async () => {
    let engine = new Engine(
      Engine.parseMoves(`init 2 randomSeed
p1 faction terrans
p2 faction nevlas
terrans build m -1x2
nevlas build m -1x0
nevlas build m 0x-4
terrans build m -4x-1
nevlas booster booster7
terrans booster booster3`)
    );
    engine.players[1].data.knowledge = 8;
    engine = move(
      JSON.parse(JSON.stringify(engine)),
      {
        type: "premoves",
        requestId: "history",
        moves: ["nevlas up nav.", "nevlas up gaia.", "nevlas up eco.", "nevlas build ts -1x0."],
        round: 1,
        turn: 0,
        revision: 0,
      },
      1
    );
    engine = move(JSON.parse(JSON.stringify(engine)), "terrans build ts -1x2.", 0);
    engine = move(JSON.parse(JSON.stringify(engine)), "terrans pass booster8", 0);
    const host = document.createElement("div");
    host.id = "old-test";
    document.body.append(host);
    const viewer = launch("#old-test");
    try {
      viewer.emit("player", { index: 1 });
      viewer.emit("state", stripSecret(engine, 1));
      // A newly stopped plan opens directly, without a history dialog or a second review click.
      await vi.waitFor(() =>
        expect(viewer.app.$el.querySelector('[aria-label="Dismiss premove stop reason"]')).not.toBeNull()
      );
      expect(document.querySelector(".premove-queue")).toBeNull();
      await vi.waitFor(() => expect(viewer.app.$el.querySelectorAll(".analysis-moves__past").length).toBe(2));
      expect(viewer.app.$el.querySelector('[aria-label="Edit move 3: nevlas up eco."]')).not.toBeNull();
      expect(viewer.app.$el.textContent).toContain("2 played · 2 left");
      await vi.waitFor(() => expect(document.querySelector(".premove-queue")).toBeNull());
      const game = (viewer.app.$el.querySelector(".old-ui-game") as any).__vue__;
      expect(game.stoppedPremoveReview.reason).toBeTruthy();
      (viewer.app.$el.querySelector('[aria-label="Dismiss premove stop reason"]') as HTMLButtonElement).click();
      await vi.waitFor(() => expect(game.stoppedPremoveReview).toBeNull());
      game.exitAnalysisMode();
      await game.$nextTick();
      (
        viewer.app.$el.querySelector('[aria-label="Premoves stopped at move 3 — review plan"]') as HTMLButtonElement
      ).click();
      await vi.waitFor(() => expect(game.stoppedPremoveReview.reason).toBeTruthy());
      expect(document.querySelector(".premove-queue")).toBeNull();
    } finally {
      viewer.app.$destroy();
      document.body.replaceChildren();
    }
  });

  it("inspects plan steps directly in the old UI without losing the list, then opens the explicit pencil", async () => {
    const engine = new Engine(
      Engine.parseMoves(`init 2 randomSeed
p1 faction terrans
p2 faction nevlas
terrans build m -1x2
nevlas build m -1x0
nevlas build m 0x-4
terrans build m -4x-1
nevlas booster booster7
terrans booster booster3`)
    );
    engine.players[0].data.knowledge = 12;
    const host = document.createElement("div");
    host.id = "old-test";
    document.body.append(host);
    const viewer = launch("#old-test");
    try {
      viewer.emit("player", { index: 0 });
      viewer.emit("state", JSON.parse(JSON.stringify(engine)));
      await vi.waitFor(() => expect(viewer.app.$el.querySelector(".old-map-canvas")).not.toBeNull());
      const game = (viewer.app.$el.querySelector(".old-ui-game") as any).__vue__;
      game.enterAnalysisMode();
      game.resetAnalysisLine();
      game.applyAnalysisMove("terrans up nav.");
      game.chargeAnalysisPower();
      game.applyAnalysisMove("terrans up gaia.");
      await game.$nextTick();
      const moves = () => viewer.app.$el.querySelectorAll<HTMLButtonElement>(".analysis-moves__move");
      moves()[0].click();
      await game.$nextTick();
      expect(game.analysisEdit).toEqual({ index: 0, appliedCount: 3, mode: "inspect" });
      expect(game.engine.players[0].data.knowledge).toBe(8);
      expect(game.canPlay).toBe(false);
      expect(moves()).toHaveLength(2);
      moves()[1].click();
      await game.$nextTick();
      expect(game.analysisEdit.index).toBe(2);
      expect(game.engine.players[0].data.knowledge).toBe(4);
      expect(viewer.app.$el.querySelector('[aria-current="step"]')?.textContent).toContain("terrans up gaia.");
      viewer.app.$el.querySelectorAll<HTMLButtonElement>(".analysis-moves__edit")[1].click();
      await game.$nextTick();
      expect(game.analysisEdit).toEqual({ index: 2, appliedCount: 3, mode: "replace" });
      expect(game.engine.players[0].data.knowledge).toBe(8);
      expect(game.canPlay).toBe(true);
      expect(game.analysisEntries).toHaveLength(3);
    } finally {
      viewer.app.$destroy();
      window.localStorage.clear();
      document.body.replaceChildren();
    }
  });

  for (const uiMode of ["graphical", "table"]) {
    it(`keeps hotseat final-pass resources and disables end insertion at earlier steps (${uiMode})`, async () => {
      const engine = planningEngine();
      engine.round = 6;
      engine.clearAvailableCommands();
      engine.generateAvailableCommands();
      const host = document.createElement("div");
      host.id = "old-test";
      document.body.append(host);
      const viewer = launch("#old-test");
      try {
        // No "player" event: this is hotseat, with no locked seat to identify the plan's owner.
        viewer.emit("state", JSON.parse(JSON.stringify(engine)));
        viewer.emit("preferences", { uiMode });
        await vi.waitFor(() => expect(viewer.app.$el.querySelector(".old-ui-game")).not.toBeNull());
        const game = (viewer.app.$el.querySelector(".old-ui-game") as any).__vue__;
        await vi.waitFor(() => expect(game.engine.moveHistory).toEqual(engine.moveHistory));
        await vi.waitFor(() => expect(game.uiMode).toBe(uiMode));
        viewer.store.commit("hosted", false);
        expect(game.myLockedSeat).toBeUndefined();
        game.enterAnalysisMode();
        expect(game.analysisMode).toBe(true);
        game.resetAnalysisLine();
        game.applyAnalysisMove("terrans up nav.");
        game.applyAnalysisMove("terrans pass");
        expect(game.engine.ended).toBe(true);
        expect(game.analysisCanAppend).toBe(false);
        game.inspectAnalysisMove(1);
        await game.$nextTick();
        const resourceBar = viewer.app.$el.querySelector(".sticky-resource-bar") as any;
        expect(resourceBar).not.toBeNull();
        expect(resourceBar.__vue__.player).toBe(game.engine.players[game.analysisSeat]);
        const addAtEnd = () => viewer.app.$el.querySelector<HTMLButtonElement>('[aria-label="Add move at end"]');
        expect(addAtEnd().disabled).toBe(true);
        viewer.app.$el.querySelectorAll<HTMLButtonElement>(".analysis-moves__move")[0].click();
        await game.$nextTick();
        expect(game.analysisEdit).toEqual({ index: 0, appliedCount: 2, mode: "inspect" });
        expect(game.engine.ended).toBe(false);
        expect(game.analysisCanAppend).toBe(false);
        expect(addAtEnd().disabled).toBe(true);
        expect(viewer.app.$el.querySelector(".analysis-strip, #root > [role='alert']")).toBeNull();
      } finally {
        viewer.app.$destroy();
        window.localStorage.clear();
        document.body.replaceChildren();
      }
    });

    it(`keeps rollback restore/discard controls inline without a top alert (${uiMode})`, async () => {
      const engine = planningEngine();
      const entries = [{ kind: "move", move: "terrans up nav." }];
      const saveDivergentPlan = () =>
        window.localStorage.setItem(
          "analysis-mode::0",
          JSON.stringify({ lines: [entries], active: 0, baseMoveCount: engine.moveHistory.length + 1 })
        );
      const host = document.createElement("div");
      host.id = "old-test";
      document.body.append(host);
      const viewer = launch("#old-test");
      try {
        viewer.emit("player", { index: 0 });
        viewer.emit("state", JSON.parse(JSON.stringify(engine)));
        viewer.emit("preferences", { uiMode });
        await vi.waitFor(() => expect(viewer.app.$el.querySelector(".old-ui-game")).not.toBeNull());
        const game = (viewer.app.$el.querySelector(".old-ui-game") as any).__vue__;
        await vi.waitFor(() => expect(game.engine.moveHistory).toEqual(engine.moveHistory));
        await vi.waitFor(() => expect(game.uiMode).toBe(uiMode));
        viewer.store.commit("hosted", false);
        for (const choice of ["Restore anyway", "Discard"]) {
          saveDivergentPlan();
          game.enterAnalysisMode();
          await game.$nextTick();
          expect(game.analysisPendingRestore).not.toBeNull();
          expect(viewer.app.$el.querySelector(".analysis-strip, #root > [role='alert']")).toBeNull();
          const prompt = viewer.app.$el.querySelector("#move .analysis-restore");
          expect(prompt).not.toBeNull();
          const button = [...prompt.querySelectorAll<HTMLButtonElement>("button")].find(
            (button) => button.textContent.trim() === choice
          );
          button.click();
          await game.$nextTick();
          expect(game.analysisPendingRestore).toBeNull();
          expect(viewer.app.$el.querySelector(".analysis-restore")).toBeNull();
          expect(game.analysisEntries).toEqual(choice === "Restore anyway" ? entries : []);
          if (choice === "Restore anyway") {
            expect(viewer.app.$el.querySelector(".analysis-moves__move")?.textContent).toContain("terrans up nav.");
          }
          game.exitAnalysisMode();
          await game.$nextTick();
        }
      } finally {
        viewer.app.$destroy();
        window.localStorage.clear();
        document.body.replaceChildren();
      }
    });
  }

  for (const id of ["base", ...selfContainedScenarios.map((s) => s.id)]) {
    it(`renders the actual old player/map components and current controls for ${id}`, async () => {
      const host = document.createElement("div");
      host.id = "old-test";
      document.body.append(host);
      const viewer = launch("#old-test");
      try {
        const engine =
          id === "base"
            ? new Engine(["init 3 old-test", "p1 faction terrans", "p2 faction nevlas", "p3 faction firaks"])
            : loadScenarioEngine(id);
        viewer.emit("state", JSON.parse(JSON.stringify(engine)));
        viewer.emit("preferences", { platformChat: true });
        viewer.emit("chat:state", { canSend: true });
        viewer.emit("chat:messages", [{ type: "text", author: "Teammate", text: "Ready to explore" }]);
        await vi.waitFor(() => expect(viewer.app.$el.querySelector(".old-map-canvas")).not.toBeNull());
        expect(viewer.app.$el.querySelector(".old-ui-game")).not.toBeNull();
        expect(viewer.app.$el.querySelector(".old-map-canvas")).not.toBeNull();
        expect(viewer.app.$el.querySelector(".old-building")).not.toBeNull();
        expect(viewer.app.$el.querySelectorAll(".player-board").length).toBe(engine.players.length);
        if (engine.options.lostFleet)
          expect(viewer.app.$el.querySelectorAll(".lost-fleet-ship").length).toBe(engine.players.length === 2 ? 3 : 4);
        expect(viewer.app.$el.querySelector(".pool .old-booster")).not.toBeNull();
        expect(viewer.app.$el.querySelector(".pool .booster")).toBeNull();
        expect(viewer.app.$el.querySelector(".old-research-panel .scoringTile")).toBeNull();
        if (engine.options.lostFleet) {
          expect(viewer.app.$el.querySelectorAll(".old-ship-action").length).toBe(
            (engine.players.length === 2 ? 3 : 4) * 3
          );
        }
        const tiles = viewer.app.$el.querySelectorAll(".old-research-panel .old-tech-tile");
        expect(tiles.length).toBeGreaterThanOrEqual(15);
        expect(tiles[0].textContent.trim().length).toBeGreaterThan(3);
        for (const action of viewer.app.$el.querySelectorAll(".old-board-action")) {
          expect(action.getAttribute("transform")).toMatch(/^translate\(/);
        }
        expect(document.querySelector(".bgs-game-chat, .chat-shortcut")).toBeNull();
        const openChat = vi.fn();
        viewer.on("chat:open", openChat);
        const chatButton = document.querySelector<HTMLButtonElement>(".game-chat-button")!;
        expect(chatButton.hidden).toBe(false);
        chatButton.click();
        expect(openChat).toHaveBeenCalledOnce();

        const fedFixture = federationFixture();
        viewer.emit("state", fedFixture);
        await vi.waitFor(() => {
          expect(viewer.app.$el.querySelectorAll("path.federation-path--color").length).toBeGreaterThan(0);
        });
        // No dangling <use> references to the removed global federation defs
        expect(viewer.app.$el.querySelectorAll("use[xlink\\:href^='#federation']").length).toBe(0);
      } finally {
        viewer.app.$destroy();
        document.body.replaceChildren();
      }
    });
  }
});
