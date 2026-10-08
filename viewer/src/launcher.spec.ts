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
