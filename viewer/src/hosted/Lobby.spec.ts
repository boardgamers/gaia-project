import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { mount } from "@vue/test-utils";
import Lobby from "./Lobby.vue";
import release from "./release.json";

Vue.use(BootstrapVue);

describe("Lobby", () => {
  const adminSession = { user: { id: "user-admin", email: "kim.pham.nguyen2@gmail.com" } } as any;
  const otherSession = { user: { id: "user-other", email: "someone-else@example.com" } } as any;
  const NOW = new Date("2026-07-08T12:00:00Z").getTime();
  const realDateNow = Date.now;

  function makeClient(games: any[], moves: any[] = [], nickname = "") {
    let deleted: string | null = null;
    let gameRows = [...games];
    let moveRows = [...moves];
    let myNickname = nickname;
    let gamesChangeHandler: (() => void) | null = null;
    let removedChannel: any = null;
    let presenceStateData: Record<string, any[]> = {};
    const channel = {
      on: (_event: string, _filter: any, handler: () => void) => {
        gamesChangeHandler = handler;
        return channel;
      },
      subscribe: () => channel,
    };
    const client = {
      from: (table: string) => {
        if (table === "games") {
          return {
            select: () => ({
              order: async () => ({ data: gameRows, error: null }),
            }),
          };
        }
        if (table === "moves") {
          return {
            select: () => ({
              in: (_column: string, ids: string[]) => ({
                order: async () => ({
                  data: moveRows
                    .filter((row) => ids.includes(row.game_id))
                    .slice()
                    .sort((a, b) => b.seq - a.seq),
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { nickname: myNickname }, error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      channel: (name: string) => {
        if (name === "lobby-games") {
          return channel;
        }
        let presenceSyncHandler: (() => void) | null = null;
        const presenceChannel = {
          on: (event: string, filter: any, handler: () => void) => {
            if (event === "presence" && filter?.event === "sync") {
              presenceSyncHandler = handler;
            }
            return presenceChannel;
          },
          subscribe: (handler?: (status: string) => void) => {
            handler?.("SUBSCRIBED");
            presenceSyncHandler?.();
            return presenceChannel;
          },
          track: async () => undefined,
          presenceState: () => presenceStateData,
        };
        return presenceChannel;
      },
      removeChannel: (value: any) => {
        removedChannel = value;
      },
      rpc: async (name: string, args: any) => {
        if (name === "delete_game") {
          deleted = args.p_game_id;
          return { error: null };
        }
        if (name === "join_open_game_seat") {
          gameRows = gameRows.map((game) =>
            game.id !== args.p_game_id
              ? game
              : {
                  ...game,
                  players: (game.players ?? []).map((player: any) =>
                    player.seat === args.p_seat
                      ? {
                          ...player,
                          user_id: "user-admin",
                          invited_email: "kim.pham.nguyen2@gmail.com",
                          display_name: "Admin",
                        }
                      : player
                  ),
                }
          );
          return { data: gameRows.find((game) => game.id === args.p_game_id), error: null };
        }
        if (name === "leave_open_game_seat") {
          gameRows = gameRows.map((game) =>
            game.id !== args.p_game_id
              ? game
              : {
                  ...game,
                  players: (game.players ?? []).map((player: any) =>
                    player.seat === args.p_seat ? { ...player, user_id: null, display_name: "", invited_email: "open-seat@lobby.invalid" } : player
                  ),
                }
          );
          return { data: gameRows.find((game) => game.id === args.p_game_id), error: null };
        }
        if (name === "set_my_nickname") {
          myNickname = args.p_nickname;
          return { data: { user_id: "user-admin", nickname: myNickname }, error: null };
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
      setMoves: (next: any[]) => {
        moveRows = next;
      },
      setPresenceState: (next: Record<string, any[]>) => {
        presenceStateData = next;
      },
      removedChannel: () => removedChannel,
      channel,
      currentNickname: () => myNickname,
    };
  }

  const sampleGames = [
    {
      id: "g-mine",
      name: "My game",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 0,
      latest_move_summary: null,
      players: [],
    },
    {
      id: "g-theirs",
      name: "Their game",
      created_by: "user-other",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 0,
      latest_move_summary: null,
      players: [],
    },
  ];

  const membershipGames = [
    {
      id: "g-open",
      name: "Open table",
      created_by: "user-other",
      player_count: 3,
      options: {},
      status: "open",
      current_seat: null,
      latest_move_summary: null,
      setup_move: "p3 rotate",
      players: [
        { seat: 0, invited_email: "someone-else@example.com", user_id: "user-other", display_name: "Other", faction: null, score: null },
        { seat: 1, invited_email: "open-seat@lobby.invalid", user_id: null, display_name: "", faction: null, score: null },
        { seat: 2, invited_email: "open-seat@lobby.invalid", user_id: null, display_name: "", faction: null, score: null },
      ],
    },
    {
      id: "g-mine",
      name: "My game",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 0,
      latest_move_summary: "Terrans up int.",
      players: [{ seat: 0, invited_email: "kim.pham.nguyen2@gmail.com", user_id: "user-admin", display_name: "Admin", faction: "terrans", score: 10 }],
    },
    {
      id: "g-theirs",
      name: "Their game",
      created_by: "user-other",
      player_count: 2,
      options: { auction: "silent" },
      status: "active",
      current_seat: 0,
      latest_move_summary: "Xenos pass booster3.",
      players: [{ seat: 0, invited_email: "someone-else@example.com", user_id: "user-other", display_name: "Other", faction: "xenos", score: 8 }],
    },
    {
      id: "g-finished",
      name: "Finished theirs",
      created_by: "user-other",
      player_count: 2,
      options: { auction: "silent" },
      status: "finished",
      current_seat: null,
      latest_move_summary: "Nevlas form fed.",
      players: [{ seat: 0, invited_email: "someone-else@example.com", user_id: "user-other", display_name: "Other", faction: "nevlas", score: 40 }],
    },
  ];

  beforeEach(() => {
    (Date as any).now = () => NOW;
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    (Date as any).now = realDateNow;
  });

  it("keeps admin controls inside the settings menu and hides delete until a row is swiped open", async () => {
    const { client } = makeClient(sampleGames);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.text()).to.contain("Gaia Project: The Lost Fleet");
    expect(wrapper.find(".lobby-toolbar__actions")!.text()).to.not.contain("Manage users");
    expect((wrapper.vm as any).swipeOffset("g-mine")).to.equal(0);
    expect((wrapper.vm as any).swipeOffset("g-theirs")).to.equal(0);

    wrapper.setData({ revealedGameId: "g-mine" });
    await Vue.nextTick();

    expect((wrapper.vm as any).swipeOffset("g-mine")).to.equal(-88);
  });

  it("shows no admin-only controls at all for a non-admin", async () => {
    const { client } = makeClient([
      {
        id: "g-own",
        name: "My game",
        created_by: "user-other",
        player_count: 2,
        options: {},
        status: "active",
        current_seat: 0,
        latest_move_summary: null,
        players: [],
      },
    ], [{ game_id: "g-four", seq: 12, move: "terrans up int.", committed_at: "2026-07-08T11:05:00Z" }]);
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

      wrapper.setData({ activeTab: "active" });
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

  it("shows round, per-player faction/score, uses a green score pill for the active seat, and drops the move label", async () => {
    const game = {
      id: "g-active",
      name: "Friends game",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 1,
      current_round: 3,
      latest_move_summary: "Terrans build mine sector 3.",
      players: [
        { seat: 0, invited_email: "alice@example.com", user_id: "user-admin", display_name: "Alice", faction: "terrans", score: 24 },
        { seat: 1, invited_email: "bob@example.com", user_id: "user-other", display_name: "Bob", faction: "nevlas", score: 31 },
      ],
    };
    const { client, setPresenceState } = makeClient([game], [
      { game_id: "g-active", seq: 11, move: "terrans build m 3B0.", committed_at: "2026-07-08T11:05:00Z" },
    ]);
    setPresenceState({
      "user-other": [{ context: { type: "game", gameId: "g-active" }, focused: true }],
      "user-admin": [{ context: { type: "lobby" }, focused: true }],
    });
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "active" });
    await Vue.nextTick();

    expect(wrapper.text()).to.contain("R3");
    const players = wrapper.findAll(".game-bar__player");
    expect(players.length).to.equal(2);
    expect(players.at(0).text()).to.contain("24");
    expect(players.at(1).text()).to.contain("31");
    const scores = wrapper.findAll(".game-bar__score");
    expect(scores.at(0).classes()).to.not.contain("game-bar__score--active");
    expect(scores.at(1).classes()).to.contain("game-bar__score--active");
    const presenceDots = wrapper.findAll(".game-bar__presence");
    expect(presenceDots.at(0).classes()).to.contain("game-bar__presence--yellow");
    expect(presenceDots.at(1).classes()).to.contain("game-bar__presence--green");
    expect(wrapper.text()).to.contain("55m ago");
    expect(wrapper.text()).to.contain("Terrans build mine sector 3.");
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

    const currentEntry = release.entries[0];
    expect(wrapper.text()).to.contain(`Version ${release.version}`);
    expect(wrapper.text()).to.not.contain("2026-07-08");
    expect(wrapper.text()).to.not.contain("kim.pham.nguyen2@gmail.com");
    expect(wrapper.find(".release-modal").exists()).to.equal(false);

    const toggle = wrapper.find(".lobby-meta__toggle-link");
    await toggle.trigger("click");
    await Vue.nextTick();

    expect(wrapper.find(".release-modal").exists()).to.equal(true);
    expect(wrapper.text()).to.contain("Hosted changelog");
    expect(wrapper.text()).to.contain(currentEntry.title);
    expect(wrapper.text()).to.contain(currentEntry.changes[0]);
    expect(wrapper.text()).to.contain(currentEntry.releasedAt);
  });

  it("defaults to Lobby, while My games, Active, and Finished keep their own sections", async () => {
    const { client } = makeClient(membershipGames, [
      { game_id: "g-open", seq: 1, move: "p3 rotate", committed_at: "2026-07-08T09:00:00Z" },
      { game_id: "g-mine", seq: 7, move: "terrans up int.", committed_at: "2026-07-08T11:05:00Z" },
      { game_id: "g-theirs", seq: 9, move: "xenos pass booster3.", committed_at: "2026-07-08T10:00:00Z" },
      { game_id: "g-finished", seq: 42, move: "nevlas federation 1A4,9A9,9B4,9C fed4.", committed_at: "2026-07-06T12:00:00Z" },
    ]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    let titles = wrapper.findAll(".game-bar__title").wrappers.map((node) => node.text());
    expect(titles).to.deep.equal(["Open table1/3 joinedStandard"]);
    let summaries = wrapper.findAll(".game-bar__summary").wrappers.map((node) => node.text());
    expect(summaries).to.deep.equal([]);

    const mineTab = wrapper.findAll("button").filter((b) => b.text().includes("My games")).at(0);
    await mineTab.trigger("click");
    await Vue.nextTick();

    titles = wrapper.findAll(".game-bar__title").wrappers.map((node) => node.text());
    expect(titles).to.deep.equal(["My gameStandard"]);
    summaries = wrapper.findAll(".game-bar__summary").wrappers.map((node) => node.text());
    expect(summaries).to.deep.equal(["55m ago Terrans up int."]);

    const activeTab = wrapper.findAll("button").filter((b) => b.text().includes("Active")).at(0);
    await activeTab.trigger("click");
    await Vue.nextTick();

    titles = wrapper.findAll(".game-bar__title").wrappers.map((node) => node.text());
    expect(titles).to.deep.equal(["My gameStandard", "Their gameSilent Auction"]);
    summaries = wrapper.findAll(".game-bar__summary").wrappers.map((node) => node.text());
    expect(summaries).to.deep.equal(["55m ago Terrans up int.", "2h ago Xenos pass booster3."]);

    const finishedTab = wrapper.findAll("button").filter((b) => b.text().includes("Finished")).at(0);
    await finishedTab.trigger("click");
    await Vue.nextTick();

    titles = wrapper.findAll(".game-bar__title").wrappers.map((node) => node.text());
    expect(titles).to.deep.equal(["Finished theirsSilent Auction"]);
    summaries = wrapper.findAll(".game-bar__summary").wrappers.map((node) => node.text());
    expect(summaries).to.deep.equal(["2d ago Nevlas form fed."]);
  });

  it("links open games to their dedicated preview page", async () => {
    const { client } = makeClient([membershipGames[0]]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "open" });
    await Vue.nextTick();

    const link = wrapper.find(".game-bar__link");
    expect(link.attributes("href")).to.equal("?preview=g-open");
  });

  it("falls back to compacting the latest stored move when the cached lobby summary is still missing", async () => {
    const { client } = makeClient(
      [
        {
          id: "g-fallback",
          name: "Fallback game",
          created_by: "user-admin",
          player_count: 2,
          options: {},
          status: "active",
          current_seat: 0,
          latest_move_summary: null,
          players: [{ seat: 0, invited_email: "kim.pham.nguyen2@gmail.com", user_id: "user-admin", display_name: "Admin", faction: "ivits", score: 20 }],
        },
      ],
      [{ game_id: "g-fallback", seq: 6, move: "ivits up int.", committed_at: "2026-07-08T11:05:00Z" }]
    );
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "active" });
    await Vue.nextTick();

    expect(wrapper.find(".game-bar__summary").text()).to.equal("55m ago Ivits up int.");
  });

  it("overlaps avatars and splits 3-4 player games into two rows", async () => {
    const { client } = makeClient([
      {
        id: "g-four",
        name: "Four player",
        created_by: "user-admin",
        player_count: 4,
        options: {},
        status: "active",
        current_seat: 2,
        current_round: 2,
        latest_move_summary: "Terrans up int.",
        players: [
          { seat: 0, invited_email: "a@example.com", user_id: "a", display_name: "A", faction: "terrans", score: 20 },
          { seat: 1, invited_email: "b@example.com", user_id: "b", display_name: "B", faction: "nevlas", score: 21 },
          { seat: 2, invited_email: "c@example.com", user_id: "c", display_name: "C", faction: "ivits", score: 22 },
          { seat: 3, invited_email: "d@example.com", user_id: "d", display_name: "D", faction: "xenos", score: 23 },
        ],
      },
    ]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "active" });
    await Vue.nextTick();

    expect(wrapper.findAll(".game-bar__player-row").length).to.equal(2);
    expect(wrapper.find(".game-bar__players").classes()).to.contain("game-bar__players--stacked");
    expect(wrapper.findAll(".game-bar__player").length).to.equal(4);
  });

  it("shows yellow in the lobby when a player is online elsewhere in the app", async () => {
    const game = {
      id: "g-yellow",
      name: "Presence game",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 0,
      current_round: 1,
      latest_move_summary: "Terrans up int.",
      players: [
        { seat: 0, invited_email: "alice@example.com", user_id: "user-admin", display_name: "Alice", faction: "terrans", score: 20 },
        { seat: 1, invited_email: "bob@example.com", user_id: "user-other", display_name: "Bob", faction: "nevlas", score: 21 },
      ],
    };
    const { client, setPresenceState } = makeClient([game], [
      { game_id: "g-yellow", seq: 3, move: "terrans up int.", committed_at: "2026-07-08T11:05:00Z" },
    ]);
    setPresenceState({
      "user-admin": [{ context: { type: "lobby" }, focused: true }],
      "user-other": [{ context: { type: "game", gameId: "other-game" }, focused: true }],
    });
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "active" });
    await Vue.nextTick();

    const presenceDots = wrapper.findAll(".game-bar__presence");
    expect(presenceDots.at(0).classes()).to.contain("game-bar__presence--yellow");
    expect(presenceDots.at(1).classes()).to.contain("game-bar__presence--yellow");
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
        latest_move_summary: null,
        players: [{ seat: 0, invited_email: "kim.pham.nguyen2@gmail.com", user_id: "user-admin", display_name: "Admin" }],
      },
    ]);
    const wrapper = mount(Lobby, { propsData: { client, session: otherSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "mine" });
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
        latest_move_summary: "P1 pick Terrans.",
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
        latest_move_summary: null,
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
      latest_move_summary: null,
      players: [],
    };
    const { client, emitGamesChange, setGames, setMoves } = makeClient([game]);
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
        latest_move_summary: "Terrans up int.",
        players: [
          { seat: 0, invited_email: "alice@example.com", user_id: "user-other", display_name: "Alice", faction: "terrans", score: 28 },
          { seat: 1, invited_email: "bob@example.com", user_id: "user-friend", display_name: "Bob", faction: "xenos", score: 24 },
        ],
      },
    ]);
    setMoves([{ game_id: "g-live", seq: 5, move: "terrans up int.", committed_at: "2026-07-08T11:05:00Z" }]);
    emitGamesChange();
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.text()).to.contain("R4");
    expect(wrapper.text()).to.contain("55m ago");
    expect(wrapper.text()).to.contain("Terrans up int.");
    expect(wrapper.findAll(".game-bar__player").length).to.equal(2);
  });

  it("removes the realtime channel when the lobby unmounts", async () => {
    const { client, removedChannel } = makeClient(sampleGames);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.destroy();

    expect(removedChannel()).to.not.equal(null);
  });

  it("lets a player edit their nickname from the settings menu", async () => {
    const { client, currentNickname } = makeClient(sampleGames, [], "OldName");
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();
    await Vue.nextTick();

    expect((wrapper.vm as any).myNickname).to.equal("OldName");

    (wrapper.vm as any).openNicknameModal();
    await Vue.nextTick();

    expect((wrapper.vm as any).showNicknameModal).to.equal(true);
    expect((wrapper.vm as any).nicknameInput).to.equal("OldName");
    expect(wrapper.find(".release-modal").text()).to.contain("Edit nickname");

    wrapper.setData({ nicknameInput: "Star Fox" });
    await (wrapper.vm as any).saveNickname();
    await Vue.nextTick();

    expect(currentNickname()).to.equal("Star Fox");
    expect((wrapper.vm as any).myNickname).to.equal("Star Fox");
    expect((wrapper.vm as any).showNicknameModal).to.equal(false);
  });

  it("never falls back to showing a player's email in the game bar tooltip", () => {
    const { client } = makeClient(sampleGames);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    const player = { display_name: "", invited_email: "secret@example.com", score: 5, faction: "terrans" };

    const title = (wrapper.vm as any).playerBarTitle({}, player);

    expect(title).to.not.contain("secret@example.com");
    expect(title).to.contain("Unknown player");
  });
});
