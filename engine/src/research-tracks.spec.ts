import { expect } from "chai";
import Engine from "./engine";
import { Expansion, Faction, LostFleetEconomySide, Player as PlayerEnum, ResearchField, Resource } from "./enums";
import Player from "./player";
import { researchEvents } from "./research-tracks";
import Reward from "./reward";

function rewardStrings(events: ReturnType<typeof researchEvents>): string[] {
  return events.map((event) => Reward.toString(event.rewards, false));
}

describe("Lost Fleet Economy track overlay (§F1)", () => {
  describe("researchEvents", () => {
    it("should leave levels 0, 1, 2, and 5 unchanged from the base track on both sides", () => {
      for (const level of [0, 1, 2, 5]) {
        const base = rewardStrings(researchEvents(ResearchField.Economy, level, Expansion.None));
        const pw = rewardStrings(
          researchEvents(ResearchField.Economy, level, Expansion.LostFleet, LostFleetEconomySide.Power)
        );
        const vp = rewardStrings(
          researchEvents(ResearchField.Economy, level, Expansion.LostFleet, LostFleetEconomySide.VictoryPoints)
        );
        expect(pw).to.deep.equal(base);
        expect(vp).to.deep.equal(base);
      }
    });

    it("should grant 1 ore + 2 credits + charge 3 power at level 3 on the pw side", () => {
      const events = researchEvents(ResearchField.Economy, 3, Expansion.LostFleet, LostFleetEconomySide.Power);
      expect(rewardStrings(events)).to.deep.equal(["2c,o,3pw", "3pw"]);
    });

    it("should grant 2 ore + 2 credits + charge 2 power at level 4 on the pw side", () => {
      const events = researchEvents(ResearchField.Economy, 4, Expansion.LostFleet, LostFleetEconomySide.Power);
      expect(rewardStrings(events)).to.deep.equal(["2c,2o,2pw"]);
    });

    it("should grant 1 ore + 3 credits + 1 VP at level 3 on the vp side", () => {
      const events = researchEvents(ResearchField.Economy, 3, Expansion.LostFleet, LostFleetEconomySide.VictoryPoints);
      expect(rewardStrings(events)).to.deep.equal(["3c,o,vp", "3pw"]);
    });

    it("should grant 2 ore + 4 credits + 1 VP at level 4 on the vp side", () => {
      const events = researchEvents(ResearchField.Economy, 4, Expansion.LostFleet, LostFleetEconomySide.VictoryPoints);
      expect(rewardStrings(events)).to.deep.equal(["4c,2o,vp"]);
    });

    it("should keep the universal 'reach level 3' power charge on both sides, same as the base track", () => {
      const base = researchEvents(ResearchField.Economy, 3, Expansion.None);
      const pw = researchEvents(ResearchField.Economy, 3, Expansion.LostFleet, LostFleetEconomySide.Power);
      const vp = researchEvents(ResearchField.Economy, 3, Expansion.LostFleet, LostFleetEconomySide.VictoryPoints);

      expect(rewardStrings(base)).to.include("3pw");
      expect(rewardStrings(pw)).to.include("3pw");
      expect(rewardStrings(vp)).to.include("3pw");
    });

    it("should not apply either overlay without the Lost Fleet expansion", () => {
      const events = researchEvents(ResearchField.Economy, 3, Expansion.None, LostFleetEconomySide.VictoryPoints);
      expect(rewardStrings(events)).to.deep.equal(["3c,o,3pw", "3pw"]);
    });
  });

  describe("setup: side selection", () => {
    it("should not set a side without the Lost Fleet expansion", () => {
      const engine = new Engine(["init 2 randomSeed"], {});
      expect(engine.lostFleetEconomySide).to.be.undefined;
    });

    it("should be deterministic for a given seed", () => {
      const a = new Engine(["init 3 lf-eco-determinism"], { lostFleet: true });
      const b = new Engine(["init 3 lf-eco-determinism"], { lostFleet: true });
      expect(a.lostFleetEconomySide).to.equal(b.lostFleetEconomySide);
    });

    it("should be able to land on either side", () => {
      const pw = new Engine(["init 2 lf-eco-2p-2"], { lostFleet: true });
      expect(pw.lostFleetEconomySide).to.equal(LostFleetEconomySide.Power);

      const vp = new Engine(["init 2 lf-eco-2p-0"], { lostFleet: true });
      expect(vp.lostFleetEconomySide).to.equal(LostFleetEconomySide.VictoryPoints);
    });
  });

  describe("player income integration", () => {
    function playerWithSide(side: LostFleetEconomySide) {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Terrans;
      player.loadFaction(null, Expansion.LostFleet, false, 2, side);
      return player;
    }

    it("should apply the pw side's recurring income once a player advances Economy research to level 3", () => {
      const player = playerWithSide(LostFleetEconomySide.Power);
      const baseline = Reward.merge(player.incomeRewards);

      player.onResearchAdvanced(ResearchField.Economy, 3, Expansion.LostFleet);

      const income = Reward.merge(player.incomeRewards);
      const creditDelta =
        (income.find((r) => r.type === Resource.Credit)?.count ?? 0) -
        (baseline.find((r) => r.type === Resource.Credit)?.count ?? 0);
      const oreDelta =
        (income.find((r) => r.type === Resource.Ore)?.count ?? 0) -
        (baseline.find((r) => r.type === Resource.Ore)?.count ?? 0);
      expect(creditDelta).to.equal(2);
      expect(oreDelta).to.equal(1);
    });

    it("should apply the vp side's recurring income (including a VP reward) once a player advances Economy research to level 4", () => {
      const player = playerWithSide(LostFleetEconomySide.VictoryPoints);
      const baseline = Reward.merge(player.incomeRewards);

      player.onResearchAdvanced(ResearchField.Economy, 3, Expansion.LostFleet);
      const beforeVp = player.data.victoryPoints;
      player.onResearchAdvanced(ResearchField.Economy, 4, Expansion.LostFleet);

      const income = Reward.merge(player.incomeRewards);
      const creditDelta =
        (income.find((r) => r.type === Resource.Credit)?.count ?? 0) -
        (baseline.find((r) => r.type === Resource.Credit)?.count ?? 0);
      const oreDelta =
        (income.find((r) => r.type === Resource.Ore)?.count ?? 0) -
        (baseline.find((r) => r.type === Resource.Ore)?.count ?? 0);
      expect(creditDelta).to.equal(4);
      expect(oreDelta).to.equal(2);
      // reaching level 3 already granted the universal one-time "3pw" bonus; level 4 on the vp side
      // grants no further one-time reward, so victory points are unaffected by this second advance.
      expect(player.data.victoryPoints).to.equal(beforeVp);
    });
  });
});
