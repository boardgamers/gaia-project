import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { mount } from "@vue/test-utils";
import GameNavPanel, { loadGameNavOpenPreference, saveGameNavOpenPreference } from "./GameNavPanel.vue";

Vue.use(BootstrapVue);

describe("GameNavPanel", () => {
  const session = { user: { id: "user-me", email: "me@example.com" } } as any;

  function makeClient(games: any[]) {
    let removedChannel: any = null;
    let deletedTestGameId: string | null = null;
    const channel = {
      on: () => channel,
      subscribe: () => channel,
    };
    return {
      from: (table: string) => {
        if (table === "games") {
          return {
            select: () => ({
              order: async () => ({ data: games, error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      rpc: async (name: string, args: any) => {
        if (name === "delete_my_test_game") {
          deletedTestGameId = args.p_game_id;
          return { data: null, error: null };
        }
        throw new Error(`unexpected rpc ${name}`);
      },
      channel: () => channel,
      removeChannel: (value: any) => {
        removedChannel = value;
      },
      get removedChannel() {
        return removedChannel;
      },
      get deletedTestGameId() {
        return deletedTestGameId;
      },
    } as any;
  }

  function game(overrides: Record<string, unknown>) {
    return {
      id: "game-1",
      name: "Test game",
      status: "active",
      player_count: 2,
      current_round: 1,
      current_seat: 0,
      created_at: "2026-07-01T00:00:00Z",
      latest_move_committed_at: "2026-07-01T00:00:00Z",
      players: [
        { seat: 0, user_id: "user-me", faction: "terrans", display_name: "Me", score: 10 },
        { seat: 1, user_id: "user-other", faction: "nevlas", display_name: "Other", score: 8 },
      ],
      ...overrides,
    };
  }

  beforeEach(() => {
    window.localStorage.clear();
  });

  async function openPanel(games: any[]) {
    const wrapper = mount(GameNavPanel as any, {
      propsData: { client: makeClient(games), session },
    });
    await Vue.nextTick();
    await Vue.nextTick();
    (wrapper.vm as any).open = true;
    await Vue.nextTick();
    return wrapper;
  }

  it("sorts my active games with my-turn first, filters out other players' games and open/finished games", async () => {
    const games = [
      game({ id: "not-mine", players: [{ seat: 0, user_id: "someone-else" }] }),
      game({ id: "open-game", status: "open" }),
      game({ id: "finished-game", status: "finished" }),
      game({ id: "waiting", current_seat: 1 }),
      game({ id: "my-turn", current_seat: 0 }),
    ];
    const wrapper = await openPanel(games);
    const vm = wrapper.vm as any;
    expect(vm.myActiveGames.map((g: any) => g.id)).to.deep.equal(["my-turn", "waiting"]);
  });

  it("renders each row through the shared GameBar component, matching the Lobby's own game bars", async () => {
    const games = [game({ id: "my-turn", current_seat: 0 })];
    const wrapper = await openPanel(games);
    expect(wrapper.findComponent({ name: "GameBar" }).exists()).to.equal(true);
    expect(wrapper.find(".game-bar__title").text()).to.contain("Test game");
  });

  it("emits select-game when an active-game row is clicked, without navigating, and leaves the panel open", async () => {
    const games = [game({ id: "my-turn", current_seat: 0 })];
    const wrapper = await openPanel(games);
    const row = wrapper.find("a.game-bar__link");
    expect(row.exists()).to.equal(true);
    await row.trigger("click");
    expect(wrapper.emitted("select-game")).to.deep.equal([["my-turn"]]);
    // Owner request - the panel is now a persisted global on/off preference, not something that
    // resets/closes itself just because a game was clicked.
    expect((wrapper.vm as any).open).to.equal(true);
  });

  it("does not intercept clicks on open-lobby rows - they keep their real ?preview= navigation", async () => {
    const games = [game({ id: "open-game", status: "open", players: [] })];
    const wrapper = await openPanel(games);
    (wrapper.vm as any).tab = "open";
    await Vue.nextTick();
    const row = wrapper.find("a.game-bar__link");
    expect(row.attributes("href")).to.equal("?preview=open-game");
    await row.trigger("click");
    expect(wrapper.emitted("select-game")).to.equal(undefined);
  });

  it("deletes a test game via delete_my_test_game and refreshes", async () => {
    const games = [
      game({
        id: "test-game",
        created_by: "user-me",
        players: [
          { seat: 0, user_id: "user-me", faction: "terrans", display_name: "Me", score: 10 },
          { seat: 1, user_id: "user-me", faction: "nevlas", display_name: "Me", score: 8 },
        ],
      }),
    ];
    const client = makeClient(games);
    const wrapper = mount(GameNavPanel as any, { propsData: { client, session } });
    await Vue.nextTick();
    await Vue.nextTick();
    (wrapper.vm as any).open = true;
    await Vue.nextTick();

    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      await wrapper.find(".game-bar__delete-test-game").trigger("click");
      await Vue.nextTick();
    } finally {
      window.confirm = originalConfirm;
    }
    expect(client.deletedTestGameId).to.equal("test-game");
  });

  it("removes the realtime channel on destroy", async () => {
    const client = makeClient([]);
    const wrapper = mount(GameNavPanel as any, { propsData: { client, session } });
    await Vue.nextTick();
    wrapper.destroy();
    expect(client.removedChannel).to.not.equal(null);
  });

  describe("persisted open preference (owner request: global, on by default, not per-game)", () => {
    it("defaults open on a desktop-width viewport (jsdom's own default) when never opened before", () => {
      expect(loadGameNavOpenPreference()).to.equal(true);
      const wrapper = mount(GameNavPanel as any, { propsData: { client: makeClient([]), session } });
      expect((wrapper.vm as any).open).to.equal(true);
    });

    it("a saved 'closed' preference is honored on a fresh mount", () => {
      saveGameNavOpenPreference(false);
      const wrapper = mount(GameNavPanel as any, { propsData: { client: makeClient([]), session } });
      expect((wrapper.vm as any).open).to.equal(false);
    });

    it("closing the panel persists the preference for the next mount", async () => {
      const wrapper = mount(GameNavPanel as any, { propsData: { client: makeClient([]), session } });
      await Vue.nextTick();
      await (wrapper.vm as any).close();
      expect(loadGameNavOpenPreference()).to.equal(false);
    });
  });
});
