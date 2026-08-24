import Engine, { PlayerEnum } from "@gaia-project/engine";
import { mount } from "@vue/test-utils";
import { expect } from "chai";
import { makeStore } from "../store";
import CancelTriggerPicker from "./CancelTriggerPicker.vue";

const SETUP_MOVES = [
  "init 2 randomSeed",
  "p1 faction terrans",
  "p2 faction nevlas",
  "terrans build m -1x2",
  "nevlas build m -1x0",
];

/**
 * The picker reads exactly three things off the engine - each player's faction, `playerToMove` and
 * `passedPlayers` - so these tests set the last two directly rather than driving a real game into
 * the shape being tested. That keeps them about the mapping that actually regressed (which engine
 * state produces which badge) instead of about which hex is buildable under a given seed.
 */
function mountPicker(seat: number, state: { onTurn?: number; passed?: number[] } = {}) {
  const engine = new Engine(SETUP_MOVES);
  if (state.onTurn !== undefined) {
    engine.currentPlayer = state.onTurn as PlayerEnum;
    engine.tempCurrentPlayer = undefined;
  }
  engine.passedPlayers = (state.passed ?? []) as PlayerEnum[];
  const store = makeStore();
  store.commit("receiveData", engine);
  return mount(CancelTriggerPicker, { propsData: { seat }, store });
}

describe("CancelTriggerPicker", () => {
  /**
   * The regression this component was rewritten for. `passed` used to be derived from
   * `previewAvailableCommandsFor(seat) === null`, which is also null when it is that seat's turn -
   * so the opponent the game was currently waiting on rendered as a DISABLED chip labelled
   * "passed". That is the opponent you are most likely to want to watch (you are sitting off-turn
   * precisely because they are thinking), and it was the only one you could not pick.
   */
  it("marks the opponent who is on turn as 'on turn', not 'passed', and keeps them pickable", async () => {
    const wrapper = mountPicker(0, { onTurn: 1 });

    try {
      const chips = wrapper.findAll(".cancel-trigger-picker__chip");
      // One opponent chip plus the "⚡ I gain power" condition chip.
      expect(chips).to.have.length(2);

      const opponent = chips.at(0);
      expect(opponent.text()).to.contain("Nevlas");
      expect(opponent.text()).to.contain("on turn");
      expect(opponent.text()).to.not.contain("passed");
      expect(opponent.attributes("disabled")).to.equal(undefined);

      await opponent.trigger("click");
      expect(wrapper.emitted("pick-opponent")).to.deep.equal([[1]]);
    } finally {
      wrapper.destroy();
    }
  });

  it("marks a genuinely passed opponent as 'passed', and still lets them be picked", async () => {
    const wrapper = mountPicker(0, { onTurn: 0, passed: [1] });

    try {
      const opponent = wrapper.findAll(".cancel-trigger-picker__chip").at(0);
      expect(opponent.text()).to.contain("passed");
      // Pickable on purpose: a rule armed now is still live next round, and so is the queue it
      // guards.
      expect(opponent.attributes("disabled")).to.equal(undefined);

      await opponent.trigger("click");
      expect(wrapper.emitted("pick-opponent")).to.deep.equal([[1]]);
    } finally {
      wrapper.destroy();
    }
  });

  it("leaves an opponent who is neither on turn nor passed unbadged", () => {
    const wrapper = mountPicker(0, { onTurn: 0 });

    try {
      const opponent = wrapper.findAll(".cancel-trigger-picker__chip").at(0);
      expect(opponent.text()).to.contain("Nevlas");
      expect(opponent.text()).to.not.contain("on turn");
      expect(opponent.text()).to.not.contain("passed");
    } finally {
      wrapper.destroy();
    }
  });
});
