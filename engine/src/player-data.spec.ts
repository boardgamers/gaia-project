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

    it("gains credits/ore/knowledge past the normal caps once the flag is set", () => {
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

      expect(data.credits).to.equal(35);
      expect(data.ores).to.equal(20);
      expect(data.knowledge).to.equal(20);
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
