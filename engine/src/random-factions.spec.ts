import { expect } from "chai";
import * as wrapper from "../wrapper";
import Engine, { AuctionVariant } from "./engine";
import { Command, Faction, Phase } from "./enums";
import { factionPlanet } from "./factions";

describe("Random factions", () => {
  it("should only allow player to select given random faction", () => {
    const engine = new Engine(["init 3 12"], { randomFactions: true });

    expect(() => engine.move("p1 faction gleens")).to.throw();
    expect(() => engine.move("p1 faction firaks")).to.throw();
    expect(() => engine.move("p1 faction bescods")).to.not.throw();
  });

  describe("when in an auction", () => {
    it("should only allow players to select from a random pool", () => {
      const engine = (...moves: string[]) =>
        new Engine(["init 3 12", ...moves], { randomFactions: true, auction: AuctionVariant.BidWhileChoosing });

      expect(() => engine("p1 faction itars")).to.throw();
      expect(() => engine("p1 faction firaks")).to.throw();
      expect(() => engine("p1 faction bescods")).to.not.throw();
      expect(() => engine("p1 faction bescods", "p2 faction bescods")).to.throw();
      expect(() => engine("p1 faction gleens", "p2 faction bescods")).to.not.throw();
      expect(() => engine("p1 faction bescods", "p2 faction gleens")).to.not.throw();
    });
  });
  for (const auction of [
    undefined,
    AuctionVariant.ChooseBid,
    AuctionVariant.BidWhileChoosing,
    AuctionVariant.Silent,
    AuctionVariant.PreferenceSplit,
  ]) {
    for (const lostFleet of [false, true]) {
      for (const count of [2, 3, 4, 5]) {
        it(`draws ${count} unbanned colours with ${auction ?? "no auction"}, expansion=${lostFleet}`, () => {
          let engine = new Engine([`init ${count} random-auction-bans`], {
            auction,
            randomFactions: true,
            banPhase: true,
            lostFleet,
          });
          expect(engine.phase).to.equal(Phase.SetupFactionBan);
          expect(engine.randomFactions).to.equal(undefined);
          while (engine.phase === Phase.SetupFactionBan) {
            const command = engine.findAvailableCommand(engine.playerToMove, Command.BanFaction);
            engine.move(`p${engine.playerToMove + 1} banFaction ${command.data[0]}`);
            engine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
          }
          expect(engine.randomFactions).to.have.length(count);
          expect(new Set(engine.randomFactions.map(factionPlanet)).size).to.equal(count);
          expect(engine.randomFactions.filter((faction) => engine.bannedFactions.includes(faction))).to.deep.equal([]);
          const pool = [...engine.randomFactions];
          if (auction === AuctionVariant.BidWhileChoosing) {
            expect(engine.autoMove()).to.equal(false);
            expect(engine.setup).to.deep.equal([]);
          } else {
            while (engine.autoMove());
            expect(engine.setup).to.deep.equal(pool);
            const phase =
              auction === AuctionVariant.Silent
                ? Phase.SetupSilentBid
                : auction === AuctionVariant.PreferenceSplit
                  ? Phase.SetupPreferenceBid
                  : auction
                    ? Phase.SetupAuction
                    : Phase.SetupBuilding;
            expect(engine.phase).to.equal(phase);
          }
          const replayed = new Engine(
            engine.moveHistory,
            { auction, randomFactions: true, banPhase: true, lostFleet },
            engine.version,
            true
          );
          expect(replayed.randomFactions).to.deep.equal(pool);
          expect(replayed.setup).to.deep.equal(engine.setup);
          expect(replayed.phase).to.equal(engine.phase);
        });
      }
    }
  }

  it("takes the hosted silent auction straight from the last ban to bids", async () => {
    let engine = await wrapper.init(4, [], { auction: AuctionVariant.Silent, randomFactions: true }, "random-hosted");
    for (let seat = 0; seat < 4; seat++) {
      engine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
      const command = engine.findAvailableCommand(seat, Command.BanFaction);
      engine = wrapper.move(engine, `p${seat + 1} banFaction ${command.data[0]}`, seat);
    }
    expect(engine.phase).to.equal(Phase.SetupSilentBid);
    expect(engine.setup).to.deep.equal(engine.randomFactions);
    expect(engine.sealedBidPendingSeats()).to.deep.equal([0, 1, 2, 3]);
    for (let seat = 0; seat < 4; seat++) {
      const bids = engine.setup.map((faction) => `${faction} 0`).join(" ");
      engine = wrapper.move(
        Engine.fromData(JSON.parse(JSON.stringify(engine))),
        `p${seat + 1} silentBid ${bids}`,
        seat
      );
    }
    expect(engine.phase).to.equal(Phase.SetupBuilding);
    expect(engine.players.map((player) => player.faction)).to.deep.equal(engine.randomFactions);
  });

  it("automatically nominates a silent random pool when bans are disabled", async () => {
    const engine = await wrapper.init(
      4,
      [],
      { auction: AuctionVariant.Silent, randomFactions: true, banPhase: false },
      "random-no-bans"
    );
    expect(engine.phase).to.equal(Phase.SetupSilentBid);
    expect(engine.bannedFactions).to.deep.equal([]);
    expect(engine.setup).to.deep.equal(engine.randomFactions);
  });

  it("preserves the pre-4.14.3 random pool and manual nominations when replaying", () => {
    const engine = new Engine(["init 3 12"], { auction: AuctionVariant.Silent, randomFactions: true }, "4.14.2");
    expect(engine.randomFactions).to.deep.equal([Faction.Bescods, Faction.Gleens, Faction.BalTaks]);
    for (const [seat, faction] of [Faction.Terrans, Faction.Lantids, Faction.HadschHallas].entries()) {
      engine.move(`p${seat + 1} banFaction ${faction}`);
    }
    for (const [seat, faction] of [...engine.randomFactions].reverse().entries()) {
      engine.move(`p${seat + 1} faction ${faction}`);
    }
    const replayed = engine.replayedTo();
    expect(replayed.randomFactions).to.deep.equal(engine.randomFactions);
    expect(replayed.setup).to.deep.equal(engine.setup);
  });

  describe("saved silent auctions from before 4.14.3", () => {
    function oldGame(bans = 4, nominations = 0): Engine {
      const engine = new Engine(
        ["init 4 saved-random-auction"],
        {
          auction: AuctionVariant.Silent,
          randomFactions: true,
        },
        "4.14.2"
      );
      const eligibleBans = Faction.values(engine.expansions).filter(
        (faction) => !engine.randomFactions.includes(faction)
      );
      for (let seat = 0; seat < bans; seat++) {
        engine.move(`p${seat + 1} banFaction ${eligibleBans[seat]}`);
      }
      const choices = [...engine.randomFactions].reverse();
      for (let seat = 0; seat < nominations; seat++) {
        engine.move(`p${seat + 1} faction ${choices[seat]}`);
      }
      return engine;
    }

    for (const bans of [0, 1, 2, 3]) {
      it(`keeps the existing draw when resuming after ${bans} bans`, () => {
        const original = oldGame(bans);
        const pool = [...original.randomFactions];
        const history = [...original.moveHistory];
        let resumed = Engine.fromData(JSON.parse(JSON.stringify(original)));
        while (resumed.phase === Phase.SetupFactionBan) {
          const seat = resumed.playerToMove;
          const command = resumed.findAvailableCommand(seat, Command.BanFaction);
          const faction = command.data.find((candidate) => !pool.includes(candidate));
          resumed = wrapper.move(resumed, `p${seat + 1} banFaction ${faction}`, seat);
          resumed = Engine.fromData(JSON.parse(JSON.stringify(resumed)));
        }
        expect(resumed.randomFactions).to.deep.equal(pool);
        expect(resumed.setup).to.deep.equal(pool);
        expect(resumed.bannedFactions.slice(0, bans)).to.deep.equal(original.bannedFactions);
        expect(resumed.moveHistory.slice(0, history.length)).to.deep.equal(history);
        expect(resumed.phase).to.equal(Phase.SetupSilentBid);
        expect(resumed.replayedTo().randomFactions).to.deep.equal(pool);
      });
    }

    for (const nominations of [0, 1, 2, 3]) {
      it(`completes remaining nominations without changing ${nominations} manual choices`, () => {
        const original = oldGame(4, nominations);
        const history = [...original.moveHistory];
        const resumed = Engine.fromData(JSON.parse(JSON.stringify(original)));
        wrapper.automove(resumed);
        const expected = [
          ...original.setup,
          ...original.randomFactions.filter((faction) => !original.setup.includes(faction)),
        ];
        expect(resumed.version).to.equal(original.version);
        expect(resumed.randomFactions).to.deep.equal(original.randomFactions);
        expect(resumed.bannedFactions).to.deep.equal(original.bannedFactions);
        expect(resumed.setup).to.deep.equal(expected);
        expect(resumed.players.map((player) => player.faction)).to.deep.equal(expected);
        expect(resumed.moveHistory.slice(0, history.length)).to.deep.equal(history);
        expect(resumed.phase).to.equal(Phase.SetupSilentBid);
        expect(resumed.sealedBidPendingSeats()).to.deep.equal([0, 1, 2, 3]);
        const replayed = resumed.replayedTo();
        expect(replayed.setup).to.deep.equal(expected);
        expect(replayed.players.map((player) => player.faction)).to.deep.equal(expected);
        expect(replayed.moveHistory).to.deep.equal(resumed.moveHistory);
      });
    }

    it("still accepts a nomination from an already-open selection screen before completing the others", () => {
      const original = oldGame(4, 1);
      const faction = original.randomFactions[1];
      const resumed = wrapper.move(JSON.parse(JSON.stringify(original)), `p2 faction ${faction}`, 1);
      expect(resumed.setup.slice(0, 2)).to.deep.equal([...original.setup, faction]);
      expect(resumed.randomFactions).to.deep.equal(original.randomFactions);
      expect(resumed.phase).to.equal(Phase.SetupSilentBid);
    });

    it("replaces only banned factions in an old pool before completing nominations", () => {
      const original = oldGame(3);
      const pool = [...original.randomFactions];
      original.move(`p4 banFaction ${original.randomFactions[0]}`);
      const saved = JSON.parse(JSON.stringify(original));
      saved.randomFactions = pool;
      const resumed = Engine.fromData(saved);
      wrapper.automove(resumed);
      expect(resumed.phase).to.equal(Phase.SetupSilentBid);
      expect(resumed.randomFactions.slice(1)).to.deep.equal(pool.slice(1));
      expect(resumed.bannedFactions).not.to.include(resumed.randomFactions[0]);
      expect(new Set(resumed.randomFactions.map(factionPlanet)).size).to.equal(4);
      expect(resumed.bannedFactions).to.deep.equal(original.bannedFactions);
      expect(resumed.moveHistory.slice(0, original.moveHistory.length)).to.deep.equal(original.moveHistory);
      expect(resumed.replayedTo().randomFactions).to.deep.equal(resumed.randomFactions);
    });

    for (const auction of [AuctionVariant.Silent, AuctionVariant.PreferenceSplit]) {
      for (const nominations of [0, 1, 2, 3]) {
        it(`repairs the blocked Lost Fleet pool after ${nominations} manual picks with ${auction}`, () => {
          const original = new Engine(
            ["init 4 Merry-novel-6174"],
            { randomFactions: true, auction, banPhase: true, lostFleet: true, officialCenterSectors: true },
            "4.14.2"
          );
          const pool = [...original.randomFactions];
          expect(pool).to.deep.equal([Faction.Firaks, Faction.Gleens, Faction.Itars, Faction.Taklons]);
          const bans = [Faction.Firaks, Faction.Ivits, Faction.Lantids, Faction.Xenos];
          for (const [seat, faction] of bans.entries()) {
            original.move(`p${seat + 1} banFaction ${faction}`);
          }
          const choices = [Faction.Itars, Faction.Gleens, Faction.Taklons].slice(0, nominations);
          for (const [seat, faction] of choices.entries()) {
            original.move(`p${seat + 1} faction ${faction}`);
          }
          const saved = JSON.parse(JSON.stringify(original));
          saved.randomFactions = pool;
          saved.availableCommands = [
            {
              name: Command.ChooseFaction,
              player: nominations,
              data: pool.filter((faction) => !bans.includes(faction) && !choices.includes(faction)),
            },
          ];

          const resumed = Engine.fromData(saved);
          wrapper.automove(resumed);
          expect(resumed.phase).to.equal(
            auction === AuctionVariant.Silent ? Phase.SetupSilentBid : Phase.SetupPreferenceBid
          );
          expect(resumed.setup.slice(0, nominations)).to.deep.equal(choices);
          expect(resumed.randomFactions.slice(1)).to.deep.equal(pool.slice(1));
          expect(resumed.randomFactions.some((faction) => bans.includes(faction))).to.equal(false);
          expect(new Set(resumed.randomFactions.map(factionPlanet)).size).to.equal(4);
          expect(resumed.bannedFactions).to.deep.equal(bans);
          expect(resumed.moveHistory.slice(0, original.moveHistory.length)).to.deep.equal(original.moveHistory);
          expect(resumed.sealedBidPendingSeats()).to.deep.equal([0, 1, 2, 3]);
          const replayed = resumed.replayedTo();
          expect(replayed.randomFactions).to.deep.equal(resumed.randomFactions);
          expect(replayed.options.map).to.deep.equal(resumed.options.map);
          expect(replayed.setup).to.deep.equal(resumed.setup);
          expect(replayed.players.map((player) => player.faction)).to.deep.equal(resumed.setup);
          const loaded = Engine.fromData(JSON.parse(JSON.stringify(resumed)));
          expect(loaded.randomFactions).to.deep.equal(resumed.randomFactions);
        });
      }
    }

    for (const submitted of [1, 2, 3]) {
      it(`preserves ${submitted} submitted bid vectors and their nomination tie-breakers`, () => {
        const original = oldGame(4, 4);
        const bid = (seat: number) =>
          `p${seat + 1} silentBid ${original.setup.map((faction) => `${faction} 0`).join(" ")}`;
        for (let seat = 0; seat < submitted; seat++) {
          original.move(bid(seat));
        }
        let resumed = Engine.fromData(JSON.parse(JSON.stringify(original)));
        wrapper.automove(resumed);
        expect(resumed.randomFactions).to.deep.equal(original.randomFactions);
        expect(resumed.setup).to.deep.equal(original.setup);
        expect(resumed.bannedFactions).to.deep.equal(original.bannedFactions);
        expect(resumed.silentAuctionBids).to.deep.equal(original.silentAuctionBids);
        expect(resumed.moveHistory).to.deep.equal(original.moveHistory);
        expect(resumed.sealedBidPendingSeats()).to.deep.equal(original.sealedBidPendingSeats());
        for (let seat = submitted; seat < 4; seat++) {
          resumed = wrapper.move(JSON.parse(JSON.stringify(resumed)), bid(seat), seat);
        }
        expect(resumed.phase).to.equal(Phase.SetupBuilding);
        // Equal bids must keep the original manually nominated factions as tie-breakers.
        expect(resumed.players.map((player) => player.faction)).to.deep.equal(original.setup);
        const replayed = resumed.replayedTo();
        expect(replayed.players.map((player) => player.faction)).to.deep.equal(original.setup);
        expect(replayed.silentAuctionBids).to.deep.equal(resumed.silentAuctionBids);
      });
    }
  });
});
