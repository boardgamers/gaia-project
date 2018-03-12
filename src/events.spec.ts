import {expect} from "chai";
import 'mocha';
import { Reward } from "./events";
import { Resource } from "./enums";
import { AssertionError } from "assert";

describe('Reward', () => {

  it('should construct from strings', () => {
    const [R3vp, R2vp, Rvp, R1vp, Rq, R5c, Ro] = ["3vp", "2vp", "vp", "1vp", "q", "5c", "o"].map(str => new Reward(str));

    expect(R3vp.count).to.equal(3);
    expect(R3vp.type).to.equal(Resource.VictoryPoint);

    expect(R2vp.count).to.equal(2);
    expect(R2vp.type).to.equal(Resource.VictoryPoint);

    expect(Rvp.count).to.equal(1);
    expect(Rvp.type).to.equal(Resource.VictoryPoint);

    expect(R1vp.count).to.equal(1);
    expect(R1vp.type).to.equal(Resource.VictoryPoint);

    expect(Rq.count).to.equal(1);
    expect(Rq.type).to.equal(Resource.Qic);

    expect(R5c.count).to.equal(5);
    expect(R5c.type).to.equal(Resource.Credit);
  });

  it('should throw an error on invalid strings', () => {
    expect(() => new Reward("3x")).to.throw(AssertionError);
    expect(() => new Reward("0vp")).to.throw(AssertionError);
    expect(() => new Reward("15.2vp")).to.throw(AssertionError);
  });

  it('should convert back to a string', () => {
    expect(new Reward("3vp").toString()).to.equal("3vp");
    expect(new Reward("1vp").toString()).to.equal("1vp");
    expect(new Reward("vp").toString()).to.equal("1vp");
    expect(new Reward("5c").toString()).to.equal("5c");
  });

});
