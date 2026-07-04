import { expect } from "chai";
import { Faction, Player as PlayerEnum } from "../enums";
import { resolveSilentAuction, SilentAuctionBid } from "./silent-auction";

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
