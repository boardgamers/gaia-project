import Engine from "@gaia-project/engine";
import { fireEvent, render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import HostedBar from "./HostedBar.vue";

function mockDesktopViewport(matches: boolean) {
  const previous = window.matchMedia;
  (window as any).matchMedia = (query: string) => ({
    media: query,
    matches,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
  return () => {
    (window as any).matchMedia = previous;
  };
}

describe("HostedBar", () => {
  it("renders Turn Order for an ongoing game without a duplicate turn-status badge", () => {
    const engine = new Engine(["init 2 hosted-bar-turn-order", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    engine.turnOrder = engine.players.map((pl) => pl.player);
    const store = makeStore();
    store.commit("receiveData", engine);
    // gaiaViewer's `state` is a shared object literal, not a factory - makeStore() calls in
    // *other* spec files can leave state.player set from a prior test. Reset explicitly so this
    // test's outcome doesn't depend on suite execution order.
    store.state.player = null;

    const { container, queryByText } = render(HostedBar, { props: { finished: false }, store });

    expect(container.querySelector(".turn-order"), "expected the Turn Order circles to render").to.not.equal(null);
    expect(queryByText("Your turn")).to.equal(null);
    expect(queryByText(/to move/)).to.equal(null);
  });

  it("still shows a 'Game finished' badge instead of Turn Order once the game has ended", () => {
    const engine = new Engine(["init 2 hosted-bar-finished", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { getByText, container } = render(HostedBar, { props: { finished: true }, store });

    expect(getByText("Game finished")).to.not.equal(null);
    expect(container.querySelector(".turn-order"), "Turn Order should not render once finished").to.equal(null);
  });

  it("shows only a bell icon for the notification button, no text label", () => {
    const engine = new Engine(["init 2 hosted-bar-notif", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { queryByText } = render(HostedBar, { props: { finished: false, pushEnabled: false }, store });
    expect(queryByText(/notification/i), "the button text label should be gone, bell-icon only").to.equal(null);
  });

  it("does not show a Credits option - that's a lobby-only settings item", () => {
    const engine = new Engine(["init 2 hosted-bar-no-credits", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { queryByText } = render(HostedBar, { props: { finished: false }, store });

    expect(queryByText("Credits")).to.equal(null);
  });

  it("shows chat/game-menu panel toggles only on desktop, never on mobile", async () => {
    const engine = new Engine(["init 2 hosted-bar-desktop", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const restoreDesktop = mockDesktopViewport(true);
    const desktop = render(HostedBar, {
      props: { finished: false, chatPanelOpen: true, gameNavPanelOpen: false },
      store,
    });
    expect(desktop.queryByText("Hide chat panel")).to.not.equal(null);
    expect(desktop.queryByText("Show game menu panel")).to.not.equal(null);
    desktop.unmount();
    restoreDesktop();

    const restoreMobile = mockDesktopViewport(false);
    const mobile = render(HostedBar, {
      props: { finished: false, chatPanelOpen: true, gameNavPanelOpen: false },
      store,
    });
    expect(mobile.queryByText(/chat panel/)).to.equal(null);
    expect(mobile.queryByText(/game menu panel/)).to.equal(null);
    mobile.unmount();
    restoreMobile();
  });

  it("shows a Live badge under the game name when isLive is true, and hides it otherwise", () => {
    const engine = new Engine(["init 2 hosted-bar-live", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const withLive = render(HostedBar, { props: { finished: false, isLive: true }, store });
    expect(withLive.getByText("Live")).to.not.equal(null);
    withLive.unmount();

    const withoutLive = render(HostedBar, { props: { finished: false, isLive: false }, store });
    expect(withoutLive.queryByText("Live")).to.equal(null);
    withoutLive.unmount();
  });

  it("offers a one-shot pass-and-play conversion, confirms its independence, and reports status", async () => {
    const engine = new Engine(["init 2 hosted-bar-offline-copy", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const previousConfirm = window.confirm;
    const confirmed: string[] = [];
    (window as any).confirm = (message: string) => {
      confirmed.push(message);
      return confirmed.length === 1;
    };

    try {
      const off = render(HostedBar, { props: { finished: false }, store });
      await fireEvent.click(off.getByText("Convert to offline pass-and-play"));
      expect(off.emitted()["convert-to-offline"]).to.have.lengthOf(1);
      await fireEvent.click(off.getByText("Convert to offline pass-and-play"));
      expect(off.emitted()["convert-to-offline"]).to.have.lengthOf(1);
      expect(confirmed).to.have.lengthOf(2);
      expect(confirmed[0]).to.include("Everyone can take their turns on the same device");
      expect(confirmed[0]).to.include("will not stay synchronized");
      off.unmount();

      const status = render(HostedBar, {
        props: { finished: false, offlineCopyStatus: "Pass-and-play copy saved in Offline games." },
        store,
      });
      expect(status.getByText("Convert to offline pass-and-play")).to.not.equal(null);
      expect(status.getByText("Pass-and-play copy saved in Offline games.")).to.not.equal(null);
      status.unmount();
    } finally {
      (window as any).confirm = previousConfirm;
    }
  });

  it("emits toggle-chat-panel and toggle-game-nav-panel when their settings items are clicked", async () => {
    const engine = new Engine(["init 2 hosted-bar-toggle-events", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const restoreDesktop = mockDesktopViewport(true);
    const { getByText, emitted } = render(HostedBar, {
      props: { finished: false, chatPanelOpen: true, gameNavPanelOpen: true },
      store,
    });

    await fireEvent.click(getByText("Hide chat panel"));
    await fireEvent.click(getByText("Hide game menu panel"));

    expect(emitted()["toggle-chat-panel"]).to.have.lengthOf(1);
    expect(emitted()["toggle-game-nav-panel"]).to.have.lengthOf(1);
    restoreDesktop();
  });
});
