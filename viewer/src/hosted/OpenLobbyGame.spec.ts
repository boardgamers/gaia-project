import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { mount } from "@vue/test-utils";
import OpenLobbyGame from "./OpenLobbyGame.vue";

Vue.use(BootstrapVue);

describe("OpenLobbyGame", () => {
  const session = { user: { id: "user-admin", email: "kim.pham.nguyen2@gmail.com" } } as any;

  function makeClient(game: any, nickname = "Admin") {
    let gameRow = game;
    const channel = {
      on: () => channel,
      subscribe: () => channel,
    };
    return {
      from: (table: string) => {
        if (table === "games") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: gameRow, error: null }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { nickname }, error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      channel: () => channel,
      removeChannel: () => undefined,
      rpc: async (name: string, args: any) => {
        if (name === "join_open_game_seat") {
          gameRow = {
            ...gameRow,
            players: gameRow.players.map((player: any) =>
              player.seat === args.p_seat
                ? { ...player, user_id: "user-admin", invited_email: "kim.pham.nguyen2@gmail.com", display_name: "Admin" }
                : player
            ),
          };
          return { data: gameRow, error: null };
        }
        if (name === "leave_open_game_seat") {
          gameRow = {
            ...gameRow,
            players: gameRow.players.map((player: any) =>
              player.seat === args.p_seat ? { ...player, user_id: null, invited_email: "open-seat@lobby.invalid", display_name: "" } : player
            ),
          };
          return { data: gameRow, error: null };
        }
        throw new Error(`unexpected rpc ${name}`);
      },
    };
  }

  it("renders joined names plus a single join action above the full-page setup preview", async () => {
    const client = makeClient({
      id: "g-open",
      name: "Open table",
      player_count: 3,
      status: "open",
      options: {},
      players: [
        { seat: 0, invited_email: "someone@example.com", user_id: "user-other", display_name: "Other" },
        { seat: 1, invited_email: "open-seat@lobby.invalid", user_id: null, display_name: "" },
        { seat: 2, invited_email: "open-seat@lobby.invalid", user_id: null, display_name: "" },
      ],
    });
    const wrapper = mount(OpenLobbyGame, {
      propsData: { client, session, gameId: "g-open" },
      stubs: { OpenGamePreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.text()).to.contain("1/3 joined");
    expect(wrapper.text()).to.contain("Other");
    expect(wrapper.text()).to.contain("Join game");
    expect(wrapper.text()).to.contain("Standard");
    expect(wrapper.findComponent({ name: "OpenGamePreview" }).exists()).to.equal(true);
  });

  it("shows the joiner's nickname immediately on join, never their raw email", async () => {
    const client = makeClient(
      {
        id: "g-open",
        name: "Open table",
        player_count: 2,
        status: "open",
        options: {},
        players: [
          { seat: 0, invited_email: "open-seat@lobby.invalid", user_id: null, display_name: "" },
          { seat: 1, invited_email: "open-seat@lobby.invalid", user_id: null, display_name: "" },
        ],
      },
      "Star Fox"
    );
    const wrapper = mount(OpenLobbyGame, {
      propsData: { client, session, gameId: "g-open" },
      stubs: { OpenGamePreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();
    await Vue.nextTick();

    const joinButton = wrapper.findAll("button").filter((b) => b.text() === "Join game").at(0);
    await joinButton.trigger("click");
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.text()).to.contain("Star Fox");
    expect(wrapper.text()).to.not.contain("kim.pham.nguyen2@gmail.com");
  });
});
