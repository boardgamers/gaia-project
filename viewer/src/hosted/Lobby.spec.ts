import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { mount } from "@vue/test-utils";
import Lobby from "./Lobby.vue";

Vue.use(BootstrapVue);

describe("Lobby", () => {
  const session = { user: { id: "user-me", email: "me@example.com" } } as any;

  function makeClient(games: any[]) {
    let deleted: string | null = null;
    const client = {
      from: () => ({
        select: () => ({
          order: async () => ({ data: games, error: null }),
        }),
      }),
      rpc: async (name: string, args: any) => {
        if (name === "delete_game") {
          deleted = args.p_game_id;
          return { error: null };
        }
        throw new Error(`unexpected rpc ${name}`);
      },
    };
    return { client, deletedId: () => deleted };
  }

  it("shows a Delete button only for games the signed-in user created", async () => {
    const { client } = makeClient([
      { id: "g-mine", name: "My game", created_by: "user-me", player_count: 2, options: {}, status: "active", current_seat: 0, players: [] },
      { id: "g-theirs", name: "Their game", created_by: "user-other", player_count: 2, options: {}, status: "active", current_seat: 0, players: [] },
    ]);
    const wrapper = mount(Lobby, { propsData: { client, session } });
    await Vue.nextTick();
    await Vue.nextTick();

    const buttons = wrapper.findAll("button").filter((b) => b.text() === "Delete");
    expect(buttons.length).to.equal(1);
  });

  it("calls delete_game and refreshes after confirming deletion", async () => {
    const { client, deletedId } = makeClient([
      { id: "g-mine", name: "My game", created_by: "user-me", player_count: 2, options: {}, status: "active", current_seat: 0, players: [] },
    ]);
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      const wrapper = mount(Lobby, { propsData: { client, session } });
      await Vue.nextTick();
      await Vue.nextTick();

      const button = wrapper.findAll("button").filter((b) => b.text() === "Delete").at(0);
      await button.trigger("click");
      await Vue.nextTick();
      await Vue.nextTick();

      expect(deletedId()).to.equal("g-mine");
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it("does not call delete_game if the confirmation is declined", async () => {
    const { client, deletedId } = makeClient([
      { id: "g-mine", name: "My game", created_by: "user-me", player_count: 2, options: {}, status: "active", current_seat: 0, players: [] },
    ]);
    const originalConfirm = window.confirm;
    window.confirm = () => false;
    try {
      const wrapper = mount(Lobby, { propsData: { client, session } });
      await Vue.nextTick();
      await Vue.nextTick();

      const button = wrapper.findAll("button").filter((b) => b.text() === "Delete").at(0);
      await button.trigger("click");
      await Vue.nextTick();

      expect(deletedId()).to.equal(null);
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it("links to the dedicated create-game screen instead of an inline form", async () => {
    const { client } = makeClient([]);
    const wrapper = mount(Lobby, { propsData: { client, session } });
    await Vue.nextTick();
    await Vue.nextTick();

    const link = wrapper.find('a[href="?create=1"]');
    expect(link.exists()).to.equal(true);
    expect(wrapper.find('input[type="email"]').exists()).to.equal(false);
  });
});
