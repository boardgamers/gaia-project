import { expect } from "chai";
import Engine, { AuctionVariant } from "./src/engine";
import { Phase } from "./src/enums";
import { logSlice, stripSecret } from "./wrapper";

describe("wrapper stripSecret", () => {
  // Mid-round state: p1 and p2 have bid, p3 is still to move.
  const midBidMoves = Engine.parseMoves(`
      init 3 djfjjv4k
      p1 banFaction terrans
      p2 banFaction lantids
      p3 banFaction hadsch-hallas
      p1 faction itars
      p2 faction xenos
      p3 faction taklons
      p1 silentBid itars 15 xenos 0 taklons 10
      p2 silentBid itars 15 xenos 5 taklons 8
  `);

  function midBidEngine() {
    return new Engine(midBidMoves, { auction: AuctionVariant.Silent });
  }

  it("hides other players' bid values and preference order during the bid phase", () => {
    const engine = midBidEngine();
    expect(engine.phase).to.equal(Phase.SetupSilentBid);

    const forP3 = stripSecret(engine, 2);

    // One entry per (player, faction) pair - the roster only needs the player field.
    expect([...new Set(forP3.silentAuctionBids.map((bid) => bid.player))]).to.deep.equal([0, 1]);
    for (const bid of forP3.silentAuctionBids) {
      expect(bid).to.deep.equal({ player: bid.player });
    }
    expect(forP3.moveHistory.filter((move) => move.includes("silentBid"))).to.deep.equal([
      "p1 silentBid",
      "p2 silentBid",
    ]);
  });

  it("keeps a player's own bid visible to them", () => {
    const forP1 = stripSecret(midBidEngine(), 0);

    expect(forP1.silentAuctionBids[0]).to.deep.equal({
      player: 0,
      faction: "itars",
      max: 15,
    });
    expect(forP1.moveHistory).to.include("p1 silentBid itars 15 xenos 0 taklons 10");
    expect(forP1.moveHistory.filter((move) => move.trim() === "p2 silentBid")).to.have.length(1);
  });

  it("hides everything from spectators (no player argument)", () => {
    const forSpectator = stripSecret(midBidEngine());

    for (const bid of forSpectator.silentAuctionBids) {
      expect(bid).to.deep.equal({ player: bid.player });
    }
    expect(forSpectator.moveHistory.some((move) => /silentBid\s+\S/.test(move))).to.equal(false);
  });

  it("masks the served log via logSlice while the phase is in progress", () => {
    const engine = midBidEngine();
    const slice = logSlice(engine, { player: 2 });

    expect(slice.log.some((move) => /silentBid\s+\S/.test(move))).to.equal(false);
    expect((slice.state as Engine).silentAuctionBids.every((bid) => (bid as any).max === undefined)).to.equal(true);
  });

  it("stops masking once the auction resolves", () => {
    const engine = new Engine([...midBidMoves, "p3 silentBid itars 7 xenos 0 taklons 0"], {
      auction: AuctionVariant.Silent,
    });
    expect(engine.phase).to.equal(Phase.SetupBuilding);

    const forSpectator = stripSecret(engine);
    expect(forSpectator.moveHistory).to.include("p1 silentBid itars 15 xenos 0 taklons 10");
    expect(forSpectator.silentAuctionBids[0].max).to.equal(15);
    expect(forSpectator.silentAuctionLog.length).to.be.greaterThan(0);
  });

  it("leaves non-auction games untouched", () => {
    const engine = new Engine(["init 2 randomseed"], {});
    const stripped = stripSecret(engine, 0);
    expect(stripped.moveHistory).to.deep.equal(engine.moveHistory);
  });
});
