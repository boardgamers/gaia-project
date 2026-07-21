import { expect } from "chai";
import { presenceStatus, usersInGame } from "./presence";

describe("presenceStatus", () => {
  it("returns grey when there's no user id", () => {
    expect(presenceStatus({}, null, "game-1")).to.equal("grey");
  });

  it("returns green when the live presence entry is focused on this game", () => {
    const state = { u1: [{ context: { type: "game" as const, gameId: "game-1" }, focused: true }] };
    expect(presenceStatus(state, "u1", "game-1")).to.equal("green");
  });

  it("returns yellow when the live presence entry is elsewhere", () => {
    const state = { u1: [{ context: { type: "lobby" as const }, focused: true }] };
    expect(presenceStatus(state, "u1", "game-1")).to.equal("yellow");
  });

  it("falls back to yellow when there's no live presence but lastActiveAt is within 10 minutes", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(presenceStatus({}, "u1", "game-1", fiveMinutesAgo)).to.equal("yellow");
  });

  it("returns grey when there's no live presence and lastActiveAt is more than 10 minutes old", () => {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60_000).toISOString();
    expect(presenceStatus({}, "u1", "game-1", twentyMinutesAgo)).to.equal("grey");
  });

  it("returns grey when there's no live presence and no lastActiveAt at all", () => {
    expect(presenceStatus({}, "u1", "game-1", null)).to.equal("grey");
  });

  it("prefers live presence over a stale lastActiveAt", () => {
    const state = { u1: [{ context: { type: "game" as const, gameId: "game-1" }, focused: true }] };
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60_000).toISOString();
    expect(presenceStatus(state, "u1", "game-1", twentyMinutesAgo)).to.equal("green");
  });
});

describe("usersInGame", () => {
  it("returns the ids of users with a tab open on this exact game, regardless of focus", () => {
    const state = {
      focused: [{ context: { type: "game" as const, gameId: "game-1" }, focused: true }],
      background: [{ context: { type: "game" as const, gameId: "game-1" }, focused: false }],
      "other-game": [{ context: { type: "game" as const, gameId: "game-2" }, focused: true }],
      "in-lobby": [{ context: { type: "lobby" as const }, focused: true }],
    };
    const ids = usersInGame(state, "game-1");
    expect([...ids].sort()).to.deep.equal(["background", "focused"]);
  });

  it("counts a user with multiple tabs (this game + elsewhere) as in this game", () => {
    const state = {
      u1: [
        { context: { type: "lobby" as const }, focused: false },
        { context: { type: "game" as const, gameId: "game-1" }, focused: false },
      ],
    };
    expect(usersInGame(state, "game-1").has("u1")).to.equal(true);
  });

  it("returns an empty set when nobody is in the game", () => {
    expect(usersInGame({}, "game-1").size).to.equal(0);
  });
});
