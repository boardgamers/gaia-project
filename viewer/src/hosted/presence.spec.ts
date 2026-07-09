import { expect } from "chai";
import { presenceStatus } from "./presence";

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
