import { expect } from "chai";
import { AvailableCommand } from "./available/types";
import Engine, { AuctionVariant, EngineOptions } from "./engine";
import { Command, Faction, Phase, Player as PlayerEnum } from "./enums";

/** A fresh options object per engine: Engine mutates the one it is given (it stamps the generated
 * map into it), so sharing one between two engines in the same test is not safe. */
const options = (extra: Partial<EngineOptions> = {}): EngineOptions => ({
  auction: AuctionVariant.PreferenceSplit,
  ...extra,
});

const picks = `
      init 4 djfjjv4k
      p1 faction itars
      p2 faction taklons
      p3 faction xenos
      p4 faction terrans
`;

/**
 * The deterministic fixture (no faction-total tie, no player tie), so allocation and payments can
 * be asserted exactly - the same numbers as algorithms/preference-split-auction.spec.ts.
 *
 * Totals: itars 38 (avg 9.5), taklons 36 (9), xenos 35 (8.75), terrans 51 (12.75).
 */
const deterministicBids = `
      p1 preferenceBid itars 20 taklons 12 xenos 6 terrans 2
      p2 preferenceBid itars 16 taklons 14 xenos 8 terrans 2
      p3 preferenceBid itars 2 taklons 6 xenos 10 terrans 22
      p4 preferenceBid itars 0 taklons 4 xenos 11 terrans 25
`;

/** The required end-to-end fixture: every faction totals exactly 40, so the entire faction order
 * has to be settled at random. */
const allTiedBids = `
      p1 preferenceBid itars 20 taklons 12 xenos 6 terrans 2
      p2 preferenceBid itars 14 taklons 15 xenos 8 terrans 3
      p3 preferenceBid itars 4 taklons 11 xenos 17 terrans 8
      p4 preferenceBid itars 2 taklons 2 xenos 9 terrans 27
`;

/** `Engine.parseMoves` keeps blank lines, and the fixtures above are concatenated - so drop them.
 *
 * The bid vectors above were written against a 40-point, four-player table, so pin that budget here
 * instead of leaning on the scaled default - the default moved to 20 points per player in 2026-08
 * and the fixtures should stay readable rather than track it. Tests that are about the default
 * itself build their engine directly from `options()`. */
const engineFor = (moves: string, extra: Partial<EngineOptions> = {}) =>
  new Engine(
    Engine.parseMoves(moves).filter((move) => move.length > 0),
    options({ auctionBudget: 40, ...extra })
  );

