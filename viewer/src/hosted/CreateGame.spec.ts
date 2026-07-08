import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { mount } from "@vue/test-utils";
import CreateGame from "./CreateGame.vue";
import SetupPreview from "./SetupPreview.vue";

Vue.use(BootstrapVue);

describe("CreateGame", () => {
  const session = { user: { id: "user-me", email: "kim.pham.nguyen2@gmail.com" } } as any;
  function makeClient() {
    return { rpc: async () => ({ data: null, error: null }) };
  }

  it("offers 2/3/4 player-count buttons instead of a dropdown, and has no name field", async () => {
    const wrapper = mount(CreateGame, {
      propsData: { client: makeClient(), session },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    const buttons = wrapper.findAll("button").filter((b) => ["2", "3", "4"].includes(b.text()));
    expect(buttons.length).to.equal(3);
    expect(wrapper.find("select").exists()).to.equal(false);
    expect(wrapper.find('input[placeholder="Friday fleet night"]').exists()).to.equal(false);
    expect(wrapper.find('input[type="email"]').exists()).to.equal(false);
  });

  it("explains that regular games open in the lobby instead of inviting players directly", async () => {
    const wrapper = mount(CreateGame, {
      propsData: { client: makeClient(), session },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.text()).to.include("Regular games now open in the lobby instead of sending invites.");
    expect(wrapper.text()).to.include("You take seat 1 immediately");
  });

  it("keeps Create disabled until the setup preview reports a valid setup", async () => {
    const wrapper = mount(CreateGame, {
      propsData: { client: makeClient(), session },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    const createButton = wrapper.findAll("button").filter((b) => b.text() === "Create game").at(0);
    expect((createButton.element as HTMLButtonElement).disabled).to.equal(true);

    await wrapper.findComponent(SetupPreview as any).vm.$emit("update", { seed: "s", rotateMove: "p2 rotate", valid: true });
    await Vue.nextTick();

    expect((createButton.element as HTMLButtonElement).disabled).to.equal(false);
  });

  it("shows the same create form for a non-admin too", async () => {
    const otherSession = { user: { id: "user-other", email: "someone-else@example.com" } } as any;
    const wrapper = mount(CreateGame, {
      propsData: { client: makeClient(), session: otherSession },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.text()).to.not.include("Only the admin can create new games.");
    expect(wrapper.find("form").exists()).to.equal(true);
  });
});
