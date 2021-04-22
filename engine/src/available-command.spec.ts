import { expect } from "chai";
import { qicForDistance, remainingFactions } from "./available-command";
import Engine, { AuctionVariant } from "./engine";
import { Faction } from "./enums";
import PlayerData from "./player-data";

describe("Available commands", () => {
  describe("remainingFactions", () => {
    it("should show all factions at the beginning", () => {
      const engine = new Engine();

      expect(remainingFactions(engine)).to.have.members(Object.values(Faction));
    });

    it("should show 2 less factions after one is selected", () => {
      const engine = new Engine();

      expect(remainingFactions(engine)).to.include.members([Faction.Gleens, Faction.Xenos]);

      engine.setup.push(Faction.Gleens);

      const factions = remainingFactions(engine);

      expect(factions).to.not.include(Faction.Gleens);
      expect(factions).to.not.include(Faction.Xenos);
      expect(factions).to.have.length(Object.values(Faction).length - 2);
    });

    describe("when randomFactions is enabled", () => {
      it("should give only one faction at a time", () => {
        const engine = new Engine([`init 3 12`], { randomFactions: true });

        expect(remainingFactions(engine)).to.eql([Faction.Bescods]);

        engine.setup.push(Faction.Bescods);

        expect(remainingFactions(engine)).to.eql([Faction.Gleens]);

        engine.setup.push(Faction.Gleens);

        expect(remainingFactions(engine)).to.eql([Faction.BalTaks]);
      });

      describe("when auction is enabled", () => {
        it("should offer factions from a randomly selected pool (bid-while-choosing)", () => {
          const engine = new Engine([`init 3 12`], { randomFactions: true, auction: AuctionVariant.BidWhileChoosing });
          expect(remainingFactions(engine)).to.have.members([Faction.Bescods, Faction.Gleens, Faction.BalTaks]);

          engine.setup.push(Faction.Gleens);
          expect(remainingFactions(engine)).to.have.members([Faction.Bescods, Faction.BalTaks]);

          engine.setup.push(Faction.BalTaks);
          expect(remainingFactions(engine)).to.eql([Faction.Bescods]);

          engine.setup.push(Faction.Bescods);
          expect(remainingFactions(engine)).to.eql([]);
        });

        it("should give one faction at a time (choose-bid)", () => {
          const engine = new Engine([`init 3 12`], { randomFactions: true, auction: AuctionVariant.ChooseBid });
          expect(remainingFactions(engine)).to.eql([Faction.Bescods]);

          engine.setup.push(Faction.Bescods);
          expect(remainingFactions(engine)).to.eql([Faction.Gleens]);

          engine.setup.push(Faction.Gleens);
          expect(remainingFactions(engine)).to.eql([Faction.BalTaks]);

          engine.setup.push(Faction.BalTaks);
          expect(remainingFactions(engine)).to.eql([]);
        });
      });
    });
  });

  describe("Building commands", () => {
    const tests: {
      name: string;
      give: { distance: number; range: number; temporaryRange: number };
      want: { qic: number; possible: boolean };
    }[] = [
      {
        name: "in distance",
        give: { distance: 1, range: 1, temporaryRange: 0 },
        want: { qic: 0, possible: true },
      },
      {
        name: "need 2 q",
        give: { distance: 5, range: 1, temporaryRange: 0 },
        want: { qic: 2, possible: true },
      },
      {
        name: "need 1 q with temp range",
        give: { distance: 6, range: 1, temporaryRange: 3 },
        want: { qic: 1, possible: true },
      },
      {
        name: "temp range partially needed",
        give: { distance: 2, range: 1, temporaryRange: 3 },
        want: { qic: 0, possible: true },
      },
      {
        name: "temp range not needed",
        give: { distance: 1, range: 1, temporaryRange: 3 },
        want: { qic: 0, possible: false },
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const g = test.give;
        const p = { range: g.range, temporaryRange: g.temporaryRange } as PlayerData;
        const [qic, possible] = qicForDistance(g.distance, p);
        expect(qic).to.equal(test.want.qic);
        expect(possible).to.equal(test.want.possible);
      });
    }
  });
});
