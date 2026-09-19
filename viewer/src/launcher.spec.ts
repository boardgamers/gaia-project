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
});
