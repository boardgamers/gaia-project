import {expect} from "chai";
import 'mocha';
import PlayerData from "./player-data";
import { Resource, BrainstoneArea } from "./enums";

describe("PlayerData", () => {
  it('should export to JSON', () => {
    const data = new PlayerData();

    expect(data.toJSON()).to.be.an.instanceof(Object);
  });

  describe("movePowerToGaia", () => {
    it ("should remove power tokens from power areas", () => {
      const data = new PlayerData();
      data.power.area1 = 4;
      data.power.area2 = 4;

      data.discardPower(6, Resource.GainTokenGaiaArea);

      expect(data.power.area1).to.equal(0);
      expect(data.power.area2).to.equal(2);
      expect(data.power.gaia).to.equal(6);
    });
  });

  describe("burn Power", () => {
    it ("should remove power tokens from power areas 2 to power area 3", () => {
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
    it ("should move power tokens from power area 1 to power area 3 and brainstone from area 2 to 3", () => {
      const data = new PlayerData();
      data.power.area1 = 2;
      data.power.area2 = 1;
      data.brainstone = BrainstoneArea.Area2;

      const charged = data.chargePower(5);

      expect(data.power.area1).to.equal(0);
      expect(data.power.area2).to.equal(1);
      expect(data.power.area3).to.equal(2);
      expect(data.brainstone).to.equal(BrainstoneArea.Area3);
      expect(charged).to.equal(5);
    });
  });
});