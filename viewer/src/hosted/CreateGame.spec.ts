import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { mount } from "@vue/test-utils";
import CreateGame from "./CreateGame.vue";
import SetupPreview from "./SetupPreview.vue";

Vue.use(BootstrapVue);

describe("CreateGame", () => {
  const session = { user: { id: "user-me", email: "me@example.com" } } as any;
  const registeredUsers = [
    { id: "user-me", email: "me@example.com", display_name: "Me" },
    { id: "user-alice", email: "alice@example.com", display_name: "Alice" },
    { id: "user-bob", email: "bob@example.com", display_name: "Bob" },
    { id: "user-carol", email: "carol@example.com", display_name: "Carol" },
  ];

  function makeClient() {
    const client = {
      rpc: async (name: string) => {
        if (name === "list_registered_users") {
          return { data: registeredUsers, error: null };
        }
        throw new Error(`unexpected rpc ${name}`);
      },
    };
    return client;
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

  it("lists other registered users to invite, excluding the signed-in host", async () => {
    const wrapper = mount(CreateGame, {
      propsData: { client: makeClient(), session },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.text()).to.include("Alice");
    expect(wrapper.text()).to.include("Bob");
    expect(wrapper.text()).to.include("Carol");
    // "Me" only appears as the host, never as an invitable checkbox option
    const checkboxLabels = wrapper.findAll('input[type="checkbox"] + label, .custom-control-label');
    let sawMe = false;
    for (let i = 0; i < checkboxLabels.length; i++) {
      if (checkboxLabels.at(i).text().includes("me@example.com")) {
        sawMe = true;
      }
    }
    expect(sawMe).to.equal(false);
  });

  it("caps invited players at playerCount - 1 (2p game only needs 1 other player)", async () => {
    const wrapper = mount(CreateGame, {
      propsData: { client: makeClient(), session },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    // First checkbox belongs to "Test game"; the rest are invite checkboxes (Alice, Bob, Carol for a 2p game).
    const inviteCheckboxes = checkboxes.wrappers.slice(1);
    await inviteCheckboxes[0].setChecked(true);
    await Vue.nextTick();

    // Alice is now invited (2p game = 1 slot); Bob and Carol should be disabled.
    expect((inviteCheckboxes[1].element as HTMLInputElement).disabled).to.equal(true);
    expect((inviteCheckboxes[2].element as HTMLInputElement).disabled).to.equal(true);
  });

  it("keeps Create disabled until the setup preview locks in a seed", async () => {
    const wrapper = mount(CreateGame, {
      propsData: { client: makeClient(), session },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    const createButton = wrapper.findAll("button").filter((b) => b.text() === "Create game").at(0);
    expect((createButton.element as HTMLButtonElement).disabled).to.equal(true);

    await wrapper.findComponent(SetupPreview as any).vm.$emit("lock-in", { seed: "s", rotateMove: "p2 rotate" });
    await Vue.nextTick();

    // Still disabled: no invited player yet for this 2p (non-test) game.
    expect((createButton.element as HTMLButtonElement).disabled).to.equal(true);

    const inviteCheckboxes = wrapper.findAll('input[type="checkbox"]').wrappers.slice(1);
    await inviteCheckboxes[0].setChecked(true);
    await Vue.nextTick();

    expect((createButton.element as HTMLButtonElement).disabled).to.equal(false);
  });
});
