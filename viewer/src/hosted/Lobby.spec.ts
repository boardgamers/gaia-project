import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { mount } from "@vue/test-utils";
import Lobby from "./Lobby.vue";

Vue.use(BootstrapVue);

describe("Lobby", () => {
  const adminSession = { user: { id: "user-admin", email: "kim.pham.nguyen2@gmail.com" } } as any;
  const otherSession = { user: { id: "user-other", email: "someone-else@example.com" } } as any;

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

  const sampleGames = [
    { id: "g-mine", name: "My game", created_by: "user-admin", player_count: 2, options: {}, status: "active", current_seat: 0, players: [] },
    { id: "g-theirs", name: "Their game", created_by: "user-other", player_count: 2, options: {}, status: "active", current_seat: 0, players: [] },
  ];

  it("shows a Delete button on every game for the admin, regardless of who created it", async () => {
    const { client } = makeClient(sampleGames);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    const buttons = wrapper.findAll("button").filter((b) => b.text() === "Delete");
    expect(buttons.length).to.equal(2);
  });

  it("shows no Delete button at all for a non-admin, even for a game they created", async () => {
    const { client } = makeClient([
      { id: "g-own", name: "My game", created_by: "user-other", player_count: 2, options: {}, status: "active", current_seat: 0, players: [] },
    ]);
    const wrapper = mount(Lobby, { propsData: { client, session: otherSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    const buttons = wrapper.findAll("button").filter((b) => b.text() === "Delete");
    expect(buttons.length).to.equal(0);
  });

  it("calls delete_game and refreshes after the admin confirms deletion", async () => {
    const { client, deletedId } = makeClient([sampleGames[1]]);
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
      await Vue.nextTick();
      await Vue.nextTick();

      const button = wrapper.findAll("button").filter((b) => b.text() === "Delete").at(0);
      await button.trigger("click");
      await Vue.nextTick();
      await Vue.nextTick();

      expect(deletedId()).to.equal("g-theirs");
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it("does not call delete_game if the confirmation is declined", async () => {
    const { client, deletedId } = makeClient([sampleGames[0]]);
    const originalConfirm = window.confirm;
    window.confirm = () => false;
    try {
      const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
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

  it("links the admin to the dedicated create-game screen instead of an inline form", async () => {
    const { client } = makeClient([]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    const link = wrapper.find('a[href="?create=1"]');
    expect(link.exists()).to.equal(true);
    expect(wrapper.find('input[type="email"]').exists()).to.equal(false);
  });

  it("shows round, per-player faction/score, and highlights whoever's turn it is", async () => {
    const game = {
      id: "g-active",
      name: "Friends game",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 1,
      current_round: 3,
      players: [
        { seat: 0, invited_email: "alice@example.com", user_id: "user-admin", display_name: "Alice", faction: "terrans", score: 24 },
        { seat: 1, invited_email: "bob@example.com", user_id: "user-other", display_name: "Bob", faction: "nevlas", score: 31 },
      ],
    };
    const { client } = makeClient([game]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.text()).to.contain("R3");
    const players = wrapper.findAll(".game-bar__player");
    expect(players.length).to.equal(2);
    expect(players.at(0).text()).to.contain("24");
    expect(players.at(1).text()).to.contain("31");
    expect(players.at(0).classes()).to.not.contain("game-bar__player--active");
    expect(players.at(1).classes()).to.contain("game-bar__player--active");
  });

  it("shows no round badge or player chips for a game with no cached lobby data yet", async () => {
    const { client } = makeClient(sampleGames);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.find(".game-bar__round").exists()).to.equal(false);
    expect(wrapper.find(".game-bar__player").exists()).to.equal(false);
  });

  it("shows the New game link for a non-admin too", async () => {
    const { client } = makeClient([]);
    const wrapper = mount(Lobby, { propsData: { client, session: otherSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.find('a[href="?create=1"]').exists()).to.equal(true);
  });
});
