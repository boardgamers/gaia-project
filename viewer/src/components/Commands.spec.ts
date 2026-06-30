import Engine, { Command } from "@gaia-project/engine";
import { render, fireEvent } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import Commands from "./Commands.vue";

Vue.use(BootstrapVue);

describe("Commands", () => {
  it("renders Tinkeroids' round-start tinkering choice after Lost Fleet setup", async () => {
    const engine = new Engine(
      [
        "init 2 lf-freeze-check",
        "p1 faction tinkeroids",
        "p2 faction terrans",
        "terrans build m 3A11",
        "terrans build m 4A6",
        "tinkeroids build PI IS1",
        "terrans booster booster1",
        "tinkeroids booster booster2",
      ],
      { lostFleet: true }
    );
    engine.generateAvailableCommandsIfNeeded();

    expect(engine.availableCommands.map((command) => command.name)).to.deep.equal([Command.ChooseTinkeringTile]);

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(Commands, {
      props: { currentMove: "" },
      store,
    });

    const chooser = container.querySelector<HTMLButtonElement>("#move-buttons button.move-button");
    expect(chooser).to.not.equal(null);
    expect(chooser?.textContent).to.contain("Choose Tinkering Tile");

    await fireEvent.click(chooser!);

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("#move-buttons button.move-button")).map(
      (button) => button.textContent?.trim() ?? ""
    );

    expect(buttons).to.include("Terraform 1 Step");
    expect(buttons).to.include("2: Charge 4 Power");
    expect(buttons).to.include("3: Gain 1 QIC");
  });
});
