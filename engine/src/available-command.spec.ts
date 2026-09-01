import { expect } from "chai";
import { Expansion, PlayerEnum } from "../index";
import { possibleBoardActions, possibleFreeActions } from "./available/actions";
import { choosableFactions } from "./available/setup";
import { AvailableCommand } from "./available/types";
import Engine, { AuctionVariant } from "./engine";
import { BoardAction, Faction } from "./enums";
import Player from "./player";
import PlayerData from "./player-data";

describe("Available commands", () => {
  describe("choosableFactions", () => {
    it("should show all factions at the beginning", () => {
      const engine = new Engine();

      expect(choosableFactions(engine)).to.have.members(Faction.values(Expansion.None));
    });

    it("should show 2 less factions after one is selected", () => {
      const engine = new Engine();

      expect(choosableFactions(engine)).to.include.members([Faction.Gleens, Faction.Xenos]);

      engine.setup.push(Faction.Gleens);

      const factions = choosableFactions(engine);

      expect(factions).to.not.include(Faction.Gleens);
      expect(factions).to.not.include(Faction.Xenos);
      expect(factions).to.have.length(Faction.values(Expansion.None).length - 2);
    });

    describe("when randomFactions is enabled", () => {
      it("should give only one faction at a time", () => {
        const engine = new Engine([`init 3 12`], { randomFactions: true });

        expect(choosableFactions(engine)).to.eql([Faction.Bescods]);

        engine.setup.push(Faction.Bescods);

        expect(choosableFactions(engine)).to.eql([Faction.Gleens]);

        engine.setup.push(Faction.Gleens);

        expect(choosableFactions(engine)).to.eql([Faction.BalTaks]);
      });

      describe("when auction is enabled", () => {
        it("should offer factions from a randomly selected pool (bid-while-choosing)", () => {
          const engine = new Engine([`init 3 12`], { randomFactions: true, auction: AuctionVariant.BidWhileChoosing });
          expect(choosableFactions(engine)).to.have.members([Faction.Bescods, Faction.Gleens, Faction.BalTaks]);

          engine.setup.push(Faction.Gleens);
          expect(choosableFactions(engine)).to.have.members([Faction.Bescods, Faction.BalTaks]);

          engine.setup.push(Faction.BalTaks);
          expect(choosableFactions(engine)).to.eql([Faction.Bescods]);

          engine.setup.push(Faction.Bescods);
          expect(choosableFactions(engine)).to.eql([]);
        });

        it("should give one faction at a time (choose-bid)", () => {
          const engine = new Engine([`init 3 12`], { randomFactions: true, auction: AuctionVariant.ChooseBid });
          expect(choosableFactions(engine)).to.eql([Faction.Bescods]);

          engine.setup.push(Faction.Bescods);
          expect(choosableFactions(engine)).to.eql([Faction.Gleens]);

          engine.setup.push(Faction.Gleens);
          expect(choosableFactions(engine)).to.eql([Faction.BalTaks]);

          engine.setup.push(Faction.BalTaks);
          expect(choosableFactions(engine)).to.eql([]);
        });
      });
    });
  });

  describe("Free actions", () => {
    it("should return only 1 free action with 1pw", () => {
      const player = new Player(Expansion.None, PlayerEnum.Player1);
      player.data.power.area3 = 1;

      const actions = possibleFreeActions(player);
      expect(actions).to.have.length(1);
    });
  });

  describe("Board actions", () => {
    it("should not allow board action if all resources woould be wasted", () => {
      const actions = {};
      BoardAction.values().forEach((pos: BoardAction) => {
        actions[pos] = null;
      });

      const d = new PlayerData();
      d.knowledge = 14;
      d.power.area3 = 9;
      const player = { data: d } as Player;

      function possible() {
        const cmd = possibleBoardActions(actions, player, false)[0] as AvailableCommand & {
          data: { poweracts: { name: string }[] };
        };
        return cmd.data.poweracts.map((a) => a.name);
      }

      expect(possible()).to.include("power1");
      d.knowledge = 15;
      expect(possible()).to.not.include("power1");
    });

    it("should exclude the research-board Q.I.C. actions (qic1-3) under Lost Fleet (RULES_CLARIFICATIONS.md §E4/§K3)", () => {
      const d = new PlayerData();
      d.qics = 10;
      d.power.area3 = 9;
      const player = { data: d } as Player;

      const baseActions = {};
      BoardAction.values(Expansion.None).forEach((pos: BoardAction) => {
        baseActions[pos] = null;
      });
      const baseNames = (
        possibleBoardActions(baseActions, player, false)[0] as AvailableCommand & {
          data: { poweracts: { name: string }[] };
        }
      ).data.poweracts.map((a) => a.name);
      expect(baseNames).to.include.members(["qic1", "qic3", "power1"]);

      const lostFleetActions = {};
      BoardAction.values(Expansion.LostFleet).forEach((pos: BoardAction) => {
        lostFleetActions[pos] = null;
      });
      const lostFleetNames = (
        possibleBoardActions(lostFleetActions, player, false)[0] as AvailableCommand & {
          data: { poweracts: { name: string }[] };
        }
      ).data.poweracts.map((a) => a.name);
      expect(lostFleetNames).to.not.include.members(["qic1", "qic2", "qic3"]);
      expect(lostFleetNames).to.include("power1");
    });
  });
});
