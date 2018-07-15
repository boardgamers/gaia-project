import {expect} from "chai";
import 'mocha';
import Reward from "./reward";
import { Resource } from "./enums";
import { AssertionError } from "assert";

describe('Reward', () => {

  it('should construct from strings', () => {
    const [R3vp, R2vp, Rvp, R1vp, Rq, R5c, Ro, R4vp] = ["3vp", "2vp", "vp", "1vp", "q", "5c", "o", "vp+4"].map(str => new Reward(str));

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

    expect(R4vp.count).to.equal(4);
    expect(R4vp.type).to.equal(Resource.VictoryPoint);
  });

  it('should give empty rewards on invalid strings', () => {
    expect(new Reward("vp").isEmpty()).to.equal(false);
    expect(new Reward("2c").isEmpty()).to.equal(false);
    expect(new Reward("up-gaia").isEmpty()).to.equal(false);
    expect(new Reward("3x").isEmpty()).to.equal(true);
    expect(new Reward("0vp").isEmpty()).to.equal(true);
    expect(new Reward("15.2vp").isEmpty()).to.equal(true);
  });

  it('should convert back to a string', () => {
    expect(new Reward("3vp").toString()).to.equal("3vp");
    expect(new Reward("1vp").toString()).to.equal("1vp");
    expect(new Reward("vp").toString()).to.equal("1vp");
    expect(new Reward("5c").toString()).to.equal("5c");
  });

  it ('should convert an array of rewards to a string', () => {
    expect(Reward.toString([new Reward("3vp"), new Reward("q")], true)).to.equal("1q,3vp");
  });

  it ('should be able to test whether two sets of rewards are equal', () => {
    // tslint:disable-next-line no-unused-expression
    expect(Reward.match(Reward.parse("c,o,3q"), [new Reward("c"), new Reward(3, Resource.Qic), new Reward("o")])).to.be.true;
    // tslint:disable-next-line no-unused-expression
    expect(Reward.match(Reward.parse("c,o,2q"), [new Reward("c"), new Reward(3, Resource.Qic), new Reward("o")])).to.be.false;
  });

  it ("should test if an array of rewards contains another", () => {
    // tslint:disable-next-line no-unused-expression
    expect(Reward.includes(Reward.parse("q"), Reward.parse("4pw"))).to.be.false;
    // tslint:disable-next-line no-unused-expression
    expect(Reward.includes(Reward.parse("3q,o,2pw"), Reward.parse("2q,pw"))).to.be.true;
  });
});
