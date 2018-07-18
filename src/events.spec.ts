import { expect } from "chai";
import Event from "./events";
import { Condition, Operator } from "./enums";

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

  describe("toString", () => {
    it ("should render properly for a non-activated event", () => {
      expect(new Event("+t").toString()).to.equal("+t");
    });

    it ("should render properly for an activated event", () => {
      const event = new Event("=> 3t");
      event.activated = true;
      expect(event.toString()).to.equal("=> 3t!");
    });
  });
});
