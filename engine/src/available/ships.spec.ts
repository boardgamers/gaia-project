import { expect } from "chai";
import Engine from "../engine";

describe("Trade ships", () => {
  const moves = [
    "init 2 Pleasant-barrel-3642",
    "p1 faction ambas",
    "p2 faction firaks (0/0/0/0 ⇒ 2/4/0/0)",
    "ambas build m 7B2",
    "firaks build m 7A6",
    "firaks build m 2A10",
    "ambas build m 2B3",
    "firaks booster booster9",
    "ambas booster booster5 (2/4/0/0 ⇒ 0/6/0/0)",
    "ambas build ts 7B2.",
    "firaks charge 1pw (0/4/2/0 ⇒ 0/3/3/0)",
    "firaks build tradeShip 7B3.",
    "ambas pass booster2 returning booster5",
    "firaks pass booster6 returning booster9",
    "ambas pass booster9 returning booster2",
  ];

  it("can trade when the trade cost is fulfilled", () => {
    const engine = new Engine(moves, { frontiers: true });
    expect(() => engine.move("firaks move tradeShip 7B3 7B3 trade 7B2.")).to.not.throw();
  });

  it("can not trade when the trade cost is not fulfilled", () => {
    const engine = new Engine(moves, { frontiers: true });
    expect(() =>
      engine.move("spend 3pw for 1o (0/3/3/0 ⇒ 3/3/0/0). firaks move tradeShip 7B3 7B3 trade 7B2.")
    ).to.throw();
  });
});
