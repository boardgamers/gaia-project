import { expect } from "chai";
import "mocha";
import { PowerArea, Resource, Spaceship, SpaceshipTechTile } from "./enums";
import PlayerData, { effectiveRange } from "./player-data";
import Reward from "./reward";

describe("PlayerData", () => {
  it("should export to JSON", () => {
    const data = new PlayerData();

    expect(data.toJSON()).to.be.an.instanceof(Object);
  });

  describe("discardPower", () => {
    it("should remove power tokens from power areas", () => {
      const data = new PlayerData();
      data.power.area1 = 4;
      data.power.area2 = 4;

      data.discardPower(6);

      expect(data.power.area1).to.equal(0);
      expect(data.power.area2).to.equal(2);
      expect(data.power.gaia).to.equal(0);
      expect(data.brainstone).to.equal(null);
    });
  });

  describe("discardPower with brainstone in play", () => {
    it("should remove power tokens from power areas and brainstone", () => {
      const data = new PlayerData();
      data.power.area1 = 4;
      data.power.area2 = 1;
      data.brainstone = PowerArea.Area2;

      data.discardPower(6);

      expect(data.power.area1).to.equal(0);
      expect(data.power.area2).to.equal(0);
      expect(data.power.gaia).to.equal(0);
      expect(data.brainstone).to.equal(null);
    });
  });

  describe("burn Power", () => {
    it("should remove power tokens from power areas 2 to power area 3", () => {
      const data = new PlayerData();
      data.power.area1 = 4;
      data.power.area2 = 4;

      data.burnPower(1);

      expect(data.power.area1).to.equal(4);
      expect(data.power.area2).to.equal(2);
      expect(data.power.area3).to.equal(1);
    });
  });

  describe("charge Power with brainstone", () => {
    it("should move power tokens from power area 1 to power area 3 and brainstone from area 2 to 3", () => {
      const data = new PlayerData();
      data.power.area1 = 2;
      data.power.area2 = 1;
      data.brainstone = PowerArea.Area2;

      const charged = data.chargePower(5);

      expect(data.power.area1).to.equal(0);
      expect(data.power.area2).to.equal(1);
      expect(data.power.area3).to.equal(2);
      expect(data.brainstone).to.equal(PowerArea.Area3);
      expect(charged).to.equal(5);
    });
  });

  describe("analysis mode (docs/lost-fleet/ANALYSIS_MODE_PLAN.md §3.4)", () => {
    it("clamps credit/ore/knowledge gains at their caps when the flag is unset", () => {
      const data = new PlayerData();
      data.credits = 25;
      data.ores = 10;
      data.knowledge = 10;

      data.gainRewards([
        new Reward(10, Resource.Credit),
        new Reward(10, Resource.Ore),
        new Reward(10, Resource.Knowledge),
      ]);

      expect(data.credits).to.equal(30);
      expect(data.ores).to.equal(15);
      expect(data.knowledge).to.equal(15);
    });

    it("still clamps gains with the flag set - a real player's gains cap the same way (§12)", () => {
      // The flag used to lift these clamps, because analysis mode injected a sandbox wallet that the
      // clamps then ate. Nothing is injected now: the seat keeps its real numbers and is simply
      // allowed to overdraw them, so clamping a GAIN is the faithful behaviour rather than a bug.
      const data = new PlayerData();
      data.analysis = true;
      data.credits = 25;
      data.ores = 10;
      data.knowledge = 10;

      data.gainRewards([
        new Reward(10, Resource.Credit),
        new Reward(10, Resource.Ore),
        new Reward(10, Resource.Knowledge),
      ]);

      expect(data.credits).to.equal(30);
      expect(data.ores).to.equal(15);
      expect(data.knowledge).to.equal(15);
    });

    it("stops enforcing affordability for the spendable resources once the flag is set (§12)", () => {
      const data = new PlayerData();
      data.credits = 1;

      expect(data.hasResource(new Reward(10, Resource.Credit))).to.equal(false);

      data.analysis = true;

      expect(data.hasResource(new Reward(10, Resource.Credit))).to.equal(true);
      expect(data.hasResource(new Reward(10, Resource.Ore))).to.equal(true);
      expect(data.hasResource(new Reward(10, Resource.Knowledge))).to.equal(true);
      expect(data.hasResource(new Reward(10, Resource.Qic))).to.equal(true);
      expect(data.hasResource(new Reward(10, Resource.ChargePower))).to.equal(true);
    });

    it("keeps components and board positions genuinely gated - only spendable resources are overdrawable", () => {
      const data = new PlayerData();
      data.analysis = true;

      // A Gaiaformer you do not own, or a token that is not in the Gaia area, cannot be conjured by
      // assuming you overspent - unlike credits, they are not a balance to be in debt on.
      expect(data.hasResource(new Reward(1, Resource.GaiaFormer))).to.equal(false);
      expect(data.hasResource(new Reward(1, Resource.GainTokenGaiaArea))).to.equal(false);
      expect(data.hasResource(new Reward(1, Resource.MoveTokenFromArea3ToGaia))).to.equal(false);
    });

    it("lets a spend go negative, which is what the player board then shows", () => {
      const data = new PlayerData();
      data.analysis = true;
      data.credits = 2;

      data.gainReward(new Reward(9, Resource.Credit), true);

      expect(data.credits).to.equal(-7);
    });

    it("tops a power cost up instead of driving a bowl negative, and counts what it assumed", () => {
      const data = new PlayerData();
      data.analysis = true;
      data.power = { area1: 0, area2: 0, area3: 0, gaia: 0 } as any;

      data.spendPower(4);

      expect(data.power.area1).to.be.at.least(0);
      expect(data.power.area2).to.be.at.least(0);
      expect(data.power.area3).to.be.at.least(0);
      expect(data.analysisAssumedPower).to.be.at.least(4);
    });

    it("charges real tokens up from the lower bowls before assuming any", () => {
      const data = new PlayerData();
      data.analysis = true;
      data.power = { area1: 4, area2: 0, area3: 0, gaia: 0 } as any;

      data.spendPower(2);

      // Two charges lift one token area1 -> area3; nothing had to be conjured beyond that.
      expect(data.power.area1 + data.power.area2 + data.power.area3).to.equal(4);
    });

    it("does not survive a toJSON -> clone round trip", () => {
      const data = new PlayerData();
      data.analysis = true;

      expect(data.toJSON()).to.not.have.property("analysis");
      expect(data.clone().analysis).to.equal(false);
    });
  });

  describe("effectiveRange", () => {
    it("equals the base range with no Range tech tile claimed", () => {
      const data = new PlayerData();
      data.range = 3;

      expect(effectiveRange(data)).to.equal(3);
    });

    it("adds 1 while the Range spaceship tech tile is claimed and enabled", () => {
      const data = new PlayerData();
      data.range = 3;
      data.tiles.techs.push({ tile: SpaceshipTechTile.Range, pos: Spaceship.Eclipse, enabled: true });

      expect(effectiveRange(data)).to.equal(4);
    });

    it("does not add the bonus once the Range tile is covered by an Advanced Tech tile", () => {
      const data = new PlayerData();
      data.range = 3;
      data.tiles.techs.push({ tile: SpaceshipTechTile.Range, pos: Spaceship.Eclipse, enabled: false });

      expect(effectiveRange(data)).to.equal(3);
    });

    it("tolerates a partial (tiles-less) object, e.g. lightweight test fixtures", () => {
      expect(effectiveRange({ range: 2 } as PlayerData)).to.equal(2);
    });
  });
});
