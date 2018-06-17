import {expect} from "chai";
import 'mocha';
import PlayerData from "./player-data";

describe("PlayerData", () => {
  it('should export to JSON', () => {
    const data = new PlayerData();

    expect(data.toJSON()).to.be.an.instanceof(Object);
  });
});