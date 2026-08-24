import { expect } from "chai";
import { Faction, Player as PlayerEnum } from "../enums";
import { MAX_SILENT_BID, resolveSilentAuction, SilentAuctionBid, silentAuctionBidError } from "./silent-auction";

describe("resolveSilentAuction", () => {
  // Reproduces the worked example from the community "Faction Auction" guide
  // (https://steamcommunity.com/sharedfiles/filedetails/?id=2506595080) move for move, to lock in
  // that this implementation matches the guide's algorithm and tiebreak rules exactly.
  //
  // "You" (A) ends up winning Taklons for 2 VP (10 max - 8 value quoted in the guide), B wins
  // Itars for 8, C wins Xenos for 0 - even though A was briefly the highest bidder on Itars.
  it("reproduces the guide's worked example", () => {
    const A = PlayerEnum.Player1;
    const B = PlayerEnum.Player2;
    const C = PlayerEnum.Player3;
    const factions = [Faction.Itars, Faction.Taklons, Faction.Xenos];

    const bids: SilentAuctionBid[] = [
      { player: A, faction: Faction.Itars, max: 15 },
      { player: A, faction: Faction.Taklons, max: 10 },
      { player: A, faction: Faction.Xenos, max: 0 },
      { player: B, faction: Faction.Itars, max: 15 },
      { player: B, faction: Faction.Taklons, max: 8 },
      { player: B, faction: Faction.Xenos, max: 5 },
      { player: C, faction: Faction.Itars, max: 7 },
      { player: C, faction: Faction.Taklons, max: 0 },
      { player: C, faction: Faction.Xenos, max: 0 },
    ];

    const nominatedFaction = new Map([
      [A, Faction.Itars],
      [B, Faction.Xenos],
      [C, Faction.Taklons],
    ]);

    // Only one tiebreak in the whole trace reaches rule #3 (random): B's turn 11, indifferent
    // between Itars and Taklons. Force it to pick the 2nd candidate (Taklons), as the guide does.
    const result = resolveSilentAuction(factions, [A, B, C], bids, nominatedFaction, () => 0.99);

    expect(result.winners.get(Faction.Taklons)).to.equal(A);
    expect(result.winners.get(Faction.Itars)).to.equal(B);
    expect(result.winners.get(Faction.Xenos)).to.equal(C);

    expect(result.prices.get(Faction.Taklons)).to.equal(2);
    expect(result.prices.get(Faction.Itars)).to.equal(8);
    expect(result.prices.get(Faction.Xenos)).to.equal(0);

    // 15 real moves (as enumerated in the guide) plus the final skip-round (3 skips) that
    // terminates the auction, which the guide describes but doesn't number.
    expect(result.log).to.have.length(18);
    expect(result.log[8]).to.deep.include({ player: C, faction: Faction.Itars, price: 7, tiebreak: "existing" });
    expect(result.log[9]).to.deep.include({ player: A, faction: Faction.Taklons, skipped: true });
    expect(result.log[10]).to.deep.include({ player: B, faction: Faction.Taklons, price: 1, tiebreak: "random" });
    expect(result.log[11]).to.deep.include({ player: C, faction: Faction.Itars, skipped: true });
    expect(result.log[12]).to.deep.include({ player: A, faction: Faction.Taklons, price: 2 });
  });

  it("is a no-op single-player auction: the lone player wins every faction for 0", () => {
    const A = PlayerEnum.Player1;
    const factions = [Faction.Itars];
    const bids: SilentAuctionBid[] = [{ player: A, faction: Faction.Itars, max: 12 }];

    const result = resolveSilentAuction(factions, [A], bids, new Map());

    expect(result.winners.get(Faction.Itars)).to.equal(A);
    expect(result.prices.get(Faction.Itars)).to.equal(0);
  });

  it("gives a faction away for 0 when only one player values it above 0", () => {
    const A = PlayerEnum.Player1;
    const B = PlayerEnum.Player2;
    const factions = [Faction.Itars, Faction.Taklons];
    const bids: SilentAuctionBid[] = [
      { player: A, faction: Faction.Itars, max: 10 },
      { player: A, faction: Faction.Taklons, max: 0 },
      { player: B, faction: Faction.Itars, max: 0 },
      { player: B, faction: Faction.Taklons, max: 0 },
    ];

    const result = resolveSilentAuction(factions, [A, B], bids, new Map());

    expect(result.winners.get(Faction.Itars)).to.equal(A);
    expect(result.winners.get(Faction.Taklons)).to.equal(B);
    expect(result.prices.get(Faction.Itars)).to.equal(0);
    expect(result.prices.get(Faction.Taklons)).to.equal(0);
  });
});

// The one rule set every layer checks a submission against: the engine's `moveSilentBid`, the bid
// form's submit button, and - mirrored in SQL - `submit_sealed_bid`, which is what actually guards
// a hosted submission because the bids never reach the engine until the reveal.
describe("silentAuctionBidError", () => {
  const factions = [Faction.Itars, Faction.Taklons, Faction.Xenos];
  const bid = (itars: number, taklons: number, xenos: number) => [
    { faction: Faction.Itars as string, points: itars },
    { faction: Faction.Taklons as string, points: taklons },
    { faction: Faction.Xenos as string, points: xenos },
  ];

  it("accepts any independent whole bids from 0 up to the ceiling - there is no budget", () => {
    // Unlike the Preference Split, nothing here has to add up: these three totals are 40, 0 and 120.
    expect(silentAuctionBidError(bid(15, 15, 10), factions)).to.equal(null);
    expect(silentAuctionBidError(bid(0, 0, 0), factions)).to.equal(null);
    expect(silentAuctionBidError(bid(MAX_SILENT_BID, MAX_SILENT_BID, MAX_SILENT_BID), factions)).to.equal(null);
  });

  it("requires exactly one bid on every faction up for auction", () => {
    expect(silentAuctionBidError(bid(1, 2, 3).slice(0, 2), factions)).to.match(/all 3 factions/);
    expect(silentAuctionBidError([...bid(1, 2, 3), { faction: Faction.Gleens, points: 4 }], factions)).to.match(
      /all 3 factions/
    );
    expect(
      silentAuctionBidError(
        [
          { faction: Faction.Itars, points: 1 },
          { faction: Faction.Itars, points: 2 },
          { faction: Faction.Xenos, points: 3 },
        ],
        factions
      )
    ).to.match(/only bid once/);
    expect(
      silentAuctionBidError(
        [
          { faction: Faction.Itars, points: 1 },
          { faction: Faction.Taklons, points: 2 },
          { faction: Faction.Gleens, points: 3 },
        ],
        factions
      )
    ).to.match(/not up for auction/);
  });

  it("rejects a bid that is negative, fractional, or above the ceiling", () => {
    expect(silentAuctionBidError(bid(-1, 0, 0), factions)).to.match(/whole, non-negative/);
    expect(silentAuctionBidError(bid(1.5, 0, 0), factions)).to.match(/whole, non-negative/);
    expect(silentAuctionBidError(bid(MAX_SILENT_BID + 1, 0, 0), factions)).to.match(/higher than 40/);
  });
});
