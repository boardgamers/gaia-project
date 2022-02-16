import { expect } from "chai";
import Engine from "../engine";

describe("Trade ships", () => {
  describe("trade costs", () => {
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

  it("academy", function () {
    this.timeout(5000);

    const moves = [
      "init 4 Epic-way-5435",
      "p4 rotate 0x0 3 -6x10 3 -1x8 4 2x3 3 -8x7 2 -2x-3 2 5x-2 4 3x-5 5",
      "p1 faction ambas",
      "p2 faction xenos",
      "p3 faction hadsch-hallas",
      "p4 faction itars (0/0/0/0 ⇒ 4/4/0/0)",
      "ambas build m 7A9",
      "xenos build m 5A6",
      "hadsch-hallas build m 7B4",
      "itars build m 3B2",
      "itars build m 9A8",
      "hadsch-hallas build m 10A11",
      "xenos build m 10B1",
      "ambas build m 6B1",
      "xenos build m 3A6",
      "itars booster booster5",
      "hadsch-hallas booster booster4",
      "xenos booster booster1",
      "ambas booster booster10",
      "itars income 2pw (4/4/0/0 ⇒ 3/6/0/0)",
      "ambas build ts 7A9.",
      "xenos charge 1pw (2/4/0/0 ⇒ 1/5/0/0)",
      "hadsch-hallas charge 1pw (2/4/0/0 ⇒ 1/5/0/0)",
      "itars charge 1pw (3/6/0/0 ⇒ 2/7/0/0)",
      "xenos build ts 10B1.",
      "hadsch-hallas charge 1pw (1/5/0/0 ⇒ 0/6/0/0)",
      "hadsch-hallas build ts 7B4.",
      "ambas charge 2pw (2/4/0/0 ⇒ 0/6/0/0)",
      "itars special range+3. build m 6B5.",
      "ambas charge 1pw (0/6/0/0 ⇒ 0/5/1/0)",
      "ambas build lab 7A9. tech nav. up nav (1 ⇒ 2).",
      "xenos charge 1pw (1/5/0/0 ⇒ 0/6/0/0)",
      "hadsch-hallas charge 2pw (0/6/0/0 ⇒ 0/4/2/0)",
      "itars charge 1pw (2/7/0/0 ⇒ 1/8/0/0)",
      "xenos build lab 10B1. tech nav. up nav (0 ⇒ 1).",
      "hadsch-hallas charge 1pw (0/4/2/0 ⇒ 0/3/3/0)",
      "hadsch-hallas special step. build m 10A0.",
      "xenos charge 2pw (0/6/0/0 ⇒ 0/4/2/0)",
      "itars build ts 6B5.",
      "ambas charge 1pw (0/5/1/0 ⇒ 0/4/2/0)",
      "ambas build m 7B0.",
      "xenos charge 1pw (0/4/2/0 ⇒ 0/3/3/0)",
      "hadsch-hallas charge 2pw (0/3/3/0 ⇒ 0/1/5/0)",
      "xenos up nav (1 ⇒ 2).",
      "hadsch-hallas action power3. (0/1/5/0 ⇒ 4/1/1/0)",
      "itars up gaia (0 ⇒ 1).",
      "ambas build m 7B2.",
      "hadsch-hallas charge 2pw (4/1/1/0 ⇒ 2/3/1/0)",
      "xenos action power6. build m 5A7. (0/3/3/0 ⇒ 3/3/0/0)",
      "hadsch-hallas build lab 7B4. tech dip. up dip (0 ⇒ 1).",
      "ambas charge 2pw (0/4/2/0 ⇒ 0/2/4/0)",
      "itars burn 3. action power7. (1/8/0/0 ⇒ 6/2/0/3)",
      "ambas action power4. (0/2/4/0 ⇒ 4/2/0/0)",
      "xenos build m 10B4.",
      "hadsch-hallas charge 1pw (2/3/1/0 ⇒ 1/4/1/0)",
      "hadsch-hallas build tradeShip 10B0.",
      "itars build gf 6A9 using area1: 6. (6/2/0/3 ⇒ 0/2/0/9)",
      "ambas special 4pw. (4/2/0/0 ⇒ 0/6/0/0)",
      "xenos build m 5B5.",
      "hadsch-hallas build tradeShip 7B5.",
      "itars build PI 6B5.",
      "ambas charge 1pw (0/6/0/0 ⇒ 0/5/1/0)",
      "ambas up eco (0 ⇒ 1).",
      "xenos special 4pw. (3/3/0/0 ⇒ 0/5/1/0)",
      "hadsch-hallas up dip (1 ⇒ 2).",
      "itars burn 1. spend 1pw for 1c. build tradeShip 3A4. (0/2/0/9 ⇒ 1/0/0/10)",
      "ambas pass booster6 returning booster10",
      "xenos pass booster8 returning booster1",
      "hadsch-hallas pass booster1 returning booster4",
      "itars pass booster10 returning booster5",
      "itars income 1t. income 4pw (1/0/0/10 ⇒ 1/0/2/10)",
      "itars spend 4tg for tech. tech dip. up dip (0 ⇒ 1). spend 4tg for tech. tech eco. up eco (0 ⇒ 1) (1/0/2/10 ⇒ 3/0/2/0)",
      "ambas build tradeShip 7B5.",
      "xenos special 4pw. (0/5/1/0 ⇒ 0/1/5/0)",
      "hadsch-hallas move tradeShip 10B0 10C trade 10B1. (0/4/2/0 ⇒ 2/4/0/0)",
      "itars build m 6A9.",
      "hadsch-hallas charge 1pw (2/4/0/0 ⇒ 1/5/0/0)",
      "ambas special 4pw. (0/5/1/0 ⇒ 0/1/5/0)",
      "xenos action power4. (0/1/5/0 ⇒ 4/1/1/0)",
      "hadsch-hallas up dip (2 ⇒ 3). (1/5/0/0 ⇒ 0/4/2/0)",
      "itars move tradeShip 3A4 7A8 trade 7A9. (3/0/2/0 ⇒ 5/0/0/0)",
      "ambas action power3. (0/1/5/0 ⇒ 4/1/1/0)",
      "xenos build m 6A8.",
      "hadsch-hallas charge 1pw (0/4/2/0 ⇒ 0/3/3/0)",
      "itars charge 3pw (5/0/0/0 ⇒ 2/3/0/0)",
      "hadsch-hallas action power6. build m 1B1. (0/3/3/0 ⇒ 3/3/0/0)",
      "itars spend 1o for 1t. build gf 8A3 using area1: 3, area2: 3. (2/3/0/0 ⇒ 0/0/0/6)",
      "ambas build ac1 7A9. tech dip. up dip (0 ⇒ 1).",
      "xenos charge 1pw (4/1/1/0 ⇒ 3/2/1/0)",
      "hadsch-hallas charge 2pw (3/3/0/0 ⇒ 1/5/0/0)",
      "xenos build ts 10B4.",
      "hadsch-hallas charge 1pw (1/5/0/0 ⇒ 0/6/0/0)",
      "hadsch-hallas build ts 10A0.",
      "xenos charge 2pw (3/2/1/0 ⇒ 1/4/1/0)",
      "itars pass booster2 returning booster10",
      "ambas build tradeShip 6A1.",
      "xenos build ts 5A6.",
      "ambas charge 3pw (4/1/1/0 ⇒ 1/4/1/0)",
      "hadsch-hallas burn 1. move tradeShip 7B5 7C trade 7B2. (0/6/0/0 ⇒ 1/4/0/0)",
      "ambas pass booster5 returning booster6",
      "xenos up terra (0 ⇒ 1).",
      "hadsch-hallas build lab 10A0. tech free1. up dip (3 ⇒ 4).",
      "xenos charge 2pw (1/4/1/0 ⇒ 0/4/2/0)",
      "xenos pass booster4 returning booster8",
      "hadsch-hallas pass booster6 returning booster1",
      "itars income 2t. income 4pw. income 1t. income 1pw (0/0/0/6 ⇒ 1/1/2/6)",
      "itars spend 4tg for tech. tech gaia. up gaia (1 ⇒ 2) (1/1/2/6 ⇒ 6/1/2/0)",
      "itars build m 8A3.",
      "xenos charge 1pw (0/4/2/0 ⇒ 0/3/3/0)",
      "hadsch-hallas charge 2pw (0/2/3/0 ⇒ 0/0/5/0)",
      "ambas move tradeShip 7B5 7C trade 7B0.",
      "xenos action power7. (0/3/3/0 ⇒ 5/3/0/0)",
      "hadsch-hallas action power3. (0/0/5/0 ⇒ 4/0/1/0)",
      "itars build gf 9A7 using area1: 6. (6/1/2/0 ⇒ 0/1/2/6)",
      "ambas up dip (1 ⇒ 2).",
      "xenos build PI 10B4.",
      "hadsch-hallas charge 1pw (4/0/1/0 ⇒ 3/1/1/0)",
      "hadsch-hallas move tradeShip 7C 7A10 trade 5A6. (3/1/1/0 ⇒ 2/3/0/0)",
      "itars build ts 6A9.",
      "xenos charge 1pw (5/3/0/0 ⇒ 4/4/0/0)",
      "hadsch-hallas charge 2pw (2/3/0/0 ⇒ 0/5/0/0)",
      "ambas move tradeShip 6A1 6A1 trade 9A8. (0/3/3/0 ⇒ 2/3/1/0)",
      "xenos federation 10A1,10B1,10B4,10C,6A8 fed5 using area1: 2. (4/4/0/0 ⇒ 2/4/0/0)",
      "hadsch-hallas build ts 10A11.",
      "xenos charge 3pw (2/4/0/0 ⇒ 0/5/1/0)",
      "itars federation 6A9,6B5,8A3 fed3. (0/1/2/6 ⇒ 2/1/2/6)",
      "ambas special 4pw. (2/3/1/0 ⇒ 0/3/3/0)",
      "xenos special 4pw. (0/5/1/0 ⇒ 0/1/5/0)",
      "hadsch-hallas build PI 10A11.",
      "xenos charge 1pw (0/1/5/0 ⇒ 0/0/6/0)",
      "itars up nav (0 ⇒ 1).",
      "ambas special range+3. build m 1B5.",
      "hadsch-hallas charge 1pw (0/5/0/0 ⇒ 0/4/1/0)",
      "xenos action power6. build m 8B2. (0/0/6/0 ⇒ 3/0/3/0)",
      "hadsch-hallas charge 3pw (0/4/1/0 ⇒ 0/1/4/0)",
      "itars charge 2pw (2/1/2/6 ⇒ 0/3/2/6)",
      "hadsch-hallas action power4. (0/1/4/0 ⇒ 4/1/0/0)",
      "itars move tradeShip 7A8 7B3 trade 7B2. (0/3/2/6 ⇒ 2/3/0/6)",
      "ambas build ts 7B0.",
      "xenos charge 2pw (3/0/3/0 ⇒ 1/2/3/0)",
      "hadsch-hallas charge 2pw (4/1/0/0 ⇒ 2/3/0/0)",
      "itars charge 1pw (2/3/0/6 ⇒ 1/4/0/6)",
      "xenos special step. build m 9A2.",
      "hadsch-hallas spend 3c for 1o. spend 1o for 1t. burn 1. move tradeShip 10C 10B5 trade 10B4. (2/3/0/0 ⇒ 0/1/5/0)",
      "itars burn 2. spend 1pw for 1c. build m 4A1. (1/4/0/6 ⇒ 2/0/1/8)",
      "xenos charge 1pw (1/2/3/0 ⇒ 0/3/3/0)",
      "ambas pass booster10 returning booster5",
      "xenos spend 3pw for 1o. build m 1A9. (0/3/3/0 ⇒ 3/3/0/0)",
      "ambas charge 1pw (0/3/3/0 ⇒ 0/2/4/0)",
      "hadsch-hallas spend 3c for 1o. spend 4c for 1q. action power2. build m 8B4. (0/1/5/0 ⇒ 5/1/0/0)",
      "xenos charge 1pw (3/3/0/0 ⇒ 2/4/0/0)",
      "itars pass booster8 returning booster2",
      "xenos pass booster2 returning booster4",
      "hadsch-hallas up terra (0 ⇒ 1).",
      "hadsch-hallas build ts 8B4.",
      "xenos charge 1pw (2/4/0/0 ⇒ 1/5/0/0)",
      "hadsch-hallas federation 10A0,10A11,8A5,8B3,8B4 fed5 using area1: 2. (5/1/0/0 ⇒ 3/1/0/0)",
      "hadsch-hallas spend 12c for 3q. action qic2. fedtile fed5.",
      "hadsch-hallas spend 4c for 1q. spend 3c for 1o. build m 1A6.",
      "hadsch-hallas pass booster4 returning booster6",
      "itars income 4pw. income 1t. income 1pw (2/0/1/8 ⇒ 1/1/3/8)",
      "xenos income 4pw (1/5/0/0 ⇒ 2/3/3/0)",
      "hadsch-hallas income 1t (3/1/0/0 ⇒ 0/1/4/0)",
      "itars spend 4tg for tech. tech nav. up nav (1 ⇒ 2). spend 4tg for tech. tech free2. up gaia (2 ⇒ 3) (1/1/3/8 ⇒ 0/0/5/0)",
      "ambas action power6. build m 3A3. (0/0/6/0 ⇒ 3/0/3/0)",
      "xenos charge 2pw (2/3/3/0 ⇒ 0/5/3/0)",
      "hadsch-hallas charge 1pw (0/1/4/0 ⇒ 0/0/5/0)",
      "itars action power7. (0/0/5/0 ⇒ 5/0/2/0)",
      "xenos special 4pw. (0/5/3/0 ⇒ 0/1/7/0)",
      "hadsch-hallas spend 12c for 3q. action qic2. fedtile fed5. spend 1pw for 1c. (0/0/5/0 ⇒ 1/0/4/0)",
      "ambas build PI 7B0.",
      "xenos charge 1pw (0/1/7/0 ⇒ 0/0/8/0)",
      "hadsch-hallas charge 2pw (1/0/4/0 ⇒ 0/0/5/0)",
      "itars charge 1pw (5/0/2/0 ⇒ 4/1/2/0)",
      "itars build m 3B5.",
      "xenos action power4. (0/0/8/0 ⇒ 4/0/4/0)",
      "hadsch-hallas action power3. (0/0/5/0 ⇒ 4/0/1/0)",
      "ambas federation 3A3,7A9,7B0,7B5 fed6 using area1: 1. (3/0/3/0 ⇒ 2/0/3/0)",
      "itars build gf 3A0 using area1: 4. (4/1/2/0 ⇒ 0/1/2/4)",
      "xenos build lab 5A6. tech free2. up nav (2 ⇒ 3). (4/0/4/0 ⇒ 1/3/4/0)",
      "ambas charge 3pw (2/0/3/0 ⇒ 0/1/4/0)",
      "hadsch-hallas up dip (4 ⇒ 5).",
      "ambas action power5. (0/1/4/0 ⇒ 4/1/0/0)",
      "itars build m 9A7.",
      "ambas charge 1pw (4/1/0/0 ⇒ 3/2/0/0)",
      "xenos up nav (3 ⇒ 4).",
      "hadsch-hallas special step. build m 1A5.",
      "ambas up dip (2 ⇒ 3). (3/2/0/0 ⇒ 0/5/0/0)",
      "itars build ts 4A1.",
      "xenos charge 1pw (1/3/4/0 ⇒ 0/4/4/0)",
      "xenos action qic3.",
      "hadsch-hallas move tradeShip 10B5 10A1 trade 6A8.",
      "ambas up dip (3 ⇒ 4).",
      "itars spend 1pw for 1c. special 4pw. spend 3pw for 1o. (0/1/2/4 ⇒ 3/0/0/4)",
      "xenos build ac1 5A6. tech adv-nav. cover free2. up terra (1 ⇒ 2).",
      "ambas decline 3pw",
      "hadsch-hallas build ac1 7B4. tech free2. up eco (1 ⇒ 2).",
      "itars charge 1pw (3/0/0/4 ⇒ 2/1/0/4)",
      "ambas charge 3pw (0/5/0/0 ⇒ 0/2/3/0)",
      "ambas move tradeShip 7C 7B5 trade 7B4. (0/2/3/0 ⇒ 1/2/2/0)",
      "itars build lab 4A1. tech free1. up nav (2 ⇒ 3). (2/1/0/4 ⇒ 0/2/1/4)",
      "xenos charge 1pw (0/4/4/0 ⇒ 0/3/5/0)",
      "xenos spend 1pw for 1c. pass booster6 returning booster2 (0/3/5/0 ⇒ 1/3/4/0)",
      "hadsch-hallas build ts 1B1.",
      "ambas charge 1pw (1/2/2/0 ⇒ 0/3/2/0)",
      "ambas up nav (2 ⇒ 3). (0/3/2/0 ⇒ 0/0/5/0)",
      "itars burn 1. move tradeShip 7B3 7A11 trade 7B0. (0/2/1/4 ⇒ 1/2/0/5)",
      "hadsch-hallas federation 1A1,1A5,1A6,1B1,1B2,7A8,7B4 fed5 using area1: 3. (4/0/1/0 ⇒ 1/0/1/0)",
      "ambas action power2. build m 2B3. (0/0/5/0 ⇒ 5/0/0/0)",
      "itars spend 1q for 1o. spend 1o for 1t. build gf 6A5 using area1: 2, area2: 2. (1/2/0/5 ⇒ 0/0/0/9)",
      "hadsch-hallas move tradeShip 7A10 7A10 trade 7A9. spend 1pw for 1c. (1/0/1/0 ⇒ 2/0/0/0)",
      "ambas build m 2B0.",
      "itars pass booster2 returning booster8",
      "hadsch-hallas up eco (2 ⇒ 3). spend 1pw for 1c. (2/0/0/0 ⇒ 1/1/0/0)",
      "ambas special 4pw. (5/0/0/0 ⇒ 1/4/0/0)",
      "hadsch-hallas spend 3c for 1o. build tradeShip 1B0.",
      "ambas special swap-PI (from 7B0). swap-PI 6B1 (from 7B0).",
      "hadsch-hallas spend 3c for 1o. spend 1o for 1t. pass booster8 returning booster4 (1/1/0/0 ⇒ 2/1/0/0)",
      "ambas burn 1. move tradeShip 6A1 6B4 trade 6A8. (1/4/0/0 ⇒ 2/2/0/0)",
      "ambas pass booster4 returning booster10",
      "itars income 2t. income 4pw. income 1t. income 1pw (0/0/0/9 ⇒ 1/1/2/9)",
      "hadsch-hallas income 1t (2/1/0/0 ⇒ 0/0/4/0)",
      "ambas income 2t (2/2/0/0 ⇒ 0/2/4/0)",
      "itars spend 4tg for tech. tech free3. up nav (3 ⇒ 4). decline tech (1/1/2/9 ⇒ 6/1/2/0)",
      "xenos action power4. (0/1/7/0 ⇒ 4/1/3/0)",
      "itars up nav (4 ⇒ 5). lostPlanet 1A0.",
      "ambas charge 2pw (0/2/4/0 ⇒ 0/0/6/0)",
      "xenos charge 1pw (4/1/3/0 ⇒ 3/2/3/0)",
      "hadsch-hallas action power5. (0/0/4/0 ⇒ 4/0/0/0)",
      "ambas action power6. build m 4A4. (0/0/6/0 ⇒ 3/0/3/0)",
      "xenos charge 1pw (3/2/3/0 ⇒ 2/3/3/0)",
      "xenos build m 2A7.",
      "itars charge 1pw (6/1/2/0 ⇒ 5/2/2/0)",
      "ambas charge 1pw (3/0/3/0 ⇒ 2/1/3/0)",
      "itars build ac1 4A1. tech terra. up terra (0 ⇒ 1).",
      "xenos charge 1pw (2/3/3/0 ⇒ 1/4/3/0)",
      "hadsch-hallas spend 8c for 2q. action qic2. fedtile fed5.",
      "ambas move tradeShip 6B4 10A1 trade 10B1. (2/1/3/0 ⇒ 3/1/2/0)",
      "xenos up terra (2 ⇒ 3). (1/4/3/0 ⇒ 0/3/5/0)",
      "itars move tradeShip 7A11 5B3 trade 5A6. (5/2/2/0 ⇒ 7/2/0/0)",
      "hadsch-hallas spend 8c for 2q. action qic3.",
      "ambas move tradeShip 7B5 3A2 trade 5A6. (3/1/2/0 ⇒ 4/1/1/0)",
      "xenos action power3. (0/3/5/0 ⇒ 4/3/1/0)",
      "itars up gaia (3 ⇒ 4).",
      "hadsch-hallas up terra (1 ⇒ 2).",
      "ambas special 4pw. (4/1/1/0 ⇒ 0/5/1/0)",
      "xenos federation 5A10,5A6,5A7,5B4,5B5,9A2 fed3 using area1: 2.",
      "itars build gf 7A6 using area1: 3. (7/2/0/0 ⇒ 4/2/0/3)",
      "hadsch-hallas up terra (2 ⇒ 3). (4/0/0/0 ⇒ 1/3/0/0)",
      "ambas up terra (0 ⇒ 1).",
      "xenos build ts 2A7.",
      "itars charge 1pw (4/2/0/3 ⇒ 3/3/0/3)",
      "ambas charge 1pw (0/5/1/0 ⇒ 0/4/2/0)",
      "itars build m 3A0.",
      "xenos charge 1pw (4/3/1/0 ⇒ 3/4/1/0)",
      "hadsch-hallas spend 4c for 1q. build m 6B3.",
      "itars charge 4pw (3/3/0/3 ⇒ 0/5/1/3)",
      "ambas charge 3pw (0/4/2/0 ⇒ 0/1/5/0)",
      "xenos charge 1pw (3/4/1/0 ⇒ 2/5/1/0)",
      "ambas action power2. build m 2A3. (0/1/5/0 ⇒ 5/1/0/0)",
      "itars charge 1pw (0/5/1/3 ⇒ 0/4/2/3)",
      "xenos build m 4B2.",
      "itars charge 4pw (0/4/2/3 ⇒ 0/0/6/3)",
      "ambas charge 1pw (5/1/0/0 ⇒ 4/2/0/0)",
      "itars action power7. (0/0/6/3 ⇒ 5/0/3/3)",
      "hadsch-hallas move tradeShip 10A1 6B4 trade 6A9. spend 1pw for 1c. (1/3/0/0 ⇒ 1/2/1/0)",
      "ambas build ts 4A4.",
      "xenos charge 1pw (2/5/1/0 ⇒ 1/6/1/0)",
      "xenos special 4pw. (1/6/1/0 ⇒ 0/4/4/0)",
      "itars build gf 2A9 using area1: 3. (5/0/3/3 ⇒ 2/0/3/6)",
      "hadsch-hallas build ts 6B3.",
      "itars charge 4pw (2/0/3/6 ⇒ 0/0/5/6)",
      "ambas decline 3pw",
      "xenos charge 1pw (0/4/4/0 ⇒ 0/3/5/0)",
      "ambas special step. build m 2A4.",
      "xenos spend 2pw for 2c. build lab 2A7. tech terra. up terra (3 ⇒ 4). (0/3/5/0 ⇒ 2/3/3/0)",
      "ambas charge 1pw (4/2/0/0 ⇒ 3/3/0/0)",
      "itars spend 3pw for 1o. build m 6A5. (0/0/5/6 ⇒ 3/0/2/6)",
      "ambas decline 3pw",
      "hadsch-hallas charge 2pw (1/2/1/0 ⇒ 0/2/2/0)",
      "hadsch-hallas move tradeShip 1B0 1A10 trade 1B5.",
      "ambas up nav (3 ⇒ 4).",
      "xenos up terra (4 ⇒ 5).",
      "itars special 4pw. (3/0/2/6 ⇒ 0/2/3/6)",
      "hadsch-hallas spend 4c for 1q. build m 4B0. spend 1pw for 1c. (0/2/2/0 ⇒ 1/2/1/0)",
      "itars charge 2pw (0/2/3/6 ⇒ 0/0/5/6)",
      "xenos charge 1pw (2/3/3/0 ⇒ 1/4/3/0)",
      "ambas federation 2A3,2A4,2A5,2B0,2B1,2B3,6A0,6A1,6B1 fed2 using area1: 3, area2: 1. (3/3/0/0 ⇒ 0/2/0/0)",
      "xenos spend 3pw for 3c. build ts 8B2. (1/4/3/0 ⇒ 4/4/0/0)",
      "hadsch-hallas charge 3pw (1/2/1/0 ⇒ 0/1/3/0)",
      "ambas charge 1pw (0/2/0/0 ⇒ 0/1/1/0)",
      "itars spend 3pw for 1o. build gf 1A3 using area1: 3. (0/0/5/6 ⇒ 0/0/2/9)",
      "hadsch-hallas spend 1pw for 1c. move tradeShip 7A10 3A1 trade 5A7. (0/1/3/0 ⇒ 1/1/2/0)",
      "ambas build ts 7B2.",
      "hadsch-hallas charge 3pw (1/1/2/0 ⇒ 0/0/4/0)",
      "xenos burn 2. spend 2pw for 2c. build m 8B0. (4/4/0/0 ⇒ 6/0/0/0)",
      "itars build ts 9A8.",
      "ambas charge 1pw (0/1/1/0 ⇒ 0/0/2/0)",
      "hadsch-hallas build lab 6B3. tech terra. up terra (3 ⇒ 4). spend 2pw for 2c. (0/0/4/0 ⇒ 2/0/2/0)",
      "xenos charge 1pw (6/0/0/0 ⇒ 5/1/0/0)",
      "ambas spend 1pw for 1c. spend 1pw for 1c. build lab 4A4. tech terra. up terra (1 ⇒ 2). (0/0/2/0 ⇒ 2/0/0/0)",
      "xenos charge 1pw (5/1/0/0 ⇒ 4/2/0/0)",
      "hadsch-hallas charge 1pw (2/0/2/0 ⇒ 1/1/2/0)",
      "xenos pass booster10 returning booster6",
      "itars pass booster6 returning booster2",
      "hadsch-hallas spend 9c for 3o. build ac2 6B3. tech free3. up eco (3 ⇒ 4). spend 1pw for 1c. (1/1/2/0 ⇒ 2/1/1/0)",
      "ambas decline 3pw",
      "xenos charge 1pw (4/2/0/0 ⇒ 3/3/0/0)",
      "ambas up eco (1 ⇒ 2).",
      "hadsch-hallas special q.",
      "ambas up eco (2 ⇒ 3). (2/0/0/0 ⇒ 0/1/1/0)",
      "hadsch-hallas up int (0 ⇒ 1).",
      "ambas special swap-PI (from 6B1). swap-PI 1B5 (from 6B1).",
      "hadsch-hallas spend 1q for 1o. spend 3c for 1o. build m 3A7.",
      "xenos charge 1pw (3/3/0/0 ⇒ 2/4/0/0)",
      "ambas spend 1pw for 1c. spend 1k for 1c. build m 4B4. (0/1/1/0 ⇒ 1/1/0/0)",
      "xenos charge 1pw (2/4/0/0 ⇒ 1/5/0/0)",
      "hadsch-hallas charge 1pw (2/1/1/0 ⇒ 1/2/1/0)",
      "hadsch-hallas spend 1pw for 1c. pass booster2 returning booster8 (1/2/1/0 ⇒ 2/2/0/0)",
      "ambas pass booster8 returning booster4",
      "itars income 1t. income 1t (0/0/2/9 ⇒ 0/0/4/9)",
      "hadsch-hallas income 1t. income 2t (2/2/0/0 ⇒ 0/0/7/0)",
      "ambas income 2t (1/1/0/0 ⇒ 0/0/4/0)",
      "itars decline tech (0/0/4/9 ⇒ 9/0/4/0)",
      "xenos burn 1. action power4. (0/3/3/0 ⇒ 4/1/0/0)",
      "itars build m 1A3.",
      "hadsch-hallas spend 8c for 2q. spend 2pw for 2c. action qic3. (0/0/7/0 ⇒ 2/0/5/0)",
      "ambas action power5. (0/0/4/0 ⇒ 4/0/0/0)",
      "xenos build ts 3A6.",
      "hadsch-hallas charge 1pw (2/0/5/0 ⇒ 1/1/5/0)",
      "itars decline 4pw",
      "ambas decline 3pw",
      "itars build m 2A9.",
      "ambas charge 1pw (4/0/0/0 ⇒ 3/1/0/0)",
      "xenos charge 2pw (4/1/0/0 ⇒ 2/3/0/0)",
      "hadsch-hallas spend 12c for 3q. action qic2. fedtile fed5.",
      "ambas up eco (3 ⇒ 4).",
      "xenos build m 9B5.",
      "itars charge 2pw (9/0/4/0 ⇒ 7/2/4/0)",
      "ambas charge 1pw (3/1/0/0 ⇒ 2/2/0/0)",
      "itars federation 3A0,3A11,3A8,3A9,3B5,4A1,6A4,6A5 fed4 using area1: 4. (7/2/4/0 ⇒ 3/2/4/0)",
      "hadsch-hallas build lab 8B4. tech adv-dip. cover free2. up int (1 ⇒ 2).",
      "xenos charge 2pw (2/3/0/0 ⇒ 0/5/0/0)",
      "ambas build lab 7B2. tech adv-eco. cover terra. up eco (4 ⇒ 5). spend 1pw for 1c. (2/2/0/0 ⇒ 1/0/3/0)",
      "hadsch-hallas decline 3pw",
      "itars charge 1pw (3/2/4/0 ⇒ 2/3/4/0)",
      "xenos spend 1q for 1o. build ac2 2A7. tech free3. up int (1 ⇒ 2).",
      "itars charge 1pw (2/3/4/0 ⇒ 1/4/4/0)",
      "ambas charge 1pw (1/0/3/0 ⇒ 0/1/3/0)",
      "itars build ts 9A7.",
      "ambas charge 1pw (0/1/3/0 ⇒ 0/0/4/0)",
      "xenos charge 1pw (0/5/0/0 ⇒ 0/4/1/0)",
      "hadsch-hallas build m 4A8. spend 1pw for 1c. (1/1/5/0 ⇒ 2/1/4/0)",
    ];

    const engine = new Engine(moves, { frontiers: true, advancedRules: true });
    expect(() => engine.move("ambas move tradeShip 10A1 6A7 trade 6B3.")).to.not.throw();
  });
});
