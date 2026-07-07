import Engine from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import HostedBar from "./HostedBar.vue";

describe("HostedBar", () => {
  it("renders Turn Order alongside an always-visible status badge for an ongoing game", () => {
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
    const badge = getByText(/to move/);
    expect(badge.className).to.contain("hosted-bar__turn-pill");
  });

  it("does not show 'Your turn' when the session is merely locked to one of its seats while another seat is active", () => {
    const engine = new Engine(["init 2 hosted-bar-not-my-turn", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    engine.turnOrder = engine.players.map((pl) => pl.player);
    const store = makeStore();
    store.commit("receiveData", engine);
    store.commit("player", { index: 1 });

    const { getByText, queryByText } = render(HostedBar, { props: { finished: false }, store });

    expect(queryByText("Your turn")).to.equal(null);
    expect(getByText(/Player 1 to move/)).to.not.equal(null);
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
