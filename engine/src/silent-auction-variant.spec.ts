import { expect } from "chai";
import { MAX_SILENT_BID } from "./algorithms/silent-auction";
import Engine, { AuctionVariant } from "./engine";
import { Command, Faction, Phase } from "./enums";

describe("Silent Auction variant", () => {
  const setupMoves = `
      init 3 djfjjv4k
      p1 banFaction terrans
      p2 banFaction lantids
      p3 banFaction hadsch-hallas
      p1 faction itars
      p2 faction xenos
      p3 faction taklons
      p1 silentBid itars 15 xenos 0 taklons 10
      p2 silentBid itars 15 xenos 5 taklons 8
      p3 silentBid itars 7 xenos 0 taklons 0
  `;

  it("bans one faction per player, then assigns factions via the ascending-auction algorithm", () => {
    const engine = new Engine(Engine.parseMoves(setupMoves), { auction: AuctionVariant.Silent });

    expect(engine.bannedFactions).to.have.members([Faction.Terrans, Faction.Lantids, Faction.HadschHallas]);

    // Same numbers as the community guide's worked example (algorithms/silent-auction.spec.ts):
    // the Taklons/Itars/Xenos nominators end up with Taklons for 2, Itars for 8, and Xenos for 0.
    expect(engine.players[0].faction).to.equal(Faction.Taklons);
    expect(engine.players[0].data.bid).to.equal(2);
    expect(engine.players[1].faction).to.equal(Faction.Itars);
    expect(engine.players[1].data.bid).to.equal(8);
    expect(engine.players[2].faction).to.equal(Faction.Xenos);
    expect(engine.players[2].data.bid).to.equal(0);

    expect(engine.silentAuctionLog.length).to.be.greaterThan(0);

    // Turn order follows the order factions were picked (itars, xenos, taklons), mapped to their
    // final owner: itars's winner (p2) goes first, then xenos's winner (p3), then taklons's (p1).
    expect(engine.turnOrderAfterSetupAuction).to.deep.equal([1, 2, 0]);

    expect(engine.phase).to.equal(Phase.SetupBuilding);
  });

  it("continues normally into the building phase, starting with the itars nominator's winner", () => {
    const engine = new Engine(Engine.parseMoves(setupMoves), { auction: AuctionVariant.Silent });

    expect(engine.phase).to.equal(Phase.SetupBuilding);
    // itars was the first faction picked, and its winner (p2) is turnOrderAfterSetupAuction[0].
    expect(engine.playerToMove).to.equal(1);
  });

  it("does not let a player ban an already-banned faction", () => {
    const moves = Engine.parseMoves(`
      init 3 djfjjv4k
      p1 banFaction terrans
      p2 banFaction terrans
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.Silent })).to.throw();
  });

  it("does not let a player pick a banned faction", () => {
    const moves = Engine.parseMoves(`
      init 3 djfjjv4k
      p1 banFaction itars
      p2 banFaction lantids
      p3 banFaction hadsch-hallas
      p1 faction itars
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.Silent })).to.throw();
  });

  it("requires a bid for every picked faction, no more and no less", () => {
    const incomplete = Engine.parseMoves(`
      init 3 djfjjv4k
      p1 banFaction terrans
      p2 banFaction lantids
      p3 banFaction hadsch-hallas
      p1 faction itars
      p2 faction xenos
      p3 faction taklons
      p1 silentBid itars 15 xenos 0
    `);
    expect(() => new Engine(incomplete, { auction: AuctionVariant.Silent })).to.throw();

    const duplicate = Engine.parseMoves(`
      init 3 djfjjv4k
      p1 banFaction terrans
      p2 banFaction lantids
      p3 banFaction hadsch-hallas
      p1 faction itars
      p2 faction xenos
      p3 faction taklons
      p1 silentBid itars 15 itars 0 taklons 10
    `);
    expect(() => new Engine(duplicate, { auction: AuctionVariant.Silent })).to.throw();
  });

  // The bid round is simultaneous: nothing about it may be derived until every submission is in,
  // which is what lets hosted play collect them in parallel (`auction_sealed_bids`) and append them
  // all at once. These are the invariants that makes safe - the move log the server writes is
  // validated exactly like a move a client composed, and it can never double-count a seat.
  describe("simultaneous submissions", () => {
    const picks = [
      "init 3 djfjjv4k",
      "p1 banFaction terrans",
      "p2 banFaction lantids",
      "p3 banFaction hadsch-hallas",
      "p1 faction itars",
      "p2 faction xenos",
      "p3 faction taklons",
    ];
    const silent = (...moves: string[]) => new Engine([...picks, ...moves], { auction: AuctionVariant.Silent });

    it("derives nothing at all before the last submission lands", () => {
      const engine = silent("p1 silentBid itars 15 xenos 0 taklons 10", "p2 silentBid itars 15 xenos 5 taklons 8");

      expect(engine.phase).to.equal(Phase.SetupSilentBid);
      expect(engine.silentAuctionLog).to.deep.equal([]);
      // Still only the provisional picks; nobody has been assigned or charged anything.
      expect(engine.players.map((pl) => pl.data.bid)).to.deep.equal([0, 0, 0]);
    });

    it("refuses a second submission from the same seat", () => {
      // The failure mode this guards is a real one: the reveal builds its move lines from the
      // sealed rows, so a log that had also recorded a seat's bid as an ordinary move would
      // otherwise count that seat twice. Two gates catch it - the phase's own turn order, which is
      // what fires here, and `moveSilentBid`'s explicit duplicate check behind it.
      expect(() =>
        silent("p1 silentBid itars 15 xenos 0 taklons 10", "p1 silentBid itars 1 xenos 1 taklons 1")
      ).to.throw();
    });

    it("rejects an illegal bid even on replay, where the available-command check is skipped", () => {
      expect(() => silent("p1 silentBid itars 41 xenos 0 taklons 0")).to.throw(/higher than 40/);
      expect(() => silent("p1 silentBid itars -1 xenos 0 taklons 0")).to.throw();
      expect(() => silent("p1 silentBid itars 5 xenos 5 gleens 5")).to.throw(/not up for auction/);
    });

    it("offers the factions and the ceiling on the available command, for a form the turn pointer is not on", () => {
      const engine = silent();
      engine.generateAvailableCommandsIfNeeded();

      const data = engine.availableCommands.find((c) => c.name === Command.SilentBid)?.data as any;
      expect(data.factions).to.deep.equal([Faction.Itars, Faction.Xenos, Faction.Taklons]);
      expect(data.maxBid).to.equal(MAX_SILENT_BID);
    });

    it("assigns and prices from the submissions alone, not from who submitted first", () => {
      // Hosted play appends them in seat order once the last one lands; the outcome is a pure
      // function of the numbers, which is what makes collecting them in parallel safe.
      const engine = silent(
        "p1 silentBid itars 15 xenos 0 taklons 10",
        "p2 silentBid itars 15 xenos 5 taklons 8",
        "p3 silentBid itars 7 xenos 0 taklons 0"
      );

      expect(engine.players.map((pl) => [pl.faction, pl.data.bid])).to.deep.equal([
        [Faction.Taklons, 2],
        [Faction.Itars, 8],
        [Faction.Xenos, 0],
      ]);
    });
  });
});
