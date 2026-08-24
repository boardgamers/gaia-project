import { expect } from "chai";
import { Faction, Player as PlayerEnum } from "../enums";
import {
  defaultPreferenceSplitBudget,
  isValidPreferenceSplitBudget,
  PreferenceSplitBid,
  preferenceSplitBidError,
  resolvePreferenceSplitAuction,
  roundVictoryPoints,
} from "./preference-split-auction";

const FACTIONS = [Faction.Itars, Faction.Taklons, Faction.Xenos, Faction.Gleens];
const PLAYERS = [PlayerEnum.Player1, PlayerEnum.Player2, PlayerEnum.Player3, PlayerEnum.Player4];

/** `{ p1: [f1, f2, f3, f4], ... }` in FACTIONS order -> the flat bid list the resolver takes. */
function bidsFrom(vectors: number[][], factions = FACTIONS): PreferenceSplitBid[] {
  const bids: PreferenceSplitBid[] = [];
  vectors.forEach((vector, seat) => {
    vector.forEach((points, index) => {
      bids.push({ player: PLAYERS[seat], faction: factions[index], points });
    });
  });
  return bids;
}

/** A deterministic stand-in for the engine's seeded PRNG - cycles through the given values. */
function seededRandom(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

/**
 * The required end-to-end fixture, adapted to this project's factions. Every faction totals 40, so
 * the whole faction ranking is a four-way tie that has to be broken at random.
 */
const ALL_TIED = [
  [20, 12, 6, 2],
  [14, 15, 8, 3],
  [4, 11, 17, 8],
  [2, 2, 9, 27],
];

/**
 * A deliberately tie-free fixture, so allocation and payments can be asserted exactly.
 *
 * Totals: Itars 20+16+2+0 = 38, Taklons 12+14+6+4 = 36, Xenos 6+8+10+11 = 35, Gleens 2+2+22+25 = 51.
 * Ranking (highest total first): Gleens 51 (avg 12.75), Itars 38 (9.5), Taklons 36 (9), Xenos 35 (8.75).
 */
const NO_TIES = [
  [20, 12, 6, 2],
  [16, 14, 8, 2],
  [2, 6, 10, 22],
  [0, 4, 11, 25],
];

describe("Preference Split Auction", () => {
  describe("roundVictoryPoints", () => {
    it("rounds half up and leaves whole numbers alone", () => {
      expect(roundVictoryPoints(0)).to.equal(0);
      expect(roundVictoryPoints(8.49)).to.equal(8);
      expect(roundVictoryPoints(8.5)).to.equal(9);
      expect(roundVictoryPoints(8.51)).to.equal(9);
      expect(roundVictoryPoints(9.5)).to.equal(10); // .5 always goes up, never to-even
      expect(roundVictoryPoints(12.75)).to.equal(13);
      expect(roundVictoryPoints(10)).to.equal(10);
    });
  });

  describe("submission validation", () => {
    const entries = (points: number[]) =>
      FACTIONS.map((faction, i) => ({ faction: faction as string, points: points[i] }));

    it("accepts a split that uses exactly the whole budget", () => {
      expect(preferenceSplitBidError(entries([18, 12, 7, 3]), FACTIONS, 40)).to.equal(null);
      // A 0 bid is legal, including three of them.
      expect(preferenceSplitBidError(entries([40, 0, 0, 0]), FACTIONS, 40)).to.equal(null);
    });

    it("rejects a total below the budget", () => {
      expect(preferenceSplitBidError(entries([18, 12, 7, 2]), FACTIONS, 40)).to.match(/1 of your 40 bid points left/);
    });

    it("rejects a total above the budget", () => {
      expect(preferenceSplitBidError(entries([18, 12, 7, 5]), FACTIONS, 40)).to.match(/2 more than your 40/);
    });

    it("rejects negative and fractional bids", () => {
      expect(preferenceSplitBidError(entries([41, -1, 0, 0]), FACTIONS, 40)).to.match(/cannot be negative/);
      expect(preferenceSplitBidError(entries([18.5, 11.5, 7, 3]), FACTIONS, 40)).to.match(/whole numbers/);
      expect(preferenceSplitBidError(entries([NaN, 0, 0, 0]), FACTIONS, 40)).to.match(/has to be a number/);
    });

    it("requires exactly one bid per faction up for auction", () => {
      expect(preferenceSplitBidError(entries([18, 12, 10, 0]).slice(0, 3), FACTIONS, 40)).to.match(/all 4 factions/);
      const duplicate = [
        { faction: Faction.Itars as string, points: 20 },
        { faction: Faction.Itars as string, points: 10 },
        { faction: Faction.Taklons as string, points: 5 },
        { faction: Faction.Xenos as string, points: 5 },
      ];
      expect(preferenceSplitBidError(duplicate, FACTIONS, 40)).to.match(/once per faction/);
      const foreign = [...entries([18, 12, 7, 3])];
      foreign[3] = { faction: Faction.Ambas as string, points: 3 };
      expect(preferenceSplitBidError(foreign, FACTIONS, 40)).to.match(/not up for auction/);
    });

    it("rejects an invalid budget outright", () => {
      expect(isValidPreferenceSplitBudget(defaultPreferenceSplitBudget(4))).to.equal(true);
      expect(isValidPreferenceSplitBudget(0)).to.equal(false);
      expect(isValidPreferenceSplitBudget(-5)).to.equal(false);
      expect(isValidPreferenceSplitBudget(12.5)).to.equal(false);
      expect(isValidPreferenceSplitBudget(1000)).to.equal(false);
      expect(preferenceSplitBidError(entries([18, 12, 7, 3]), FACTIONS, 40.5)).to.match(/whole number between/);
    });

    it("is enforced by the resolver too, not only by the move handler", () => {
      expect(() =>
        resolvePreferenceSplitAuction(
          FACTIONS,
          PLAYERS,
          bidsFrom([
            [20, 12, 6, 2],
            [14, 15, 8, 3],
            [4, 11, 17, 8],
            [2, 2, 9, 26],
          ]),
          40
        )
      ).to.throw(/not a legal split/);
    });

    it("needs at least two players and exactly one faction per player", () => {
      expect(() =>
        resolvePreferenceSplitAuction(FACTIONS.slice(0, 1), PLAYERS.slice(0, 1), bidsFrom(NO_TIES), 40)
      ).to.throw(/at least 2 players/);
      // Four factions, three players - the pick round can never produce this, but the resolver is
      // the last line of defence for a hand-edited move log.
      expect(() =>
        resolvePreferenceSplitAuction(FACTIONS, PLAYERS.slice(0, 3), bidsFrom(NO_TIES).slice(0, 12), 40)
      ).to.throw(/one faction per player/);
    });
  });

  describe("resolution", () => {
    it("ranks factions by their total bid, highest first", () => {
      const result = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bidsFrom(NO_TIES), 40, seededRandom([0]));

      expect(result.order).to.deep.equal([Faction.Gleens, Faction.Itars, Faction.Taklons, Faction.Xenos]);
      expect(result.factions.map((f) => f.total)).to.deep.equal([51, 38, 36, 35]);
      expect(result.factions.map((f) => f.average)).to.deep.equal([12.75, 9.5, 9, 8.75]);
      expect(result.factions.map((f) => f.rank)).to.deep.equal([1, 2, 3, 4]);
      expect(result.factions.every((f) => f.tiedWith.length === 0)).to.equal(true);
    });

    it("awards each faction to the highest bidder who is still unassigned", () => {
      const result = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bidsFrom(NO_TIES), 40, seededRandom([0]));

      // Gleens (rank 1): p4 bid 25, the highest of all four.
      // Itars (rank 2): p1 bid 20, highest among the three still in the running.
      // Taklons (rank 3): p2 bid 14 (p1/p4 are out; p3 bid 6).
      // Xenos (rank 4): only p3 is left.
      expect(result.allocations.map((a) => [a.faction, a.winner])).to.deep.equal([
        [Faction.Gleens, PlayerEnum.Player4],
        [Faction.Itars, PlayerEnum.Player1],
        [Faction.Taklons, PlayerEnum.Player2],
        [Faction.Xenos, PlayerEnum.Player3],
      ]);
    });

    it("excludes already-assigned players from later allocations", () => {
      const result = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bidsFrom(NO_TIES), 40, seededRandom([0]));

      expect(result.allocations.map((a) => a.eligible.length)).to.deep.equal([4, 3, 2, 1]);
      // p4 took Gleens first and is gone from every later pool, even though their 11 on Xenos was
      // the highest bid anyone made on it.
      expect(result.allocations[1].eligible).to.not.include(PlayerEnum.Player4);
      expect(result.allocations[3].eligible).to.deep.equal([PlayerEnum.Player3]);
    });

    it("keeps assigned players' original bids in every faction's total and average", () => {
      const result = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bidsFrom(NO_TIES), 40, seededRandom([0]));

      // Xenos is awarded last, when only p3 remains - but its average still divides all four
      // original bids (6 + 8 + 10 + 11 = 35) by four, not just p3's own.
      const xenos = result.factions.find((f) => f.faction === Faction.Xenos);
      expect(xenos.bids.map((b) => b.points)).to.deep.equal([6, 8, 10, 11]);
      expect(xenos.total).to.equal(35);
      expect(xenos.average).to.equal(8.75);
      expect(result.allocations[3].basePrice).to.equal(8.75);
    });

    it("charges the faction average, whatever the winner bid themselves", () => {
      const result = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bidsFrom(NO_TIES), 40, seededRandom([0]));

      const gleens = result.allocations[0];
      expect(gleens.winnerBid).to.equal(25);
      expect(gleens.basePrice).to.equal(12.75);
      expect(gleens.payment).to.equal(13); // 12.75 rounds up

      for (const allocation of result.allocations) {
        expect(allocation.payment).to.equal(roundVictoryPoints(allocation.basePrice));
      }
    });

    it("charges more than the winner's own bid when the average is higher", () => {
      // Itars totals 22+4+4+6 = 36 (average 9) but is ranked last, by which point only p4 - who bid
      // just 6 on it - is left. They still pay 9: the price is what the table thought Itars was
      // worth, not what p4 happened to put on it.
      const overBid = [
        [22, 14, 2, 2],
        [4, 13, 2, 21],
        [4, 12, 22, 2],
        [6, 4, 16, 14],
      ];
      const result = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bidsFrom(overBid), 40, seededRandom([0]));

      const itars = result.allocations.find((a) => a.faction === Faction.Itars);
      expect(itars.winner).to.equal(PlayerEnum.Player4);
      expect(itars.basePrice).to.equal(9);
      expect(itars.winnerBid).to.equal(6);
      expect(itars.payment).to.equal(9);
      expect(itars.payment).to.be.greaterThan(itars.winnerBid);
    });

    it("charges a player who bid 0 the full average of the faction they end up with", () => {
      // p4 spends their whole budget contesting Itars and Taklons, loses both, and is left with
      // Gleens - which they bid 0 on. They pay its average anyway.
      const zeroBid = [
        [25, 5, 5, 5],
        [5, 25, 5, 5],
        [5, 5, 25, 5],
        [21, 19, 0, 0],
      ];
      const result = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bidsFrom(zeroBid), 40, seededRandom([0]));

      const last = result.allocations[result.allocations.length - 1];
      expect(last.faction).to.equal(Faction.Gleens);
      expect(last.winner).to.equal(PlayerEnum.Player4);
      expect(last.winnerBid).to.equal(0);
      // Gleens's average counts all four original bids (5 + 5 + 5 + 0), including the three from
      // players who had already been assigned elsewhere...
      expect(result.factions.find((f) => f.faction === Faction.Gleens).total).to.equal(15);
      expect(last.basePrice).to.equal(3.75);
      // ...and that, not the winner's 0, is the price.
      expect(last.payment).to.equal(4);
    });

    it("does not let a near-tie between two factions hand one of them over for free", () => {
      // The owner's motivating case (2026-08-05), scaled to four players and a budget of 40: p1
      // rates Itars and Taklons as near-equals and lands on Taklons by a whisker, which under a
      // "never pay more than you bid" cap would have left Itars - a faction the table as a whole
      // valued - going to p2 for nothing at all, purely because p2 bid 0 on it.
      const nearTie = [
        [20, 19, 1, 0],
        [0, 5, 18, 17],
        [1, 2, 20, 17],
        [2, 3, 16, 19],
      ];
      const result = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bidsFrom(nearTie), 40, seededRandom([0]));

      const taklons = result.allocations.find((a) => a.faction === Faction.Taklons);
      expect(taklons.winner).to.equal(PlayerEnum.Player1);

      const itars = result.allocations.find((a) => a.faction === Faction.Itars);
      expect(itars.winner).to.equal(PlayerEnum.Player2);
      expect(itars.winnerBid).to.equal(0);
      expect(itars.basePrice).to.equal(5.75); // 20 + 0 + 1 + 2, over four players
      expect(itars.payment).to.equal(6);
    });

    it("breaks a faction-total tie at random and records who was tied", () => {
      const bids = bidsFrom(ALL_TIED);
      // Every faction totals 40, so the four-way tie is decided entirely by the random source.
      const first = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bids, 40, seededRandom([0.99, 0.99, 0.99]));
      const second = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bids, 40, seededRandom([0, 0, 0]));

      expect(first.factions.map((f) => f.total)).to.deep.equal([40, 40, 40, 40]);
      expect([...first.order].sort()).to.deep.equal([...FACTIONS].sort());
      expect(first.factions.every((f) => f.tiedWith.length === 3)).to.equal(true);
      expect(first.order).to.not.deep.equal(second.order);
      // Same random source -> same order, every time.
      expect(resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bids, 40, seededRandom([0, 0, 0])).order).to.deep.equal(
        second.order
      );
    });

    it("breaks a player tie at random among only the tied eligible players", () => {
      // p1 and p2 both bid 20 on Itars, which is also the top-ranked faction (total 44).
      const playerTie = [
        [20, 12, 6, 2],
        [20, 14, 4, 2],
        [2, 6, 10, 22],
        [2, 4, 9, 25],
      ];
      const bids = bidsFrom(playerTie);
      const toP1 = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bids, 40, seededRandom([0]));
      const toP2 = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bids, 40, seededRandom([0.99]));

      const itarsA = toP1.allocations.find((a) => a.faction === Faction.Itars);
      const itarsB = toP2.allocations.find((a) => a.faction === Faction.Itars);
      expect(itarsA.tiedPlayers).to.deep.equal([PlayerEnum.Player1, PlayerEnum.Player2]);
      expect(itarsA.winner).to.equal(PlayerEnum.Player1);
      expect(itarsB.winner).to.equal(PlayerEnum.Player2);
      // Total points bid across all factions is identical for everyone (that's the whole point of a
      // fixed budget), so it is never used to separate them.
      expect(itarsA.tiedPlayers).to.deep.equal(itarsB.tiedPlayers);
      // Untied allocations record no tiebreak at all.
      expect(toP1.allocations.filter((a) => a.tiedPlayers.length > 0)).to.have.length(1);
    });

    it("gives every player exactly one faction and every faction exactly one winner", () => {
      for (const vectors of [NO_TIES, ALL_TIED]) {
        const result = resolvePreferenceSplitAuction(
          FACTIONS,
          PLAYERS,
          bidsFrom(vectors),
          40,
          seededRandom([0.1, 0.7, 0.3, 0.9])
        );
        expect([...new Set(result.allocations.map((a) => a.winner))]).to.have.length(4);
        expect([...new Set(result.allocations.map((a) => a.faction))]).to.have.length(4);
        expect(result.allocations).to.have.length(4);
      }
    });

    it("rounds every payment with the same half-up rule", () => {
      // Totals 38/36/35/51 -> averages 9.5, 9, 8.75, 12.75, none of them whole.
      const result = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bidsFrom(NO_TIES), 40, seededRandom([0]));

      for (const allocation of result.allocations) {
        expect(allocation.payment).to.equal(roundVictoryPoints(Math.min(allocation.basePrice, allocation.winnerBid)));
        expect(Number.isInteger(allocation.payment)).to.equal(true);
      }
      expect(result.allocations.map((a) => a.payment)).to.deep.equal([13, 10, 9, 9]);
    });

    it("is fully determined by the bids once the random source is fixed", () => {
      const bids = bidsFrom(ALL_TIED);
      const random = () => 0.42;
      const a = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bids, 40, random);
      const b = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bids, 40, random);
      expect(JSON.stringify(a)).to.equal(JSON.stringify(b));
    });

    describe("end-to-end: the four-way-tied fixture", () => {
      // Not asserting a particular random order - only that whatever order comes out is internally
      // consistent, which is what the rules actually promise here.
      const bids = bidsFrom(ALL_TIED);
      const result = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bids, 40, seededRandom([0.3, 0.8, 0.1, 0.6]));

      it("contains all four factions exactly once in the resolved order", () => {
        expect([...result.order].sort()).to.deep.equal([...FACTIONS].sort());
        expect(result.allocations.map((a) => a.faction)).to.deep.equal(result.order);
      });

      it("allocates strictly along that order, never revisiting a player", () => {
        const seen: PlayerEnum[] = [];
        result.allocations.forEach((allocation, index) => {
          expect(allocation.rank).to.equal(index + 1);
          expect(seen).to.not.include(allocation.winner);
          expect(allocation.eligible).to.include(allocation.winner);
          const highest = Math.max(
            ...allocation.eligible.map(
              (player) => bids.find((b) => b.player === player && b.faction === allocation.faction).points
            )
          );
          expect(allocation.winnerBid).to.equal(highest);
          seen.push(allocation.winner);
        });
        expect(seen).to.have.length(4);
      });

      it("prices everything off the original averages, whatever anyone bid", () => {
        for (const allocation of result.allocations) {
          const summary = result.factions.find((f) => f.faction === allocation.faction);
          expect(summary.total).to.equal(40); // every faction, in this fixture
          expect(allocation.basePrice).to.equal(10);
          // Every faction averages 10 here, so every winner pays exactly 10 - including whoever
          // bid less than that on the one they ended up with.
          expect(allocation.payment).to.equal(10);
        }
      });
    });

    describe("end-to-end: the deterministic fixture", () => {
      it("produces exactly this allocation and these payments", () => {
        const result = resolvePreferenceSplitAuction(FACTIONS, PLAYERS, bidsFrom(NO_TIES), 40, () => {
          throw new Error("no tie should ever need the random source here");
        });

        expect(
          result.allocations.map((a) => ({
            faction: a.faction,
            winner: a.winner,
            winnerBid: a.winnerBid,
            basePrice: a.basePrice,
            payment: a.payment,
          }))
        ).to.deep.equal([
          {
            faction: Faction.Gleens,
            winner: PlayerEnum.Player4,
            winnerBid: 25,
            basePrice: 12.75,
            payment: 13,
          },
          {
            faction: Faction.Itars,
            winner: PlayerEnum.Player1,
            winnerBid: 20,
            basePrice: 9.5,
            payment: 10,
          },
          {
            faction: Faction.Taklons,
            winner: PlayerEnum.Player2,
            winnerBid: 14,
            basePrice: 9,
            payment: 9,
          },
          {
            faction: Faction.Xenos,
            winner: PlayerEnum.Player3,
            winnerBid: 10,
            basePrice: 8.75,
            payment: 9,
          },
        ]);
      });
    });
  });

  describe("other player counts", () => {
    it("scales the default budget so the cost per player stays the same", () => {
      expect(defaultPreferenceSplitBudget(2)).to.equal(40);
      expect(defaultPreferenceSplitBudget(3)).to.equal(60);
      expect(defaultPreferenceSplitBudget(4)).to.equal(80);
    });

    it("resolves a three-player auction, averaging over three bids", () => {
      const factions = FACTIONS.slice(0, 3);
      const players = PLAYERS.slice(0, 3);
      // itars 15+9+3 = 27 (avg 9), taklons 10+14+6 = 30 (avg 10), xenos 5+7+21 = 33 (avg 11).
      const bids = bidsFrom(
        [
          [15, 10, 5],
          [9, 14, 7],
          [3, 6, 21],
        ],
        factions
      );
      const result = resolvePreferenceSplitAuction(factions, players, bids, 30, seededRandom([0]));

      expect(result.order).to.deep.equal([Faction.Xenos, Faction.Taklons, Faction.Itars]);
      expect(result.factions.map((f) => f.average)).to.deep.equal([11, 10, 9]);
      expect(result.allocations.map((a) => [a.faction, a.winner, a.payment])).to.deep.equal([
        [Faction.Xenos, PlayerEnum.Player3, 11],
        [Faction.Taklons, PlayerEnum.Player2, 10],
        [Faction.Itars, PlayerEnum.Player1, 9],
      ]);
    });

    it("resolves a two-player auction, where each player simply takes the one they rated higher", () => {
      const factions = FACTIONS.slice(0, 2);
      const players = PLAYERS.slice(0, 2);
      // itars 14+6 = 20 (avg 10), taklons 6+14 = 20 (avg 10) - a total tie, so the order is random,
      // but at two players the order cannot change who gets what: whoever bid more on one bid less
      // on the other.
      const bids = bidsFrom(
        [
          [14, 6],
          [6, 14],
        ],
        factions
      );
      for (const random of [seededRandom([0]), seededRandom([0.99])]) {
        const result = resolvePreferenceSplitAuction(factions, players, bids, 20, random);
        const itars = result.allocations.find((a) => a.faction === Faction.Itars);
        const taklons = result.allocations.find((a) => a.faction === Faction.Taklons);
        expect(itars.winner).to.equal(PlayerEnum.Player1);
        expect(taklons.winner).to.equal(PlayerEnum.Player2);
        expect(itars.payment).to.equal(10);
        expect(taklons.payment).to.equal(10);
      }
    });

    it("always bills the table exactly the budget, whatever the player count", () => {
      // Every faction costs total/N and there are N factions, so the payments sum to the budget
      // before rounding - which is why the default has to scale with the head count.
      const cases: { factions: Faction[]; players: PlayerEnum[]; vectors: number[][]; budget: number }[] = [
        {
          factions: FACTIONS.slice(0, 2),
          players: PLAYERS.slice(0, 2),
          vectors: [
            [14, 6],
            [6, 14],
          ],
          budget: 20,
        },
        {
          factions: FACTIONS.slice(0, 3),
          players: PLAYERS.slice(0, 3),
          vectors: [
            [15, 10, 5],
            [9, 14, 7],
            [3, 6, 21],
          ],
          budget: 30,
        },
        { factions: FACTIONS, players: PLAYERS, vectors: NO_TIES, budget: 40 },
      ];

      for (const { factions, players, vectors, budget } of cases) {
        const result = resolvePreferenceSplitAuction(
          factions,
          players,
          bidsFrom(vectors, factions),
          budget,
          seededRandom([0])
        );
        const exact = result.allocations.reduce((sum, a) => sum + a.basePrice, 0);
        expect(exact).to.equal(budget);
      }
    });
  });
});
