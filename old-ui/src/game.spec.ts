import Engine from "@gaia-project/engine";
import betaFixture from "@gaia-project/engine/fixtures/Beta-2.json";
import { move, stripSecret } from "@gaia-project/engine/wrapper";
import { loadScenarioEngine, selfContainedScenarios } from "../../viewer/src/self-contained-scenarios";
import launch from "./launcher";

const federationFixture = () => {
  const data = JSON.parse(JSON.stringify(betaFixture));
  expect(data.map.some((hex: any) => hex.data?.federations?.length)).toBe(true);
  return data;
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
      const historySelector = '[aria-label="Premoves stopped at move 3 — view history"]';
      await vi.waitFor(() => expect(viewer.app.$el.querySelector(historySelector)).not.toBeNull());
      expect(document.querySelector(".premove-queue")).toBeNull();
      (viewer.app.$el.querySelector(historySelector) as HTMLButtonElement).click();
      await vi.waitFor(() => expect(document.querySelector(".premove-queue")?.textContent).toContain("Stopped at 3"));
      const review = [...document.querySelectorAll("button")].find(
        (button) => button.textContent.trim() === "Review remaining"
      ) as HTMLButtonElement;
      review.click();
      await vi.waitFor(() => expect(viewer.app.$el.querySelectorAll(".analysis-moves__past").length).toBe(2));
      expect(viewer.app.$el.querySelector('[aria-label="Edit move 3: nevlas up eco."]')).not.toBeNull();
      expect(viewer.app.$el.textContent).toContain("2 played · 2 left");
      await vi.waitFor(() => expect(document.querySelector(".premove-queue")).toBeNull());
    } finally {
      viewer.app.$destroy();
      document.body.replaceChildren();
    }
  });

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
