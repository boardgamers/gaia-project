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
    let gameRows = [...games];
    let gamesChangeHandler: (() => void) | null = null;
    let removedChannel: any = null;
    const channel = {
      on: (_event: string, _filter: any, handler: () => void) => {
        gamesChangeHandler = handler;
        return channel;
      },
      subscribe: () => channel,
    };
    const client = {
      from: () => ({
        select: () => ({
          order: async () => ({ data: gameRows, error: null }),
        }),
      }),
      channel: () => channel,
      removeChannel: (value: any) => {
        removedChannel = value;
      },
      rpc: async (name: string, args: any) => {
        if (name === "delete_game") {
          deleted = args.p_game_id;
          return { error: null };
        }
        throw new Error(`unexpected rpc ${name}`);
      },
    };
    return {
      client,
      deletedId: () => deleted,
      emitGamesChange: () => gamesChangeHandler && gamesChangeHandler(),
      setGames: (next: any[]) => {
        gameRows = next;
      },
      removedChannel: () => removedChannel,
      channel,
    };
  }

  const sampleGames = [
    { id: "g-mine", name: "My game", created_by: "user-admin", player_count: 2, options: {}, status: "active", current_seat: 0, players: [] },
    { id: "g-theirs", name: "Their game", created_by: "user-other", player_count: 2, options: {}, status: "active", current_seat: 0, players: [] },
  ];

  const membershipGames = [
    {
      id: "g-mine",
      name: "My game",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 0,
      players: [{ seat: 0, invited_email: "kim.pham.nguyen2@gmail.com", user_id: "user-admin", display_name: "Admin", faction: "terrans", score: 10 }],
    },
    {
      id: "g-theirs",
      name: "Their game",
      created_by: "user-other",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 0,
      players: [{ seat: 0, invited_email: "someone-else@example.com", user_id: "user-other", display_name: "Other", faction: "xenos", score: 8 }],
    },
    {
      id: "g-finished",
      name: "Finished theirs",
      created_by: "user-other",
      player_count: 2,
      options: {},
      status: "finished",
      current_seat: null,
      players: [{ seat: 0, invited_email: "someone-else@example.com", user_id: "user-other", display_name: "Other", faction: "nevlas", score: 40 }],
    },
  ];

  it("keeps admin controls inside the settings menu and hides delete until a row is swiped open", async () => {
    const { client } = makeClient(sampleGames);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.find(".lobby-toolbar__actions")!.text()).to.not.contain("Manage users");
    expect((wrapper.vm as any).swipeOffset("g-mine")).to.equal(0);
    expect((wrapper.vm as any).swipeOffset("g-theirs")).to.equal(0);

    wrapper.setData({ revealedGameId: "g-mine" });
    await Vue.nextTick();

    expect((wrapper.vm as any).swipeOffset("g-mine")).to.equal(-88);
  });

  it("shows no admin-only controls at all for a non-admin", async () => {
    const { client } = makeClient([
      { id: "g-own", name: "My game", created_by: "user-other", player_count: 2, options: {}, status: "active", current_seat: 0, players: [] },
    ]);
    const wrapper = mount(Lobby, { propsData: { client, session: otherSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    const buttons = wrapper.findAll("button").filter((b) => b.text() === "Delete");
    expect(buttons.length).to.equal(0);
    expect(wrapper.find('a[href="?users=1"]').exists()).to.equal(false);
    expect(wrapper.text()).to.not.contain("Manage users");
  });

  it("calls delete_game and refreshes after the admin confirms deletion", async () => {
    const { client, deletedId } = makeClient([sampleGames[1]]);
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
      await Vue.nextTick();
      await Vue.nextTick();

      wrapper.setData({ activeTab: "active" });
      await Vue.nextTick();

      wrapper.setData({ revealedGameId: "g-theirs" });
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

      wrapper.setData({ revealedGameId: "g-mine" });
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

  it("shows round, per-player faction/score, highlights whoever's turn it is, and drops the move label", async () => {
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
    expect(wrapper.text()).to.not.contain("your turn");
    expect(wrapper.text()).to.not.contain("Bob to move");
  });

  it("shows no round badge or player chips for a game with no cached lobby data yet", async () => {
    const { client } = makeClient(sampleGames);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.find(".game-bar__round").exists()).to.equal(false);
    expect(wrapper.find(".game-bar__player").exists()).to.equal(false);
  });

  it("shows the current version and expands the changelog on demand", async () => {
    const { client } = makeClient([]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.text()).to.contain("Version 5.13.6");
    expect(wrapper.text()).to.not.contain("2026-07-08");
    expect(wrapper.text()).to.not.contain("kim.pham.nguyen2@gmail.com");
    expect(wrapper.find(".release-modal").exists()).to.equal(false);

    const toggle = wrapper.find(".lobby-meta__toggle-link");
    await toggle.trigger("click");
    await Vue.nextTick();

    expect(wrapper.find(".release-modal").exists()).to.equal(true);
    expect(wrapper.text()).to.contain("Hosted changelog");
    expect(wrapper.text()).to.contain("Add My games lobby tab and global hosted lobby visibility");
    expect(wrapper.text()).to.contain("The hosted lobby now defaults to a My games tab, while Active and Finished still expose the full hosted lobby.");
    expect(wrapper.text()).to.contain("2026-07-08");
  });

  it("defaults to My games, while Active and Finished still show the full lobby", async () => {
    const { client } = makeClient(membershipGames);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    let titles = wrapper.findAll(".game-bar__title").wrappers.map((node) => node.text());
    expect(titles).to.deep.equal(["My game · 2p · base game"]);

    const activeTab = wrapper.findAll("button").filter((b) => b.text().includes("Active")).at(0);
    await activeTab.trigger("click");
    await Vue.nextTick();

    titles = wrapper.findAll(".game-bar__title").wrappers.map((node) => node.text());
    expect(titles).to.deep.equal(["My game · 2p · base game", "Their game · 2p · base game"]);

    const finishedTab = wrapper.findAll("button").filter((b) => b.text().includes("Finished")).at(0);
    await finishedTab.trigger("click");
    await Vue.nextTick();

    titles = wrapper.findAll(".game-bar__title").wrappers.map((node) => node.text());
    expect(titles).to.deep.equal(["Finished theirs · 2p · base game"]);
  });

  it("shows a My games empty state when the user is not in any listed game", async () => {
    const { client } = makeClient([
      {
        id: "g-other",
        name: "Other game",
        created_by: "user-admin",
        player_count: 2,
        options: {},
        status: "active",
        current_seat: 0,
        players: [{ seat: 0, invited_email: "kim.pham.nguyen2@gmail.com", user_id: "user-admin", display_name: "Admin" }],
      },
    ]);
    const wrapper = mount(Lobby, { propsData: { client, session: otherSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.text()).to.contain("No games with you in them yet.");
    expect(wrapper.text()).to.not.contain("Other game");
  });

  it("shows R0 for a game still in faction selection instead of hiding the badge", async () => {
    const { client } = makeClient([
      {
        id: "g-setup",
        name: "Setup game",
        created_by: "user-other",
        player_count: 2,
        options: {},
        status: "active",
        current_seat: 1,
        current_round: 0,
        players: [
          { seat: 0, invited_email: "alice@example.com", user_id: "user-other", display_name: "Alice", faction: "terrans", score: 10 },
        ],
      },
    ]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "active" });
    await Vue.nextTick();

    expect(wrapper.text()).to.contain("R0");
    expect(wrapper.findAll(".game-bar__player").length).to.equal(1);
  });

  it("still labels another player's hot-seat game as a test game when the admin views it", async () => {
    const { client } = makeClient([
      {
        id: "g-test-theirs",
        name: "Other test",
        created_by: "user-other",
        player_count: 2,
        options: {},
        status: "active",
        current_seat: 0,
        players: [
          { seat: 0, invited_email: "other@example.com", user_id: "user-other", display_name: "Other A" },
          { seat: 1, invited_email: "other@example.com", user_id: "user-other", display_name: "Other B" },
        ],
      },
    ]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "active" });
    await Vue.nextTick();

    expect(wrapper.text()).to.contain("Test game");
  });

  it("shows the New game link for a non-admin too", async () => {
    const { client } = makeClient([]);
    const wrapper = mount(Lobby, { propsData: { client, session: otherSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.find('a[href="?create=1"]').exists()).to.equal(true);
  });

  it("refreshes the lobby when a games-table realtime event arrives", async () => {
    const game = {
      id: "g-live",
      name: "Live game",
      created_by: "user-other",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 0,
      current_round: null,
      players: [],
    };
    const { client, emitGamesChange, setGames } = makeClient([game]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "active" });
    await Vue.nextTick();

    expect(wrapper.text()).to.not.contain("R4");

    setGames([
      {
        ...game,
        current_round: 4,
        players: [
          { seat: 0, invited_email: "alice@example.com", user_id: "user-other", display_name: "Alice", faction: "terrans", score: 28 },
          { seat: 1, invited_email: "bob@example.com", user_id: "user-friend", display_name: "Bob", faction: "xenos", score: 24 },
        ],
      },
    ]);
    emitGamesChange();
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.text()).to.contain("R4");
    expect(wrapper.findAll(".game-bar__player").length).to.equal(2);
  });

  it("removes the realtime channel when the lobby unmounts", async () => {
    const { client, removedChannel, channel } = makeClient(sampleGames);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.destroy();

    expect(removedChannel()).to.equal(channel);
  });
});
