import Engine from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import HostedBar from "./HostedBar.vue";

describe("HostedBar", () => {
  it("renders Turn Order alongside a desktop-only status badge for an ongoing game (PROGRESS.md Gaia 10 follow-up)", () => {
    const engine = new Engine(["init 2 hosted-bar-turn-order", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    engine.turnOrder = engine.players.map((pl) => pl.player);
    const store = makeStore();
    store.commit("receiveData", engine);
    // gaiaViewer's `state` is a shared object literal, not a factory - makeStore() calls in
    // *other* spec files can leave state.player set from a prior test. Reset explicitly so this
    // test's outcome doesn't depend on suite execution order.
    store.state.player = null;

    const { container, getByText } = render(HostedBar, { props: { finished: false }, store });

    expect(container.querySelector(".turn-order"), "expected the Turn Order circles to render").to.not.equal(null);
    // The old "X to move" text is back (Commands.vue's own status line/sticky bar has nowhere to
    // show it once it isn't the local viewer's turn), but only for desktop - d-none hides it below
    // the md breakpoint so it doesn't compete with Commands.vue's mobile sticky bar for space.
    const badge = getByText(/to move/);
    expect(badge.className).to.contain("d-none");
    expect(badge.className).to.contain("d-md-inline-block");
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
});
