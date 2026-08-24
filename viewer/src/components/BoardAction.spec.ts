import { BoardAction as BoardActionEnum, PlayerEnum } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import BoardAction from "./BoardAction.vue";

function makeTestStore() {
  const store = makeStore();
  (store as any).getters = {
    recentCommands: [],
    currentRoundCommands: [],
    recentHexes: new Set(),
    currentRoundHexes: new Set(),
    recentOpponentBoardActions: new Set(),
  };
  return store;
}

describe("BoardAction", () => {
  it("should render as faded when given legacy data", async () => {
    const action = BoardActionEnum.Power1;
    const store = makeTestStore();
    store.state.data.boardActions[action] = PlayerEnum.Player5;
    const { container } = render(BoardAction, {
      props: {
        action,
      },
      store,
    });

    expect(container.querySelector(".faded")).to.not.be.null;
  });

  it("outlines an action an opponent took since the viewer's last turn", async () => {
    const action = BoardActionEnum.Power3;
    const store = makeTestStore();
    (store as any).getters.recentOpponentBoardActions = new Set([action]);
    const { container } = render(BoardAction, {
      props: {
        action,
      },
      store,
    });

    expect(container.querySelector("g.boardAction.recent")).to.not.be.null;
    expect(container.querySelector("g.specialAction.recent > polygon")).to.not.be.null;
  });

  it("leaves an untouched action unoutlined", async () => {
    const store = makeTestStore();
    (store as any).getters.recentOpponentBoardActions = new Set([BoardActionEnum.Power3]);
    const { container } = render(BoardAction, {
      props: {
        action: BoardActionEnum.Power4,
      },
      store,
    });

    expect(container.querySelector("g.specialAction.recent")).to.be.null;
  });

  it("should not render as faded when player is null", async () => {
    const action = BoardActionEnum.Power1;
    const store = makeTestStore();
    store.state.data.boardActions[action] = null;
    const { container } = render(BoardAction, {
      props: {
        action,
      },
      store,
    });

    expect(container.querySelector(".faded")).to.be.null;
  });
});
