import { expect } from "chai";
import { mount, createLocalVue } from "@vue/test-utils";
import Vuex from "vuex";
import LostFleetNotes from "./LostFleetNotes.vue";
import type { NotesBackend } from "../store";

const localVue = createLocalVue();
localVue.use(Vuex);

// A minimal store exposing just the `notesBackend` slot LostFleetNotes reads, so these tests don't
// need the whole gaia viewer store.
function storeWith(notesBackend: NotesBackend | null) {
  return new Vuex.Store({ state: { notesBackend } });
}

// Let the immediate `backend` watcher's async load() settle.
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("LostFleetNotes", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders a yellow sticky with a cursive 'notes' label and a focusable textarea", () => {
    const wrapper = mount(LostFleetNotes as any, { localVue, store: storeWith(null) });
    expect(wrapper.find(".lost-fleet-notes").exists()).to.equal(true);
    expect(wrapper.find(".lost-fleet-notes__label").text()).to.equal("notes");
    expect(wrapper.find(".lost-fleet-notes__area").exists()).to.equal(true);
  });

  it("uses only the height left by the pool instead of imposing its textarea height on the ship row", () => {
    const wrapper = mount(LostFleetNotes as any, { localVue, store: storeWith(null) });
    expect(wrapper.attributes("data-height-policy")).to.equal("remaining");
  });

  it("loads the note body from the injected backend when one is present", async () => {
    const backend: NotesBackend = {
      load: async () => "remember to build a mine",
      save: async () => undefined,
    };
    const wrapper = mount(LostFleetNotes as any, { localVue, store: storeWith(backend) });
    await flush();
    expect((wrapper.find(".lost-fleet-notes__area").element as HTMLTextAreaElement).value).to.equal(
      "remember to build a mine"
    );
  });

  it("saves through the backend after an edit", async () => {
    const saved: string[] = [];
    const backend: NotesBackend = {
      load: async () => "",
      save: async (body) => {
        saved.push(body);
      },
    };
    const wrapper = mount(LostFleetNotes as any, { localVue, store: storeWith(backend) });
    await flush();
    await wrapper.find(".lost-fleet-notes__area").setValue("block the asteroid");
    // Flush the debounce by saving directly (the timer duration itself is not under test).
    await (wrapper.vm as any).save();
    expect(saved).to.deep.equal(["block the asteroid"]);
  });

  it("falls back to localStorage when there is no backend (self-contained play)", async () => {
    const wrapper = mount(LostFleetNotes as any, { localVue, store: storeWith(null) });
    await wrapper.find(".lost-fleet-notes__area").setValue("local only note");
    await (wrapper.vm as any).save();
    const key = Object.keys(window.localStorage).find((k) => k.startsWith("lost-fleet-notes:")) ?? "";
    expect(key, "expected a lost-fleet-notes localStorage key").to.not.equal("");
    expect(window.localStorage.getItem(key)).to.equal("local only note");
  });

  it("does not let typed keystrokes bubble out to the viewer's global shortcut listeners", async () => {
    const wrapper = mount(LostFleetNotes as any, { localVue, store: storeWith(null), attachTo: document.body });
    let bubbled = false;
    const onWindowKeydown = () => {
      bubbled = true;
    };
    window.addEventListener("keydown", onWindowKeydown);
    await wrapper.find(".lost-fleet-notes__area").trigger("keydown", { key: "a" });
    window.removeEventListener("keydown", onWindowKeydown);
    wrapper.destroy();
    expect(bubbled).to.equal(false);
  });
});
