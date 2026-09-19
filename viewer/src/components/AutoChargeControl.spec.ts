import Engine, { PlayerEnum } from "@gaia-project/engine";
import { fireEvent, render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import AutoChargeControl from "./AutoChargeControl.vue";
Vue.use(BootstrapVue);

describe("AutoChargeControl", () => {
  it("displays server settings and requests changes without overwriting local preferences", async () => {
    const store = makeStore();
    store.commit("hosted", true);
    store.commit("preferences", { autoChargePower: "1" });
    store.commit("playerSettings", { autoCharge: "3" });
    let update: unknown;
    store.subscribeAction(({ type, payload }) => {
      if (type === "updatePlayerSetting") update = payload;
    });
    const control = render(AutoChargeControl, { store });
    expect(control.container.textContent).to.contain("Charge: 3");
    await fireEvent.click(control.getByText("Auto-charge: up to 4 power"));
    expect(update).to.deep.equal({ name: "autoCharge", value: "4" });
    expect(store.state.preferences.autoChargePower).to.equal("1");
    expect(control.container.textContent).to.contain("Charge: 3");
    store.commit("playerSettings", { autoCharge: "4" });
    await Vue.nextTick();
    expect(control.container.textContent).to.contain("Charge: 4");
  });

  it("offers the passed cap for the viewing seat outside its turn", async () => {
    const store = makeStore();
    const engine = new Engine(["init 2 auto-charge-control"]);
    engine.currentPlayer = PlayerEnum.Player1;
    engine.passedPlayers = [PlayerEnum.Player2];
    store.commit("receiveData", engine);
    store.commit("hosted", true);
    store.commit("player", { index: PlayerEnum.Player2 });
    store.commit("playerSettings", { autoCharge: "4", autoChargeMaxPassedRoundLeech: "3" });
    const control = render(AutoChargeControl, { store });
    expect(control.container.textContent).to.contain("Charge: 4 cap 3");
    expect(control.queryByText("After passing: max 5 total power")).to.not.equal(null);
    expect(control.queryByText("After passing: max 6 total power")).to.equal(null);
  });

  it("keeps standalone auto-charge working locally", async () => {
    const store = makeStore();
    const control = render(AutoChargeControl, { store });
    await fireEvent.click(control.getByText("Auto-charge: up to 2 power"));
    expect(store.state.preferences.autoChargePower).to.equal("2");
  });
});
