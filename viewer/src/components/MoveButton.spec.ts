import { shallowMount } from "@vue/test-utils";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { ButtonData } from "../data";
import { makeStore } from "../store";
import MoveButton from "./MoveButton.vue";

Vue.use(BootstrapVue);

// Owner-reported 2026-08-12: typing a letter into the in-game chat opened a faction sheet, "as if
// the click went behind the keyboard and the chat window and hit a faction button". No click was
// involved - MoveButton listens for its shortcut letters on `window`, and during setup every faction
// button is auto-assigned the first letter of its name ("a" for Ambas, ...), so the composer's
// keystrokes were being read as move shortcuts.
describe("MoveButton keyboard shortcuts", () => {
  const mountButton = () => {
    const clicked: ButtonData[] = [];
    const button: ButtonData = { label: "Ambas", command: "choose-faction ambas", shortcuts: ["a"] };
    const controller = {
      handleButtonClick: (b: ButtonData) => clicked.push(b),
      isActiveButton: () => false,
    };
    const wrapper = shallowMount(MoveButton, {
      store: makeStore(),
      propsData: { button, controller },
    });
    return { clicked, wrapper };
  };

  const press = (key: string, target: EventTarget) => {
    const event = new KeyboardEvent("keydown", { key, bubbles: true });
    target.dispatchEvent(event);
  };

  it("fires on a keystroke aimed at the page", () => {
    const { clicked, wrapper } = mountButton();

    press("a", document.body);

    expect(clicked).to.have.length(1);
    wrapper.destroy();
  });

  it("ignores a keystroke typed into a text field", () => {
    const { clicked, wrapper } = mountButton();
    const composer = document.createElement("textarea");
    document.body.appendChild(composer);

    press("a", composer);

    expect(clicked).to.be.empty;
    composer.remove();
    wrapper.destroy();
  });

  it("ignores Enter typed into a text field", () => {
    const { clicked, wrapper } = mountButton();
    const composer = document.createElement("textarea");
    document.body.appendChild(composer);

    press("Enter", composer);

    expect(clicked).to.be.empty;
    composer.remove();
    wrapper.destroy();
  });
});
