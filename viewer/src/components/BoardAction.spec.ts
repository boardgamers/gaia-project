import { BoardAction as BoardActionEnum, PlayerEnum } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import BoardAction from "./BoardAction.vue";

describe("BoardAction", () => {
  it("should render as faded when given legacy data", async () => {
    const action = BoardActionEnum.Power1;
    const store = makeStore();
    // fixme why is this needed
    delete (store as any).getters;
    store.state.gaiaViewer.data.boardActions[action] = PlayerEnum.Player5;
    const { container } = render(BoardAction, {
      props: {
        action,
      },
      store,
    });

    expect(container.querySelector(".faded")).to.not.be.null;
  });

  it("should not render as faded when player is null", async () => {
    const action = BoardActionEnum.Power1;
    const store = makeStore();
    // fixme why is this needed
    delete (store as any).getters;
    store.state.gaiaViewer.data.boardActions[action] = null;
    const { container } = render(BoardAction, {
      props: {
        action,
      },
      store,
    });

    expect(container.querySelector(".faded")).to.be.null;
  });
});