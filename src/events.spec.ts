import { expect } from "chai";
import Event from "./events";
import { Condition, Operator } from "..";

describe("Events", () => {
  it("should load the ~ event", () => {
    expect(() => new Event("~")).to.not.throw();

    const event = new Event("~");

    expect(event.condition).to.equal(Condition.None);
    expect(event.operator).to.equal(Operator.Once);
    expect(event.rewards).to.have.length(1);
    expect(event.rewards[0].isEmpty()).to.be.true;
  });
});