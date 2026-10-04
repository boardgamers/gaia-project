import { expect } from "chai";
import { canMoveOutOfTurn, currentPlayer, isLiveUpdate, move, stripSecret, timeIncrements } from "../wrapper";
import Engine, { AuctionVariant } from "./engine";
import { Phase } from "./enums";

/**
 * Simultaneous sealed bidding (boardgamers.space contract). The Silent Auction's bid phase must let
 * every seat still owing a bid submit in ANY order - the platform's `/move` route authorizes a move
 * when the user is in `game.currentPlayers`, which the game-server fills from `currentPlayer()`.
 * Returning a single seat (the old behavior) is what made off-turn bidders hit "not your turn".
 */
describe("Silent Auction - simultaneous sealed bids", () => {
  const auctionOptions = { auction: AuctionVariant.Silent };

  // Ban + faction-pick moves, stopping right before the bid phase.
  const preBidMoves = Engine.parseMoves(`
    init 3 djfjjv4k
    p1 banFaction terrans
    p2 banFaction lantids
    p3 banFaction hadsch-hallas
    p1 faction itars
    p2 faction xenos
    p3 faction taklons
  `);

  const bid = (seat: number, amounts: number[]) =>
    `p${seat + 1} silentBid itars ${amounts[0]} xenos ${amounts[1]} taklons ${amounts[2]}`;

  function toBidPhase(): Engine {
    return new Engine(preBidMoves, auctionOptions);
  }

  it("exposes every pending seat via wrapper.currentPlayer during the bid phase", () => {
    const engine = toBidPhase();
    expect(engine.phase).to.equal(Phase.SetupSilentBid);

    const current = currentPlayer(engine);
    expect(Array.isArray(current) ? current : [current]).to.have.members([0, 1, 2]);
  });

  it("accepts bids in any order and resolves only when the last one lands", () => {
    const engine = toBidPhase();

    // p3 bids FIRST (not p1, whose turn the sequential pointer is on).
    engine.move(bid(2, [7, 0, 0]));
    expect(engine.phase).to.equal(Phase.SetupSilentBid);
    expect(engine.sealedBidPendingSeats()).to.have.members([0, 1]);
    expect(currentPlayer(engine)).to.have.members([0, 1]);

    // p1 bids second.
    engine.move(bid(0, [15, 0, 10]));
    expect(engine.phase).to.equal(Phase.SetupSilentBid);
    expect(engine.sealedBidPendingSeats()).to.deep.equal([1]);

    // p2 bids last - the auction resolves and setup moves on.
    engine.move(bid(1, [15, 5, 8]));
    expect(engine.phase).to.equal(Phase.SetupBuilding);
  });

  it("replaces a submitted bid without clock credit, exposure, or changing pending seats", () => {
    let engine = move(toBidPhase(), bid(2, [7, 0, 0]), 2);
    const increments = [...timeIncrements(engine)];
    const replacement = bid(2, [9, 0, 0]);
    expect(canMoveOutOfTurn(engine, replacement, 2)).to.equal(true);
    expect(canMoveOutOfTurn(engine, replacement, 1)).to.equal(false);
    expect(canMoveOutOfTurn(engine, "p3 build m 0x0", 2)).to.equal(false);
    engine = move(JSON.parse(JSON.stringify(engine)), replacement, 2);
    expect(isLiveUpdate(engine)).to.equal(true);
    expect(timeIncrements(engine)).to.deep.equal(increments);
    expect(currentPlayer(engine)).to.deep.equal([0, 1]);
    expect(engine.silentAuctionBids.filter((b) => b.player === 2)).to.have.length(3);
    expect(stripSecret(engine, 0).silentAuctionBids.every((b) => b.player !== 2 || b.max === undefined)).to.equal(true);
    expect(stripSecret(engine, 0).moveHistory.some((m) => m.includes("itars 9"))).to.equal(false);
    expect(() => move(Engine.fromData(JSON.parse(JSON.stringify(engine))), bid(2, [41, 0, 0]), 2)).to.throw();
    engine = move(engine, bid(0, [15, 0, 10]), 0);
    engine = move(engine, bid(1, [15, 5, 8]), 1);
    expect(engine.phase).to.equal(Phase.SetupBuilding);
    expect(canMoveOutOfTurn(engine, replacement, 2)).to.equal(false);
    expect(() => move(engine, replacement, 2)).to.throw();
  });

  it("rejects a non-bid move from a seat whose turn it isn't, even during the bid phase", () => {
    const engine = toBidPhase();
    // A non-bid command still goes through the strict turn-order check.
    expect(() => engine.move("p2 build m 0x0")).to.throw();
  });

  it("produces the same resolution regardless of submission order", () => {
    // Order A: p1, p2, p3 (seat order).
    const inOrder = new Engine(
      Engine.parseMoves([...preBidMoves, bid(0, [15, 0, 10]), bid(1, [15, 5, 8]), bid(2, [7, 0, 0])].join("\n")),
      auctionOptions
    );
    // Order B: p3, p1, p2 (reverse-ish).
    const outOfOrder = new Engine(
      Engine.parseMoves([...preBidMoves, bid(2, [7, 0, 0]), bid(0, [15, 0, 10]), bid(1, [15, 5, 8])].join("\n")),
      auctionOptions
    );

    for (const e of [inOrder, outOfOrder]) {
      expect(e.players[0].faction).to.equal("taklons");
      expect(e.players[1].faction).to.equal("itars");
      expect(e.players[2].faction).to.equal("xenos");
    }
  });
});
