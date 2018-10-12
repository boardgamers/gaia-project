import { expect } from "chai";
import Event from "./events";
import { Condition, Operator, Resource } from "./enums";
import Reward from "./reward";

describe("Events", () => {
  it("should load the ~ event", () => {
    expect(() => new Event("~")).to.not.throw();

    const event = new Event("~");

    expect(event.condition).to.equal(Condition.None);
    expect(event.operator).to.equal(Operator.Once);
    expect(event.rewards).to.have.length(1);
    // tslint:disable-next-line no-unused-expression
    expect(event.rewards[0].isEmpty()).to.be.true;
  });

  it("should load the PA->4PW event", () => {
    const event = new Event("PA->4pw");

    expect(event.operator).to.equal(Operator.Special);
  });

  it("should load pass events", () => {
    const event = new Event("ts | 2vp");

    expect(event.condition).to.equal(Condition.TradingStation);
    expect(event.operator).to.equal(Operator.Pass);
    expect(event.rewards).to.have.length(1);
  });

  it("should load action event with cost", () => {
    const event = new Event("k => range+1");

    expect(event.condition).to.equal(Resource.Knowledge);
    expect(event.operator).to.equal(Operator.Activate);
    // tslint:disable-next-line no-unused-expression
    expect(Reward.match(event.rewards, [new Reward(1, Resource.TemporaryRange)])).to.be.true;
  });

  it("should load a 'pick X of rewards' event", () => {
    const event = new Event("trade 2>> 2k,2o,4c,4pw,q");

    expect(event.condition).to.equal(Condition.Trade);
    expect(event.operator).to.equal(Operator.Trigger);
    expect(event.toPick).to.equal(2);
    // tslint:disable-next-line no-unused-expression
    expect(event.rewards).to.have.length(5);
  });

  describe("toString", () => {
    it ("should render properly for a non-activated event", () => {
      expect(new Event("+t").toString()).to.equal("+t");
    });

    it ("should render properly for an activated event", () => {
      const event = new Event("=> 3t");
      event.activated = true;
      expect(event.toString()).to.equal("=> 3t!");
    });

    it ("should render properly for a pick X event", () => {
      const event = new Event("a 1>> o,k");
      expect(event.toString()).to.equal("a 1>> o,k");
    });
  });
});
