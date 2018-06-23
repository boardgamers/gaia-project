import {expect} from "chai";
import 'mocha';
import PlayerData from "./player-data";

describe("PlayerData", () => {
  it('should export to JSON', () => {
    const data = new PlayerData();

    expect(data.toJSON()).to.be.an.instanceof(Object);
  });

  describe("movePowerToGaia", () => {
    it ("should remove power tokens from bowls", () => {
      const data = new PlayerData();
      data.power.bowl1 = 4;
      data.power.bowl2 = 4;

      data.movePowerToGaia(6);

      expect(data.power.bowl1).to.equal(0);
      expect(data.power.bowl2).to.equal(2);
      expect(data.power.gaia).to.equal(6);
    });
  });
});