describe("Preference Split Auction variant", () => {
  describe("the deterministic fixture, end to end", () => {
    let engine: Engine;

    beforeEach(() => {
      engine = engineFor(picks + deterministicBids);
    });

    it("assigns every faction to the highest remaining bidder and charges the capped average", () => {
      const result = engine.preferenceSplitResult;

      expect(result.budget).to.equal(40);
      expect(result.order).to.deep.equal([Faction.Terrans, Faction.Itars, Faction.Taklons, Faction.Xenos]);
      expect(result.factions.map((f) => f.total)).to.deep.equal([51, 38, 36, 35]);
      expect(result.factions.map((f) => f.average)).to.deep.equal([12.75, 9.5, 9, 8.75]);
      expect(result.allocations.map((a) => a.payment)).to.deep.equal([13, 10, 9, 9]);

      expect(engine.players.map((pl) => pl.faction)).to.deep.equal([
        Faction.Itars,
        Faction.Taklons,
        Faction.Xenos,
        Faction.Terrans,
      ]);
      expect(engine.players.map((pl) => pl.data.bid)).to.deep.equal([10, 9, 9, 13]);
    });

    it("gives every player exactly one faction and every faction exactly one winner", () => {
      const winners = engine.preferenceSplitResult.allocations.map((a) => a.winner);
      const factions = engine.preferenceSplitResult.allocations.map((a) => a.faction);

      expect(new Set(winners).size).to.equal(4);
      expect(new Set(factions).size).to.equal(4);
      expect(new Set(engine.players.map((pl) => pl.faction)).size).to.equal(4);
    });

    it("continues straight into the building phase, in pick order mapped to the winners", () => {
      expect(engine.phase).to.equal(Phase.SetupBuilding);
      // setup is the pick order (itars, taklons, xenos, terrans); each slot's winner takes that
      // slot in turn order - here the pickers kept their own picks, so it stays 0,1,2,3.
      expect(engine.turnOrderAfterSetupAuction).to.deep.equal([0, 1, 2, 3]);
      expect(engine.playerToMove).to.equal(0);
    });

    it("keeps the whole resolution auditable on the engine", () => {
      const terrans = engine.preferenceSplitResult.allocations[0];

      expect(terrans.faction).to.equal(Faction.Terrans);
      expect(terrans.rank).to.equal(1);
      expect(terrans.eligible).to.deep.equal([0, 1, 2, 3]);
      expect(terrans.winner).to.equal(PlayerEnum.Player4);
      expect(terrans.winnerBid).to.equal(25);
      expect(terrans.basePrice).to.equal(12.75);
      expect(terrans.payment).to.equal(13);
      expect(terrans.tiedPlayers).to.deep.equal([]);
      // Every original bid is preserved, including the ones by players who won something else.
      expect(engine.preferenceSplitBids).to.have.length(16);
    });
  });

  describe("the four-way-tied fixture", () => {
    it("resolves the faction order at random, using each faction exactly once", () => {
      const engine = engineFor(picks + allTiedBids);
      const result = engine.preferenceSplitResult;

      expect(result.factions.map((f) => f.total)).to.deep.equal([40, 40, 40, 40]);
      expect([...result.order].sort()).to.deep.equal(
        [Faction.Terrans, Faction.Itars, Faction.Taklons, Faction.Xenos].sort()
      );
      expect(result.factions.every((f) => f.tiedWith.length === 3)).to.equal(true);
    });

    it("allocates along the resolved order and prices everything at the faction average", () => {
      const result = engineFor(picks + allTiedBids).preferenceSplitResult;

      expect(result.allocations.map((a) => a.faction)).to.deep.equal(result.order);
      const assigned: PlayerEnum[] = [];
      for (const allocation of result.allocations) {
        expect(assigned).to.not.include(allocation.winner);
        expect(allocation.eligible).to.include(allocation.winner);
        expect(allocation.basePrice).to.equal(10); // every faction totals 40 here
        // Every faction totals 40 here, so every winner pays 10 - including anyone who bid less
        // than that on the faction they ended up with.
        expect(allocation.payment).to.equal(10);
        assigned.push(allocation.winner);
      }
      expect(assigned).to.have.length(4);
    });

    it("reuses the persisted order after a reload instead of rerolling it", () => {
      const first = engineFor(picks + allTiedBids);

      // A full replay of the same move log (what the hosted app does on every page load).
      const replayed = engineFor(picks + allTiedBids);
      expect(replayed.preferenceSplitResult).to.deep.equal(first.preferenceSplitResult);

      // ...and a state restored from serialized JSON, which never re-runs the resolution at all.
      const restored = Engine.fromData(JSON.parse(JSON.stringify(first)));
      expect(restored.preferenceSplitResult).to.deep.equal(first.preferenceSplitResult);
      expect(restored.players.map((pl) => pl.faction)).to.deep.equal(first.players.map((pl) => pl.faction));
      expect(restored.players.map((pl) => pl.data.bid)).to.deep.equal(first.players.map((pl) => pl.data.bid));
    });
  });

  describe("submission validation", () => {
    it("rejects a total below the budget", () => {
      expect(() => engineFor(picks + "p1 preferenceBid itars 20 taklons 12 xenos 6 terrans 1")).to.throw(
        /1 of your 40 bid points left/
      );
    });

    it("rejects a total above the budget", () => {
      expect(() => engineFor(picks + "p1 preferenceBid itars 20 taklons 12 xenos 6 terrans 3")).to.throw(
        /1 more than your 40/
      );
    });

    it("rejects negative and fractional bids", () => {
      expect(() => engineFor(picks + "p1 preferenceBid itars 41 taklons 12 xenos 6 terrans -19")).to.throw(
        /not a whole, non-negative number/
      );
      // A decimal point can never survive the move format in the first place ("." separates the
      // commands within a turn), so this one is rejected while being parsed rather than by the
      // whole-number guard - either way it never reaches the auction.
      expect(() => engineFor(picks + "p1 preferenceBid itars 20.5 taklons 11.5 xenos 6 terrans 2")).to.throw();
      // The guard itself, on an input the parser does hand through intact.
      expect(() => engineFor(picks + "p1 preferenceBid itars 20e0 taklons 12 xenos 6 terrans 2")).to.throw(
        /not a whole, non-negative number/
      );
    });

    it("requires exactly one bid per faction up for auction", () => {
      expect(() => engineFor(picks + "p1 preferenceBid itars 28 taklons 12")).to.throw(/all 4 factions/);
      expect(() => engineFor(picks + "p1 preferenceBid itars 20 itars 12 xenos 6 terrans 2")).to.throw(
        /once per faction/
      );
      expect(() => engineFor(picks + "p1 preferenceBid itars 20 ambas 12 xenos 6 terrans 2")).to.throw(
        /not up for auction/
      );
    });

    it("accepts exactly one submission per player", () => {
      // p1 tries to submit again in p2's slot: rejected before it can overwrite or double-count.
      expect(() =>
        engineFor(
          picks +
            `
              p1 preferenceBid itars 20 taklons 12 xenos 6 terrans 2
              p1 preferenceBid itars 0 taklons 0 xenos 0 terrans 40
            `
        )
      ).to.throw();
    });

    it("honours a configured budget instead of the default", () => {
      const engine = engineFor(
        picks +
          `
            p1 preferenceBid itars 10 taklons 5 xenos 3 terrans 2
            p2 preferenceBid itars 8 taklons 7 xenos 4 terrans 1
            p3 preferenceBid itars 1 taklons 3 xenos 9 terrans 7
            p4 preferenceBid itars 0 taklons 2 xenos 5 terrans 13
          `,
        { auctionBudget: 20 }
      );

      expect(engine.preferenceSplitResult.budget).to.equal(20);
      // itars 19, taklons 17, xenos 21, terrans 23 -> terrans, xenos, itars, taklons.
      expect(engine.preferenceSplitResult.order).to.deep.equal([
        Faction.Terrans,
        Faction.Xenos,
        Faction.Itars,
        Faction.Taklons,
      ]);
      expect(() =>
        engineFor(picks + "p1 preferenceBid itars 20 taklons 12 xenos 6 terrans 2", { auctionBudget: 20 })
      ).to.throw(/20 more than your 20/);
    });
  });

  describe("preconditions", () => {
    it("is playable at every player count the game itself supports", () => {
      for (const count of [2, 3, 4, 5]) {
        expect(() => new Engine([`init ${count} djfjjv4k`], options())).to.not.throw();
      }
    });

    it("defaults the budget to 20 points per player", () => {
      for (const count of [2, 3, 4, 5]) {
        const engine = new Engine([`init ${count} djfjjv4k`], options());
        expect(engine.preferenceSplitBudget).to.equal(count * 20);
      }
      // An explicit budget always wins over the scaled default.
      expect(new Engine(["init 3 djfjjv4k"], options({ auctionBudget: 44 })).preferenceSplitBudget).to.equal(44);
    });

    it("refuses an invalid bid budget", () => {
      for (const auctionBudget of [0, -10, 12.5, 1000]) {
        expect(() => new Engine(["init 4 djfjjv4k"], options({ auctionBudget }))).to.throw(/bid budget must be/);
      }
    });

    it("refuses forced random factions, which would leave nothing to express a preference over", () => {
      expect(() => new Engine(["init 4 djfjjv4k"], options({ randomFactions: true }))).to.throw(/random factions/);
    });
  });

  describe("secrecy at the engine level", () => {
    it("derives nothing at all until the last submission lands", () => {
      const partial = engineFor(
        picks +
          `
            p1 preferenceBid itars 20 taklons 12 xenos 6 terrans 2
            p2 preferenceBid itars 16 taklons 14 xenos 8 terrans 2
            p3 preferenceBid itars 2 taklons 6 xenos 10 terrans 22
          `
      );

      expect(partial.phase).to.equal(Phase.SetupPreferenceBid);
      expect(partial.preferenceSplitResult).to.equal(undefined);
      // No total, average, ranking or reassignment exists yet - each player still holds only the
      // faction they nominated, at the placeholder bid of 0.
      expect(partial.players.map((pl) => pl.faction)).to.deep.equal([
        Faction.Itars,
        Faction.Taklons,
        Faction.Xenos,
        Faction.Terrans,
      ]);
      expect(partial.players.map((pl) => pl.data.bid)).to.deep.equal([0, 0, 0, 0]);
    });

    it("offers the bidder their budget and the factions, never anybody else's numbers", () => {
      const partial = engineFor(picks + "p1 preferenceBid itars 20 taklons 12 xenos 6 terrans 2");
      partial.generateAvailableCommandsIfNeeded();

      const command = partial.availableCommands.find(
        (c): c is AvailableCommand<Command.PreferenceBid> => c.name === Command.PreferenceBid
      );
      expect(command.player).to.equal(PlayerEnum.Player2);
      expect(command.data.budget).to.equal(40);
      expect(command.data.factions).to.deep.equal([Faction.Itars, Faction.Taklons, Faction.Xenos, Faction.Terrans]);
      // The offered amounts are the full 0..budget range for every faction - identical for each of
      // them, so nothing about p1's submitted split can be read off it.
      for (const bid of command.data.bids) {
        expect(bid.bid).to.deep.equal(command.data.bids[0].bid);
      }
      expect(JSON.stringify(command)).to.not.include("preferenceSplitBids");
    });
  });

  describe("smaller tables", () => {
    it("runs the whole flow at three players, averaging over three bids", () => {
      const engine = engineFor(
        `
        init 3 djfjjv4k
        p1 faction itars
        p2 faction taklons
        p3 faction xenos
        p1 preferenceBid itars 15 taklons 10 xenos 5
        p2 preferenceBid itars 9 taklons 14 xenos 7
        p3 preferenceBid itars 3 taklons 6 xenos 21
      `,
        { auctionBudget: 30 }
      );

      expect(engine.phase).to.equal(Phase.SetupBuilding);
      expect(engine.preferenceSplitResult.budget).to.equal(30);
      // itars 27 (avg 9), taklons 30 (avg 10), xenos 33 (avg 11).
      expect(engine.preferenceSplitResult.order).to.deep.equal([Faction.Xenos, Faction.Taklons, Faction.Itars]);
      expect(engine.players.map((pl) => pl.faction)).to.deep.equal([Faction.Itars, Faction.Taklons, Faction.Xenos]);
      expect(engine.players.map((pl) => pl.data.bid)).to.deep.equal([9, 10, 11]);
    });

    it("runs the whole flow at two players", () => {
      const engine = engineFor(
        `
        init 2 djfjjv4k
        p1 faction itars
        p2 faction taklons
        p1 preferenceBid itars 14 taklons 6
        p2 preferenceBid itars 6 taklons 14
      `,
        { auctionBudget: 20 }
      );

      expect(engine.phase).to.equal(Phase.SetupBuilding);
      expect(engine.preferenceSplitResult.budget).to.equal(20);
      // Both factions total 20, so each costs 10 - and each player keeps the one they rated higher.
      expect(engine.players.map((pl) => pl.faction)).to.deep.equal([Faction.Itars, Faction.Taklons]);
      expect(engine.players.map((pl) => pl.data.bid)).to.deep.equal([10, 10]);
    });

    it("still enforces the configured budget exactly", () => {
      // 40 is this fixture's budget; 45 is 5 too many.
      expect(() =>
        engineFor(`
          init 3 djfjjv4k
          p1 faction itars
          p2 faction taklons
          p3 faction xenos
          p1 preferenceBid itars 25 taklons 12 xenos 8
        `)
      ).to.throw(/5 more than your 40/);
    });
  });
});
