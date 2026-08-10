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
    // Keyed by the subscribed table, because "which tables does the lobby actually listen to" is
    // itself under test: `games`/`players` are NOT in the supabase_realtime publication, so a
    // listener on those alone never fires in production and the list silently goes stale.
    const changeHandlers: Record<string, (() => void)[]> = {};
    const channel = {
      on: (_event: string, filter: any, handler: () => void) => {
        gamesChangeHandler = handler;
        const table = filter?.table ?? "";
        changeHandlers[table] = (changeHandlers[table] ?? []).concat(handler);
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
                    player.seat === args.p_seat
                      ? { ...player, user_id: null, display_name: "", invited_email: "open-seat@lobby.invalid" }
                      : player
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
      emitChange: (table: string) => (changeHandlers[table] ?? []).forEach((handler) => handler()),
      subscribedTables: () => Object.keys(changeHandlers),
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
        {
          seat: 0,
          invited_email: "someone-else@example.com",
          user_id: "user-other",
          display_name: "Other",
          faction: null,
          score: null,
        },
        {
          seat: 1,
          invited_email: "open-seat@lobby.invalid",
          user_id: null,
          display_name: "",
          faction: null,
          score: null,
        },
        {
          seat: 2,
          invited_email: "open-seat@lobby.invalid",
          user_id: null,
          display_name: "",
          faction: null,
          score: null,
        },
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
      players: [
        {
          seat: 0,
          invited_email: "kim.pham.nguyen2@gmail.com",
          user_id: "user-admin",
          display_name: "Admin",
          faction: "terrans",
          score: 10,
        },
      ],
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
      players: [
        {
          seat: 0,
          invited_email: "someone-else@example.com",
          user_id: "user-other",
          display_name: "Other",
          faction: "xenos",
          score: 8,
        },
      ],
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
      players: [
        {
          seat: 0,
          invited_email: "someone-else@example.com",
          user_id: "user-other",
          display_name: "Other",
          faction: "nevlas",
          score: 40,
        },
      ],
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

    expect(wrapper.text()).to.contain("GP: Fight Club");
    expect(wrapper.find(".lobby-toolbar__actions")!.text()).to.not.contain("Manage users");
    expect((wrapper.vm as any).swipeOffset("g-mine")).to.equal(0);
    expect((wrapper.vm as any).swipeOffset("g-theirs")).to.equal(0);

    wrapper.setData({ revealedGameId: "g-mine" });
    await Vue.nextTick();

    expect((wrapper.vm as any).swipeOffset("g-mine")).to.equal(-88);
  });

  it("never starts the swipe-capture flow for a mouse pointerdown - only real touch/pen swipes (desktop click bug)", async () => {
    const { client } = makeClient(sampleGames);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    const setPointerCapture = () => {
      throw new Error("setPointerCapture must not be called for a mouse pointerdown");
    };

    // A desktop mouse click must be a no-op for the swipe machinery: setPointerCapture() on an
    // ancestor of the <a> retargets the click event away from the anchor, silently breaking both
    // its native href navigation and its own @click handler.
    (wrapper.vm as any).startSwipe("g-mine", {
      pointerType: "mouse",
      clientX: 10,
      target: document.createElement("div"),
      currentTarget: { setPointerCapture },
    });
    expect((wrapper.vm as any).swipeGameId).to.equal("");

    // Touch/pen swipes are unaffected - the gesture still works as before.
    let captured = false;
    (wrapper.vm as any).startSwipe("g-mine", {
      pointerType: "touch",
      clientX: 10,
      target: document.createElement("div"),
      currentTarget: { setPointerCapture: () => (captured = true) },
    });
    expect((wrapper.vm as any).swipeGameId).to.equal("g-mine");
    expect(captured).to.equal(true);
  });

  it("shows no admin-only controls at all for a non-admin", async () => {
    const { client } = makeClient(
      [
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
      ],
      [{ game_id: "g-four", seq: 12, move: "terrans up int.", committed_at: "2026-07-08T11:05:00Z" }]
    );
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

      const button = wrapper
        .findAll("button")
        .filter((b) => b.text() === "Delete")
        .at(0);
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

      wrapper.setData({ activeTab: "mine" });
      await Vue.nextTick();

      wrapper.setData({ revealedGameId: "g-mine" });
      await Vue.nextTick();

      const button = wrapper
        .findAll("button")
        .filter((b) => b.text() === "Delete")
        .at(0);
      await button.trigger("click");
      await Vue.nextTick();

      expect(deletedId(), "delete_game should not be called").to.equal(null);
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
        {
          seat: 0,
          invited_email: "alice@example.com",
          user_id: "user-admin",
          display_name: "Alice",
          faction: "terrans",
          score: 24,
        },
        {
          seat: 1,
          invited_email: "bob@example.com",
          user_id: "user-other",
          display_name: "Bob",
          faction: "nevlas",
          score: 31,
        },
      ],
    };
    const { client, setPresenceState } = makeClient(
      [game],
      [{ game_id: "g-active", seq: 11, move: "terrans build m 3B0.", committed_at: "2026-07-08T11:05:00Z" }]
    );
    setPresenceState({
      "user-other": [{ context: { type: "game", gameId: "g-active" }, focused: true }],
      "user-admin": [{ context: { type: "lobby" }, focused: true }],
    });
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "mine" });
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

  it("pulses green and still shows the move age for an active game that's genuinely the viewer's turn", async () => {
    const game = {
      id: "g-my-turn",
      name: "Cinder Spire",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 1,
      current_round: 4,
      latest_move_summary: "Hadsch Hallas power action 6.",
      players: [
        {
          seat: 0,
          invited_email: "someone-else@example.com",
          user_id: "user-other",
          display_name: "Other",
          faction: "hadsch-hallas",
          score: 20,
        },
        {
          seat: 1,
          invited_email: "kim.pham.nguyen2@gmail.com",
          user_id: "user-admin",
          display_name: "Admin",
          faction: "moweyds",
          score: 18,
        },
      ],
    };
    const { client } = makeClient(
      [game],
      [
        {
          game_id: "g-my-turn",
          seq: 62,
          move: "hadsch-hallas action power6. build m 2A5.",
          committed_at: "2026-07-08T09:00:00Z",
        },
      ]
    );
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "mine" });
    await Vue.nextTick();

    expect(wrapper.find(".game-bar").classes()).to.contain("game-bar--my-turn");
    expect(wrapper.text()).to.contain("3h ago");
    expect(wrapper.text()).to.contain("Hadsch Hallas power action 6.");
  });

  // Owner-reported 2026-08-10 ("it is not my turn in Solar Comet, why is the game bar pulsing
  // green?"): the pulse was correct when the menu loaded and then never updated. The lobby only
  // subscribed to `games`/`players`, neither of which is in the supabase_realtime publication, so
  // no realtime event ever reached it - the whole list, turn state included, was frozen at page
  // load. `moves` IS published, and every path that changes whose turn it is inserts a row there.
  it("clears the green pulse when a move elsewhere hands the turn on, without a reload", async () => {
    const game = {
      id: "g-stale-turn",
      name: "Solar Comet",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 0,
      current_round: 3,
      latest_move_summary: "Geodens pass.",
      latest_move_committed_at: "2026-08-10T14:48:00Z",
      players: [
        { seat: 0, invited_email: "kim.pham.nguyen2@gmail.com", user_id: "user-admin", faction: "hadsch-hallas" },
        { seat: 1, invited_email: "someone-else@example.com", user_id: "user-other", faction: "darkanians" },
      ],
    };
    const { client, emitChange, subscribedTables, setGames } = makeClient([game]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(subscribedTables()).to.contain("moves");
    expect(wrapper.find(".game-bar").classes()).to.contain("game-bar--my-turn");

    // I take my turn; the seat moves on. Only a `moves` insert announces that.
    setGames([{ ...game, current_seat: 1, latest_move_summary: "Hadsch Hallas build lab." }]);
    emitChange("moves");
    await Vue.nextTick();
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.find(".game-bar").classes()).to.not.contain("game-bar--my-turn");
  });

  // The other half of the same bug: realtime never replays what a sleeping phone missed, so coming
  // back to a menu that was left open has to re-sync rather than trust what's on screen.
  it("re-syncs the game list when the page becomes visible again", async () => {
    const game = {
      id: "g-backgrounded",
      name: "Solar Comet",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 0,
      current_round: 3,
      latest_move_summary: "Geodens pass.",
      latest_move_committed_at: "2026-08-10T14:48:00Z",
      players: [
        { seat: 0, invited_email: "kim.pham.nguyen2@gmail.com", user_id: "user-admin", faction: "hadsch-hallas" },
        { seat: 1, invited_email: "someone-else@example.com", user_id: "user-other", faction: "darkanians" },
      ],
    };
    const { client, setGames } = makeClient([game]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.find(".game-bar").classes()).to.contain("game-bar--my-turn");

    setGames([{ ...game, current_seat: 1, latest_move_summary: "Hadsch Hallas build lab." }]);
    document.dispatchEvent(new Event("visibilitychange"));
    await Vue.nextTick();
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.find(".game-bar").classes()).to.not.contain("game-bar--my-turn");
  });

  // Owner request 2026-07-31: the green flash means "your Gaia turn" and nothing else. A waiting
  // side game still labels itself with its glyph, it just doesn't flash the bar.
  it("does NOT pulse green when only the game's shared chess board is waiting on the viewer", async () => {
    const game = {
      id: "g-chess-turn",
      name: "Lunar Beacon",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 0, // the OTHER seat's Gaia turn - isMyTurn() alone would be false
      current_round: 2,
      latest_move_summary: "Terrans build mine sector 3.",
      players: [
        {
          seat: 0,
          invited_email: "someone-else@example.com",
          user_id: "user-other",
          display_name: "Other",
          faction: "terrans",
          score: 10,
        },
        {
          seat: 1,
          invited_email: "kim.pham.nguyen2@gmail.com",
          user_id: "user-admin",
          display_name: "Admin",
          faction: "moweyds",
          score: 8,
        },
      ],
      chess_board: {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        white_user: "user-admin",
        black_user: "user-other",
        white_user_2: null,
        black_user_2: null,
        white_next_user: null,
        black_next_user: null,
      },
    };
    const { client } = makeClient([game]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "mine" });
    await Vue.nextTick();

    expect(wrapper.find(".game-bar").classes()).to.not.contain("game-bar--my-turn");
    expect(wrapper.find(".game-bar__turn-kind--chess").exists()).to.equal(true);
  });

  it("does NOT pulse green when only the game's shared renju board is waiting on the viewer", async () => {
    const game = {
      id: "g-renju-turn",
      name: "Sunward Drift",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 0, // the OTHER seat's Gaia turn - isMyTurn() alone would be false
      current_round: 2,
      latest_move_summary: "Terrans build mine sector 3.",
      players: [
        {
          seat: 0,
          invited_email: "someone-else@example.com",
          user_id: "user-other",
          display_name: "Other",
          faction: "terrans",
          score: 10,
        },
        {
          seat: 1,
          invited_email: "kim.pham.nguyen2@gmail.com",
          user_id: "user-admin",
          display_name: "Admin",
          faction: "moweyds",
          score: 8,
        },
      ],
      renju_board: {
        // One black stone played, so it is white's move - and the viewer is white.
        board: "b" + ".".repeat(224),
        black_user: "user-other",
        black_user_2: null,
        white_user: "user-admin",
        white_user_2: null,
        black_next_user: null,
        white_next_user: null,
      },
    };
    const { client } = makeClient([game]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "mine" });
    await Vue.nextTick();

    expect(wrapper.find(".game-bar").classes()).to.not.contain("game-bar--my-turn");
    expect(wrapper.find(".game-bar__turn-kind--renju").exists()).to.equal(true);
  });

  it("shows the move age as 'just now' instead of hiding it when the client clock is slightly behind the server's", async () => {
    const game = {
      id: "g-clock-skew",
      name: "Skewed clock game",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 0,
      latest_move_summary: "Terrans up nav.",
      players: [
        {
          seat: 0,
          invited_email: "someone-else@example.com",
          user_id: "user-other",
          display_name: "Other",
          faction: "terrans",
          score: 5,
        },
      ],
    };
    // committed 30s AFTER "now" from this client's clock's point of view - simulates the client
    // being slightly behind the server.
    const { client } = makeClient(
      [game],
      [{ game_id: "g-clock-skew", seq: 1, move: "terrans up nav.", committed_at: "2026-07-08T12:00:30Z" }]
    );
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "mine" });
    await Vue.nextTick();

    expect(wrapper.find(".game-bar__age").exists(), "age should still render, not vanish").to.equal(true);
    expect(wrapper.text()).to.contain("1m ago");
  });

  it("shows the move age straight from the cached games.latest_move_committed_at column, with no moves-table query needed at all", async () => {
    // Regression for a live bug: the old implementation queried EVERY listed game's moves in one
    // unbounded request to find each one's latest row - with enough total moves across all games
    // (this project has 1500+), that request silently hit PostgREST's default row cap, and
    // whichever games' rows didn't survive lost their age entirely (while latest_move_summary,
    // cached separately, kept working - "summary shows, age doesn't" was the exact live symptom).
    // Migration 0026 caches the timestamp on `games` directly; this game intentionally has ZERO
    // rows in the mocked `moves` table to prove the age no longer depends on that query at all.
    const game = {
      id: "g-cached-age",
      name: "Cached age game",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 0,
      current_round: 3,
      latest_move_summary: "Hadsch Hallas power action 6.",
      latest_move_committed_at: "2026-07-08T09:00:00Z",
      players: [
        {
          seat: 0,
          invited_email: "someone-else@example.com",
          user_id: "user-other",
          display_name: "Other",
          faction: "hadsch-hallas",
          score: 20,
        },
      ],
    };
    const { client } = makeClient([game], []);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "mine" });
    await Vue.nextTick();

    expect(wrapper.text()).to.contain("3h ago");
    expect(wrapper.text()).to.contain("Hadsch Hallas power action 6.");
  });

  it("shows no round badge or player chips for a game with no cached lobby data yet", async () => {
    const { client } = makeClient(sampleGames);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.find(".game-bar__round").exists()).to.equal(false);
    expect(wrapper.find(".game-bar__player").exists()).to.equal(false);
  });

  it("shows the current version and expands the changelog on demand, defaulting to the user-facing tab", async () => {
    const { client } = makeClient([]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    // A recent user-facing entry also has a technical developer bullet. The default tab must omit
    // that bullet, proving it renders `userChanges` rather than the entry's full change list.
    const userFacingEntry = release.entries
      .slice(0, 10)
      .find((e) => (e.userChanges ?? []).length > 0 && e.changes.some((change) => !e.userChanges.includes(change)));
    const developerOnlyChange = userFacingEntry.changes.find((change) => !userFacingEntry.userChanges.includes(change));

    expect(wrapper.text()).to.contain(`Version ${release.version}`);
    expect(wrapper.text()).to.not.contain("2026-07-08");
    expect(wrapper.text()).to.not.contain("kim.pham.nguyen2@gmail.com");
    expect(wrapper.find(".info-modal").exists()).to.equal(false);

    const toggle = wrapper.find(".lobby-meta__toggle-link");
    await toggle.trigger("click");
    await Vue.nextTick();

    expect(wrapper.find(".info-modal").exists()).to.equal(true);
    expect(wrapper.text()).to.contain("Changelog");
    expect(wrapper.text()).to.contain("What's new");
    expect(wrapper.text()).to.contain(userFacingEntry.userChanges[0]);
    expect(wrapper.text()).to.not.contain(developerOnlyChange);

    const devTab = wrapper
      .findAll("button")
      .filter((b) => b.text() === "Developer")
      .at(0);
    await devTab.trigger("click");
    await Vue.nextTick();

    expect(wrapper.text()).to.contain(userFacingEntry.title);
    expect(wrapper.text()).to.contain(developerOnlyChange);
    expect(wrapper.text()).to.contain(userFacingEntry.releasedAt);
  });

  it("opens the Credits modal (boardgamers.space / MIT-license attribution) from the settings menu", async () => {
    const { client } = makeClient([]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.find(".info-modal").exists()).to.equal(false);

    const creditsButton = wrapper
      .findAll("button")
      .filter((b) => b.text() === "Credits")
      .at(0);
    await creditsButton.trigger("click");
    await Vue.nextTick();

    expect(wrapper.find(".info-modal").exists()).to.equal(true);
    expect(wrapper.text()).to.contain("Licensed under the MIT License");
    expect(wrapper.text()).to.contain("boardgamers.space");
  });

  it("defaults to My games, while Lobby, Active, and Finished keep their own sections", async () => {
    const { client } = makeClient(membershipGames, [
      { game_id: "g-open", seq: 1, move: "p3 rotate", committed_at: "2026-07-08T09:00:00Z" },
      { game_id: "g-mine", seq: 7, move: "terrans up int.", committed_at: "2026-07-08T11:05:00Z" },
      { game_id: "g-theirs", seq: 9, move: "xenos pass booster3.", committed_at: "2026-07-08T10:00:00Z" },
      {
        game_id: "g-finished",
        seq: 42,
        move: "nevlas federation 1A4,9A9,9B4,9C fed4.",
        committed_at: "2026-07-06T12:00:00Z",
      },
    ]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    let titles = wrapper.findAll(".game-bar__title").wrappers.map((node) => node.text());
    expect(titles).to.deep.equal(["My gameStandard"]);
    let summaries = wrapper.findAll(".game-bar__summary").wrappers.map((node) => node.text());
    expect(summaries).to.deep.equal(["55m ago Terrans up int."]);

    const lobbyTab = wrapper
      .findAll("button")
      .filter((b) => b.text().includes("Lobby"))
      .at(0);
    await lobbyTab.trigger("click");
    await Vue.nextTick();

    titles = wrapper.findAll(".game-bar__title").wrappers.map((node) => node.text());
    expect(titles).to.deep.equal(["Open tableStandard"]);
    expect(wrapper.findAll(".game-bar__seats").wrappers.map((node) => node.text())).to.deep.equal(["1/3"]);
    summaries = wrapper.findAll(".game-bar__summary").wrappers.map((node) => node.text());
    expect(summaries).to.deep.equal([]);

    const activeTab = wrapper
      .findAll("button")
      .filter((b) => b.text().includes("Active"))
      .at(0);
    await activeTab.trigger("click");
    await Vue.nextTick();

    titles = wrapper.findAll(".game-bar__title").wrappers.map((node) => node.text());
    expect(titles).to.deep.equal(["Their gameSilent Auction"]);
    summaries = wrapper.findAll(".game-bar__summary").wrappers.map((node) => node.text());
    expect(summaries).to.deep.equal(["2h ago Xenos pass booster3."]);

    const finishedTab = wrapper
      .findAll("button")
      .filter((b) => b.text().includes("Finished"))
      .at(0);
    await finishedTab.trigger("click");
    await Vue.nextTick();

    titles = wrapper.findAll(".game-bar__title").wrappers.map((node) => node.text());
    expect(titles).to.deep.equal(["Finished theirsSilent Auction"]);
    summaries = wrapper.findAll(".game-bar__summary").wrappers.map((node) => node.text());
    expect(summaries).to.deep.equal(["2d ago Nevlas form fed."]);
  });

  it("never pins the browsed tab into the URL, so returning to the main menu always lands on My games", async () => {
    // Owner's standing rule: coming back to the main menu by ANY route lands on My games, never on
    // Lobby. Tab clicks used to `replaceState` a `?tab=` onto the lobby's history entry, so a
    // player who browsed Lobby, opened a game, then swiped back was dropped on Lobby again.
    const { client } = makeClient(membershipGames);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect((wrapper.vm as any).activeTab).to.equal("mine");

    const lobbyTab = wrapper
      .findAll("button")
      .filter((b) => b.text().includes("Lobby"))
      .at(0);
    await lobbyTab.trigger("click");
    await Vue.nextTick();

    expect((wrapper.vm as any).activeTab).to.equal("open");
    expect(window.location.search, "browsing a tab must not rewrite the URL").to.equal("");

    // Same URL the swipe-back / back-arrow / PWA start_url all land on: no tab, so My games.
    const returned = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();
    expect((returned.vm as any).activeTab).to.equal("mine");
  });

  it("honours an explicit ?tab= deep link", async () => {
    window.history.replaceState({}, "", "/?lobby=1&tab=finished");
    const { client } = makeClient(membershipGames);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect((wrapper.vm as any).activeTab).to.equal("finished");
  });

  it("excludes a finished game the current user played from My games, showing it only under Finished", async () => {
    const myFinishedGame = {
      id: "g-mine-finished",
      name: "My finished game",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "finished",
      current_seat: null,
      latest_move_summary: "Terrans pass booster3.",
      players: [
        {
          seat: 0,
          invited_email: "kim.pham.nguyen2@gmail.com",
          user_id: "user-admin",
          display_name: "Admin",
          faction: "terrans",
          score: 20,
        },
      ],
    };
    const { client } = makeClient([...membershipGames, myFinishedGame]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    const mineTab = wrapper
      .findAll("button")
      .filter((b) => b.text().includes("My games"))
      .at(0);
    await mineTab.trigger("click");
    await Vue.nextTick();

    let titles = wrapper.findAll(".game-bar__title").wrappers.map((node) => node.text());
    expect(
      titles.some((t) => t.includes("My finished game")),
      "a finished game should not appear under My games"
    ).to.equal(false);

    const finishedTab = wrapper
      .findAll("button")
      .filter((b) => b.text().includes("Finished"))
      .at(0);
    await finishedTab.trigger("click");
    await Vue.nextTick();

    titles = wrapper.findAll(".game-bar__title").wrappers.map((node) => node.text());
    expect(titles.some((t) => t.includes("My finished game"))).to.equal(true);
  });

  it("orders games your-turn first, then by most-recent-move (not longest-waiting)", async () => {
    const games = [
      {
        id: "g-old-not-my-turn",
        name: "Old game",
        created_by: "user-admin",
        player_count: 2,
        options: {},
        status: "active",
        current_seat: 0,
        latest_move_summary: "Nevlas up int.",
        players: [
          {
            seat: 0,
            invited_email: "someone-else@example.com",
            user_id: "user-other",
            display_name: "Other",
            faction: "nevlas",
            score: 10,
          },
          {
            seat: 1,
            invited_email: "kim.pham.nguyen2@gmail.com",
            user_id: "user-admin",
            display_name: "Admin",
            faction: "terrans",
            score: 8,
          },
        ],
      },
      {
        id: "g-recent-not-my-turn",
        name: "Recent game",
        created_by: "user-admin",
        player_count: 2,
        options: {},
        status: "active",
        current_seat: 0,
        latest_move_summary: "Nevlas up nav.",
        players: [
          {
            seat: 0,
            invited_email: "someone-else@example.com",
            user_id: "user-other",
            display_name: "Other",
            faction: "nevlas",
            score: 10,
          },
          {
            seat: 1,
            invited_email: "kim.pham.nguyen2@gmail.com",
            user_id: "user-admin",
            display_name: "Admin",
            faction: "terrans",
            score: 8,
          },
        ],
      },
      {
        id: "g-my-turn-oldest-move",
        name: "My turn, oldest move",
        created_by: "user-admin",
        player_count: 2,
        options: {},
        status: "active",
        current_seat: 1,
        latest_move_summary: "Nevlas pass.",
        players: [
          {
            seat: 0,
            invited_email: "someone-else@example.com",
            user_id: "user-other",
            display_name: "Other",
            faction: "nevlas",
            score: 10,
          },
          {
            seat: 1,
            invited_email: "kim.pham.nguyen2@gmail.com",
            user_id: "user-admin",
            display_name: "Admin",
            faction: "terrans",
            score: 8,
          },
        ],
      },
    ];
    const { client } = makeClient(games, [
      { game_id: "g-old-not-my-turn", seq: 1, move: "nevlas up int.", committed_at: "2026-07-08T09:00:00Z" },
      { game_id: "g-recent-not-my-turn", seq: 1, move: "nevlas up nav.", committed_at: "2026-07-08T11:30:00Z" },
      { game_id: "g-my-turn-oldest-move", seq: 1, move: "nevlas pass.", committed_at: "2026-07-08T05:00:00Z" },
    ]);
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "mine" });
    await Vue.nextTick();

    const titles = wrapper.findAll(".game-bar__title").wrappers.map((node) => node.text());
    expect(titles).to.deep.equal(["My turn, oldest moveStandard", "Recent gameStandard", "Old gameStandard"]);
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
          players: [
            {
              seat: 0,
              invited_email: "kim.pham.nguyen2@gmail.com",
              user_id: "user-admin",
              display_name: "Admin",
              faction: "ivits",
              score: 20,
            },
          ],
        },
      ],
      [{ game_id: "g-fallback", seq: 6, move: "ivits up int.", committed_at: "2026-07-08T11:05:00Z" }]
    );
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "mine" });
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

    wrapper.setData({ activeTab: "mine" });
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
        {
          seat: 0,
          invited_email: "alice@example.com",
          user_id: "user-admin",
          display_name: "Alice",
          faction: "terrans",
          score: 20,
        },
        {
          seat: 1,
          invited_email: "bob@example.com",
          user_id: "user-other",
          display_name: "Bob",
          faction: "nevlas",
          score: 21,
        },
      ],
    };
    const { client, setPresenceState } = makeClient(
      [game],
      [{ game_id: "g-yellow", seq: 3, move: "terrans up int.", committed_at: "2026-07-08T11:05:00Z" }]
    );
    setPresenceState({
      "user-admin": [{ context: { type: "lobby" }, focused: true }],
      "user-other": [{ context: { type: "game", gameId: "other-game" }, focused: true }],
    });
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ activeTab: "mine" });
    await Vue.nextTick();

    const presenceDots = wrapper.findAll(".game-bar__presence");
    expect(presenceDots.at(0).classes()).to.contain("game-bar__presence--yellow");
    expect(presenceDots.at(1).classes()).to.contain("game-bar__presence--yellow");
  });

  it("clicking the online-count indicator reveals who's online, labeling the current user as You", async () => {
    const game = {
      id: "g-online-popup",
      name: "Presence game",
      created_by: "user-admin",
      player_count: 2,
      options: {},
      status: "active",
      current_seat: 0,
      current_round: 1,
      latest_move_summary: "Terrans up int.",
      players: [
        {
          seat: 0,
          invited_email: "alice@example.com",
          user_id: "user-admin",
          display_name: "Alice",
          faction: "terrans",
          score: 20,
        },
        {
          seat: 1,
          invited_email: "bob@example.com",
          user_id: "user-other",
          display_name: "Bob",
          faction: "nevlas",
          score: 21,
        },
      ],
    };
    const { client, setPresenceState } = makeClient([game], []);
    setPresenceState({
      "user-admin": [{ context: { type: "lobby" }, focused: true }],
      "user-other": [{ context: { type: "game", gameId: "other-game" }, focused: true }],
    });
    const wrapper = mount(Lobby, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.find(".lobby-online-popup").exists()).to.equal(false);
    await wrapper.find(".lobby-online").trigger("click");
    expect(wrapper.find(".lobby-online-popup").exists()).to.equal(true);
    expect(wrapper.text()).to.include("You");
    expect(wrapper.text()).to.include("Bob");
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
        players: [
          { seat: 0, invited_email: "kim.pham.nguyen2@gmail.com", user_id: "user-admin", display_name: "Admin" },
        ],
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
          {
            seat: 0,
            invited_email: "alice@example.com",
            user_id: "user-other",
            display_name: "Alice",
            faction: "terrans",
            score: 10,
          },
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

  it("shows online and offline new-game links for a non-admin too", async () => {
    const { client } = makeClient([]);
    const wrapper = mount(Lobby, { propsData: { client, session: otherSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.find('a[href="?create=1"]').exists()).to.equal(true);
    expect(wrapper.find('a[href="?offline=1"]').exists()).to.equal(true);
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
          {
            seat: 0,
            invited_email: "alice@example.com",
            user_id: "user-other",
            display_name: "Alice",
            faction: "terrans",
            score: 28,
          },
          {
            seat: 1,
            invited_email: "bob@example.com",
            user_id: "user-friend",
            display_name: "Bob",
            faction: "xenos",
            score: 24,
          },
        ],
      },
    ]);
    setMoves([{ game_id: "g-live", seq: 5, move: "terrans up int.", committed_at: "2026-07-08T11:05:00Z" }]);
    emitGamesChange();
    await Vue.nextTick();
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
    expect(wrapper.find(".info-modal").text()).to.contain("Edit nickname");

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
