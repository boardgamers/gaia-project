import { mount } from "@vue/test-utils";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import PremoveBar from "./PremoveBar.vue";

Vue.use(BootstrapVue);

describe("PremoveBar", () => {
  it("clears zoom compensation after a pinch leaves only a tiny scale residue", () => {
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");
    const listeners: Record<string, Array<() => void>> = {};
    const viewport = {
      scale: 2,
      offsetLeft: 10,
      offsetTop: 40,
      height: 420,
      addEventListener(type: string, listener: () => void) {
        (listeners[type] ?? (listeners[type] = [])).push(listener);
      },
      removeEventListener(type: string, listener: () => void) {
        listeners[type] = (listeners[type] ?? []).filter((candidate) => candidate !== listener);
      },
    };

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });

    const wrapper = mount(PremoveBar, {
      propsData: {
        seat: 0,
        composeModePreference: "sequential",
        stickyMobile: true,
      },
      store: makeStore(),
    });

    try {
      const bar = wrapper.element as HTMLElement;
      expect(bar.style.transform, "a genuine zoom should be compensated").to.not.equal("");

      // Recreate the state that caused the intermittent bug: the pinch has ended, but the browser
      // reports a scale infinitesimally different from 1 while an ordinary scroll changes the
      // visual viewport's top/height. The bar must remove its transform and return to native fixed
      // positioning instead of translating up into the middle of the screen.
      viewport.scale = 1.0000000002;
      viewport.offsetLeft = 0;
      viewport.offsetTop = 90;
      viewport.height = 600;
      for (const listener of listeners.scroll ?? []) {
        listener();
      }

      expect(bar.style.transform).to.equal("");
    } finally {
      wrapper.destroy();
      if (originalVisualViewport) {
        Object.defineProperty(window, "visualViewport", originalVisualViewport);
      } else {
        delete (window as any).visualViewport;
      }
    }
  });
});
