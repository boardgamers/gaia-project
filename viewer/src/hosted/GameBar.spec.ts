import { expect } from "chai";
import { mount } from "@vue/test-utils";
import { RENJU_CELLS } from "../logic/renju";
import GameBar from "./GameBar.vue";

describe("GameBar", () => {
  function game(overrides: Record<string, unknown>) {
    return {
      id: "game-1",
      name: "My game",
      status: "active",
      player_count: 2,
      current_round: 3,
      current_seat: 0,
      latest_move_summary: "Terrans up int.",
      latest_move_committed_at: new Date().toISOString(),
      players: [
        { seat: 0, user_id: "user-me", faction: "terrans", display_name: "Me", score: 12 },
        { seat: 1, user_id: "user-other", faction: "nevlas", display_name: "Other", score: 9 },
      ],
      ...overrides,
    };
  }

  it("links active/finished games to ?game= and open games to ?preview=", () => {
    const active = mount(GameBar, { propsData: { game: game({}), myUserId: "user-me" } });
    expect(active.find("a").attributes("href")).to.equal("?game=game-1");

    const open = mount(GameBar, { propsData: { game: game({ status: "open" }), myUserId: "user-me" } });
    expect(open.find("a").attributes("href")).to.equal("?preview=game-1");
  });

  it("shows the round badge, title, and move summary with age", () => {
    const wrapper = mount(GameBar, { propsData: { game: game({}), myUserId: "user-me" } });
    expect(wrapper.find(".game-bar__round").text()).to.equal("R3");
    expect(wrapper.find(".game-bar__title").text()).to.contain("My game");
    expect(wrapper.find(".game-bar__summary").text()).to.contain("Terrans: up int");
  });

  it("redacts a raw Silent Auction bid vector already cached on the game row", () => {
    const wrapper = mount(GameBar, {
      propsData: {
        game: game({
          options: { auction: "silent" },
          latest_move_summary: "Itars silentBid itars 10 ivits 0 space-giants 10.",
        }),
        myUserId: "user-me",
      },
    });
    const summary = wrapper.find(".game-bar__summary").text();

    expect(summary).to.contain("Itars: bids in");
    expect(summary).not.to.contain("silentBid");
    expect(summary).not.to.contain("ivits 0");
    expect(summary).not.to.contain("space-giants 10");
  });

  it("shows claimed/total seats instead of a round badge for an open game", () => {
    const wrapper = mount(GameBar, {
      propsData: {
        game: game({ status: "open", current_round: null, players: [{ seat: 0, user_id: "user-me" }] }),
        myUserId: "user-me",
      },
    });
    expect(wrapper.find(".game-bar__seats").text()).to.equal("1/2");
    expect(wrapper.find(".game-bar__round").exists()).to.equal(false);
  });

  it("shows a Delete button for a test game the caller owns, and emits delete-test-game on click", async () => {
    const testGame = game({
      created_by: "user-me",
      players: [
        { seat: 0, user_id: "user-me", faction: "terrans", display_name: "Me", score: 12 },
        { seat: 1, user_id: "user-me", faction: "nevlas", display_name: "Me", score: 9 },
      ],
    });
    const wrapper = mount(GameBar, { propsData: { game: testGame, myUserId: "user-me" } });

    const deleteButton = wrapper.find(".game-bar__delete-test-game");
    expect(deleteButton.exists()).to.equal(true);
    await deleteButton.trigger("click");

    expect(wrapper.emitted("delete-test-game")).to.deep.equal([[testGame]]);
  });

  it("uses an explicit game href for non-hosted game lists", () => {
    const wrapper = mount(GameBar, {
      propsData: {
        game: game({ id: "offline-one" }),
        gameHref: "?offline=1&game=offline-one",
        myUserId: "",
      },
    });

    expect(wrapper.find("a").attributes("href")).to.equal("?offline=1&game=offline-one");
  });

  it("does not show a Delete button for a test game owned by someone else", () => {
    const testGame = game({
      created_by: "user-other",
      players: [
        { seat: 0, user_id: "user-other", faction: "terrans", display_name: "Them", score: 12 },
        { seat: 1, user_id: "user-other", faction: "nevlas", display_name: "Them", score: 9 },
      ],
    });
    const wrapper = mount(GameBar, { propsData: { game: testGame, myUserId: "user-me" } });
    expect(wrapper.find(".game-bar__delete-test-game").exists()).to.equal(false);
  });

  // Which sub-game the green pulse is asking for. Every one of these boards belongs to the SAME
  // game row, so without a label the pulse is ambiguous (owner request: "a little tiny icon on the
  // game bar if the pulsing is for Gaia, chess, renju or any other future game").
  describe("turn-kind badges", () => {
    const chessBoard = {
      // White to move, and the viewer is white.
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      white_user: "user-me",
      white_user_2: null,
      black_user: "user-other",
      black_user_2: null,
      white_next_user: null,
      black_next_user: null,
    };
    const renjuBoard = {
      // One black stone played, so it is white's move - and the viewer is white.
      board: "b" + ".".repeat(RENJU_CELLS - 1),
      black_user: "user-other",
      black_user_2: null,
      white_user: "user-me",
      white_user_2: null,
      black_next_user: null,
      white_next_user: null,
    };

    function kinds(wrapper: any): string[] {
      return wrapper.findAll(".game-bar__turn-kind").wrappers.map((w: any) => w.attributes("aria-label"));
    }

    it("shows nothing at all when no sub-game is waiting on this viewer", () => {
      const wrapper = mount(GameBar, {
        propsData: { game: game({ current_seat: 1 }), myUserId: "user-me" },
      });
      expect(wrapper.find(".game-bar__turn-kinds").exists()).to.equal(false);
    });

    it("labels a Gaia turn, a chess move and a renju move independently, in a stable order", () => {
      const gaiaOnly = mount(GameBar, { propsData: { game: game({}), myUserId: "user-me" } });
      expect(kinds(gaiaOnly)).to.deep.equal(["Your Gaia turn"]);

      // Someone else's Gaia turn, but both side boards are on this viewer.
      const sideOnly = mount(GameBar, {
        propsData: {
          game: game({ current_seat: 1, chess_board: chessBoard, renju_board: renjuBoard }),
          myUserId: "user-me",
        },
      });
      expect(kinds(sideOnly)).to.deep.equal(["Your chess move", "Your renju move"]);

      const all = mount(GameBar, {
        propsData: { game: game({ chess_board: chessBoard, renju_board: renjuBoard }), myUserId: "user-me" },
      });
      expect(kinds(all)).to.deep.equal(["Your Gaia turn", "Your chess move", "Your renju move"]);
    });

    it("resolves a seat this viewer holds by invitation rather than by user_id", () => {
      const invited = game({
        players: [
          { seat: 0, invited_email: "Me@Example.com", faction: "terrans", display_name: "Me" },
          { seat: 1, user_id: "user-other", faction: "nevlas", display_name: "Other" },
        ],
      });
      const wrapper = mount(GameBar, {
        propsData: { game: invited, myUserId: "user-me", userEmail: "me@example.com" },
      });
      expect(kinds(wrapper)).to.deep.equal(["Your Gaia turn"]);
    });

    it("never claims an unclaimed seat for an identity-less viewer (the offline game list)", () => {
      // The offline lobby renders this same bar with no user id and no email; "" must not match an
      // unclaimed seat's empty invited_email.
      const offline = game({ players: [{ seat: 0, faction: "terrans", display_name: "P1" }] });
      const wrapper = mount(GameBar, { propsData: { game: offline, myUserId: "" } });
      expect(wrapper.find(".game-bar__turn-kinds").exists()).to.equal(false);
    });

    it("goes quiet on every sub-game once the Gaia game is finished", () => {
      // Owner request: a finished game stops asking for attention - the chess and renju boards stay
      // playable, they just stop pulsing (and, server-side, stop pushing).
      const finished = game({
        status: "finished",
        current_seat: null,
        chess_board: chessBoard,
        renju_board: renjuBoard,
      });
      const wrapper = mount(GameBar, { propsData: { game: finished, myUserId: "user-me" } });
      expect(wrapper.find(".game-bar__turn-kinds").exists()).to.equal(false);
    });
  });

  it("renders one avatar per player with faction initial, score, and a presence dot", () => {
    const wrapper = mount(GameBar, {
      propsData: {
        game: game({}),
        myUserId: "user-me",
        presenceState: { "user-me": [{ context: { type: "game", gameId: "game-1" }, focused: true }] },
      },
    });
    const players = wrapper.findAll(".game-bar__player");
    expect(players.length).to.equal(2);
    expect(wrapper.findAll(".game-bar__score").at(0).text()).to.equal("12");
    expect(wrapper.find(".game-bar__presence--green").exists()).to.equal(true);
  });
});
