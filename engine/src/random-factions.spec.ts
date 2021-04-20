import { expect } from "chai";
import Engine, { AuctionVariant } from "./engine";

describe("Random factions", () => {
  it("should only allow player to select given random faction", () => {
    const engine = new Engine(["init 3 12"], { randomFactions: true });

    expect(() => engine.move("p1 faction gleens")).to.throw();
    expect(() => engine.move("p1 faction firaks")).to.throw();
    expect(() => engine.move("p1 faction bescods")).to.not.throw();
  });

  describe("when in an auction", () => {
    it("should only allow player to select from a random pool", () => {
      const engine = (...moves: string[]) =>
        new Engine(["init 3 12", ...moves], { randomFactions: true, auction: AuctionVariant.ChooseBid });

      expect(() => engine("p1 faction itars")).to.throw();
      expect(() => engine("p1 faction firaks")).to.throw();
      expect(() => engine("p1 faction bescods")).to.not.throw();
      expect(() => engine("p1 faction bescods", "p2 faction bescods")).to.throw();
      expect(() => engine("p1 faction gleens", "p2 faction bescods")).to.not.throw();
      expect(() => engine("p1 faction bescods", "p2 faction gleens")).to.not.throw();
    });
  });
});
