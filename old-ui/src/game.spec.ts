import Engine from "@gaia-project/engine";
import Vue from "vue";
import { loadScenarioEngine, selfContainedScenarios } from "../../viewer/src/self-contained-scenarios";
import launch from "./launcher";

describe("old UI on the current engine", () => {
  beforeAll(() => {
    const Observer = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    };
    vi.stubGlobal("IntersectionObserver", Observer);
    vi.stubGlobal("ResizeObserver", Observer);
  });
  afterAll(() => vi.unstubAllGlobals());
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
        viewer.emit("chat:state", { canSend: true });
        viewer.emit("chat:messages", [{ author: "Teammate", text: "Ready to explore" }]);
        await Vue.nextTick();
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
        expect(document.querySelector(".bgs-game-chat")?.textContent).toContain("Ready to explore");
      } finally {
        viewer.app.$destroy();
        document.body.replaceChildren();
      }
    });
  }
});
