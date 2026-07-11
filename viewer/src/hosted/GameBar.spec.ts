import { expect } from "chai";
import { mount } from "@vue/test-utils";
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
    expect(wrapper.find(".game-bar__summary").text()).to.contain("Terrans up int.");
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
