import { expect } from "chai";
import Engine from "../engine";
import { Player } from '../enums';

const parseMoves = Engine.parseMoves;

describe("Ambas", () => {
  it("should allow Ambas to use piswap", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction nevlas
      p2 faction ambas
      p1 build m 2x2
      p2 build m 2x4
      p2 build m 5x-3
      p1 build m 3x-3
      p2 booster booster3
      p1 booster booster4
      p1 build ts 2x2.
      p2 charge 1pw
      p2 build ts 2x4.
      p1 charge 2pw
      p1 pass booster7
      p2 build PI 2x4.
      p1 charge 2pw
    `);

    expect(() => new Engine([...moves, "p2 special swap-PI. swap-PI 5x-3."])).to.not.throw();
    expect(() => new Engine([...moves, "p2 special swap-PI. swap-PI 3x-3."])).to.throw();
  });

  it("should allow Ambas to use piswap and recal available feds", () => {
    const moves = parseMoves(`
        init 2 bosco-marcuzzo3
        p1 faction geodens
        p2 faction ambas
        geodens build m 3x-1
        ambas build m -1x0
        ambas build m -4x1
        geodens build m 0x-4
        ambas booster booster5
        geodens booster booster4
        geodens special step. build m 2x-1.
        ambas up nav.
        geodens build m -1x2.
        ambas charge 1pw
        ambas build m -5x3.
        geodens up terra.
        ambas build m -6x2.
        geodens build ts -1x2.
        ambas charge 1pw
        ambas special range+3. build m -3x-3.
        geodens build PI -1x2.
        ambas charge 1pw
        ambas build ts -1x0.
        geodens charge 3pw
        geodens pass booster9
        ambas action power6. build m -3x-4.
        ambas pass booster4
        geodens income 1t
        geodens action power1.
        ambas special step. build m -5x0.
        geodens up terra.
        ambas build PI -1x0.
        geodens charge 3pw
        geodens build m 1x0.
        ambas decline
        ambas federation -1x0,-2x1,-3x1,-4x1,-5x0,-5x1,-5x2,-5x3,-6x2 fed5.
        geodens pass booster6
        ambas pass booster5
        geodens income 4pw
        ambas income 2t
        geodens burn 1. action power4.
        ambas special range+3. build m 0x3.
        geodens charge 3pw
        geodens build ts 1x0.
        ambas build ts 0x3.
        geodens charge 3pw
        geodens up terra.
        ambas action power6. build m 0x2.
        geodens charge 3pw
        geodens action power3.
        ambas pass booster8
        geodens federation -1x2,0x1,1x0,2x-1,3x-1 fed5.
        geodens build m 1x-4.
        geodens build m 0x-5.
        geodens build m 2x-5.
        geodens pass booster5
        ambas income 4pw
        geodens income 4pw. income 2pw
        ambas up nav.
        geodens special range+3. build m -2x-2.
        ambas charge 1pw
        ambas action power4.
        geodens up terra.
        ambas build lab 0x3. tech sci. up sci.
        geodens charge 3pw
        geodens build m 4x-6.
        ambas build ts -3x-3.
        geodens charge 1pw
        geodens action power3.
        ambas burn 1. spend 1pw for 1c. spend 1o for 1c. spend 1o for 1c. build lab -3x-3. tech free2. up eco.
        geodens charge 1pw
        geodens build ts -2x-2.
        ambas charge 2pw
        ambas special 4pw.
        geodens federation -1x-3,-2x-2,0x-4,0x-5,1x-4,2x-5,3x-5,4x-6 fed2.
        ambas special swap-PI. swap-PI 0x2.
        geodens up int.
        ambas pass booster6
        geodens burn 1. spend 3pw for 1o. build m -2x4.
        ambas decline
        geodens up int.
        geodens pass booster9
        ambas income 4pw. income 2t
        geodens income 4pw. income 4pw
        ambas action power4.
        geodens spend 4pw for 1q. build lab 1x0. tech free3. up int.
        ambas decline
        ambas up nav.
        geodens up int.
        ambas build m 2x4.
        geodens action qic2. fedtile fed5.
        ambas federation 0x2,0x3,1x3,1x4,2x4 fed5.
        geodens build ts -2x4.
        ambas charge 4pw
        ambas spend 1pw for 1c. special 4pw.
        geodens spend 1q for 1o. build m 3x1.
        ambas build ac2 -3x-3. tech nav. up nav. lostPlanet 4x-1.
        geodens charge 2pw
        geodens up int.
        ambas spend 4pw for 1q. build m 5x-1.
        geodens charge 1pw
        geodens action qic3.
        ambas special q.
        geodens up nav.
        ambas special swap-PI. swap-PI -3x-4.
        geodens action qic1. tech nav. up nav.
        ambas pass booster8
        geodens pass booster6
        ambas income 4pw. income 1pw
        geodens income 4pw
        ambas special q.
        geodens action power5.
        ambas federation -3x-3,-3x-4 fed2.
        geodens up nav.
        ambas special 4pw.
        geodens build ts 3x1.
        ambas charge 1pw
        ambas burn 1. build ts 5x-1.
        geodens charge 2pw
        geodens build m 3x-4.
        ambas action power6. build m 3x-3.
        geodens charge 1pw
        geodens burn 2. spend 4pw for 1q. action qic3.
        ambas special swap-PI. swap-PI 3x-3.
        geodens pass
    `);

    expect(() => new Engine([...moves, "ambas federation 3x-3,4x-1,4x-2,4x-3,5x-1 fed4."])).to.not.throw();

  });

});
