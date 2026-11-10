import Engine, { Phase } from "@gaia-project/engine";
import { analysisMove, analysisView, createAnalysis } from "@gaia-project/engine/wrapper";
import { expect } from "chai";
import { afterEach, beforeEach, vi } from "vitest";
import Vue from "vue";
import launch from "./launcher";

describe("launcher's store-to-emitter bridge", () => {
  beforeEach(() => {
    class Observer {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", Observer);
    vi.stubGlobal("ResizeObserver", Observer);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.querySelectorAll(".bgs-game-chat, .chat-shortcut").forEach((element) => element.remove());
  });
  it("exposes manual saved-analysis decisions across seats without entering the solo sandbox", async () => {
    const history = Engine.parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      terrans build m -1x2
      nevlas build m -1x0
      nevlas build m 0x-4
      terrans build m -4x-1
      nevlas booster booster7
      terrans booster booster3
      terrans build ts -1x2.
    `);
    const source = new Engine(history);
    const analysis = createAnalysis(source, { to: history.length, sourceEnded: false });
    const container = document.createElement("div");
    container.id = "launcher-saved-analysis";
    document.body.appendChild(container);
    const item = launch("#launcher-saved-analysis");
    const vm = item.app.$children[0] as any;
    const moves: string[] = [];
    item.on("move", (move) => moves.push(move));
    try {
      item.emit("player", { index: 0 }); // original game's owner, not the charge recipient
      vm.handleData(analysisView(analysis, { player: 0 }).state);
      await Vue.nextTick();
      expect(vm.canPlay).to.equal(false);
      item.emit("preferences", { analysis: true });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(vm.canPlay).to.equal(true);
      expect(vm.analysisMode).to.equal(false);
      expect(vm.analysisOffered).to.equal(false);
      expect(vm.engine.turnOrder).to.deep.equal([0, 1]);

      // BGS selects the active decision seat for BOTH the view/player message and analysisMove.
      // Enabling controls does not grant seat 0 permission to submit seat 1's charge.
      item.emit("player", { index: 1 });
      vm.handleData(analysisView(analysis, { player: 1 }).state);
      item.emit("settings", { autoCharge: "3", autoIncome: true });
      await Vue.nextTick();
      expect(vm.player).to.equal(1);
      expect(vm.turnPlayer.faction).to.equal("nevlas");
      expect(vm.canPlay).to.equal(true);
      expect(moves).to.deep.equal([]);
      vm.handleCommand("nevlas charge 1pw");
      expect(moves).to.deep.equal(["nevlas charge 1pw"]);
      const next = analysisMove(analysis, moves[0], 1);
      expect(next.moveHistory.slice(0, -1)).to.deep.equal(analysis.moveHistory);
      expect(next.moveHistory).to.have.length(analysis.moveHistory.length + 1);
      expect(next.moveHistory[next.moveHistory.length - 1]).to.match(/^nevlas charge 1pw/);
      item.emit("player", { index: next.playerToMove });
      vm.handleData(analysisView(next, { player: next.playerToMove }).state);
      await Vue.nextTick();
      expect(vm.canPlay).to.equal(true);
      expect(vm.player).to.equal(next.playerToMove);
      expect(moves).to.have.length(1); // merely showing the next turn does not play it

      item.emit("player", {});
      expect(vm.canPlay).to.equal(true); // original spectator may also operate an analysis
      vm.replayData = { backup: next, current: next.moveHistory.length };
      expect(vm.canPlay).to.equal(false);
      vm.replayData = null;
      const ended = Engine.fromData(JSON.parse(JSON.stringify(next)));
      ended.phase = Phase.EndGame;
      vm.handleData(ended);
      expect(vm.canPlay).to.equal(false);
      vm.handleData(next);
      item.emit("preferences", { analysis: false });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(vm.canPlay).to.equal(false); // ordinary spectator ownership remains intact
    } finally {
      item.app.$destroy();
      container.remove();
    }
  });

  it("receives canonical settings and sends setting changes through the protocol", () => {
    const container = document.createElement("div");
    container.id = "launcher-settings";
    document.body.appendChild(container);
    const item = launch("#launcher-settings", Vue.extend({ render: (h) => h("div") }));
    item.emit("settings", { autoCharge: "3", autoIncome: true });
    expect(item.store.state.playerSettings).to.deep.equal({ autoCharge: "3", autoIncome: true });
    let received: unknown;
    item.on("update:setting", (update) => {
      received = update;
    });
    item.store.dispatch("updatePlayerSetting", { name: "autoCharge", value: "4" });
    expect(received).to.deep.equal({ name: "autoCharge", value: "4" });
    expect(item.store.state.playerSettings.autoCharge).to.equal("3");
    item.app.$destroy();
    container.remove();
  });

  it("receives and clears optional Supporter seats without adding faction colour overrides", () => {
    const container = document.createElement("div");
    container.id = "launcher-supporters";
    document.body.appendChild(container);
    const item = launch("#launcher-supporters", Vue.extend({ render: (h) => h("div") }));
    const supporterBadge = { url: "https://boardgamers.space/custom-badge.svg", label: "Supporter" };
    item.emit("preferences", {
      bgs: { players: [{ pro: false }, { pro: true }], supporterBadge, playerColors: ["#123456"] },
    });
    expect(item.store.state.supporterBadge).to.deep.equal(supporterBadge);
    expect(item.store.state.supporterSeats).to.deep.equal([false, true]);
    item.emit("preferences", {});
    expect(item.store.state.supporterSeats).to.deep.equal([]);
    expect(item.store.state.supporterBadge).to.equal(null);
    item.app.$destroy();
    container.remove();
  });

  it("sends a premove plan as an ordinary protocol move", () => {
    const container = document.createElement("div");
    container.id = "launcher-premove";
    document.body.appendChild(container);
    const item = launch("#launcher-premove", Vue.extend({ render: (h) => h("div") }));
    const payload = { type: "premoves", moves: ["p1 up nav."], requestId: "test", round: 1, turn: 0, revision: 0 };
    let received: unknown;
    item.on("move", (move) => {
      received = move;
    });
    item.store.dispatch("submitPlan", payload);
    expect(received).to.deep.equal(payload);
    expect(item.store.state.pendingPlan).to.deep.equal(payload);
    item.app.$destroy();
    container.remove();
  });

  it("follows BGS's undo availability and asks BGS to take the last saved move back", () => {
    const container = document.createElement("div");
    container.id = "launcher-undo";
    document.body.appendChild(container);
    const item = launch("#launcher-undo", Vue.extend({ render: (h) => h("div") }));
    expect(item.store.state.undoAvailable).to.equal(false);
    item.emit("undo:available", true);
    expect(item.store.state.undoAvailable).to.equal(true);
    let requests = 0;
    item.on("undo", () => requests++);
    item.store.dispatch("takeBackMove");
    expect(requests).to.equal(1);
    // Back through the turn being composed stays local.
    item.store.dispatch("undo");
    expect(requests).to.equal(1);
    item.emit("undo:available", false);
    expect(item.store.state.undoAvailable).to.equal(false);
    item.app.$destroy();
    container.remove();
  });
});
