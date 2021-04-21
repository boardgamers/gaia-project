import { expect } from "chai";
import Engine from "../engine";

const parseMoves = Engine.parseMoves;

describe("Itars", () => {
  it("should be able to gain a tech tile and decline another after PI is built", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction itars
      p1 build m -1x2
      p2 build m -1x0
      p2 build m 0x-4
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster4
      p1 build ts -1x2.
      p2 charge 1pw
      p2 build ts -1x0.
      p1 charge 2pw
      p1 build lab -1x2. tech gaia. up gaia.
      p2 charge 2pw
      p2 up gaia.
      p1 up gaia.
      p2 spend 1o for 1t. build gf -3x1. burn 2.
      p1 pass booster5
      p2 build PI -1x0.
      p1 charge 2pw
      p2 pass booster4
      p2 income 4pw
      p2 spend 4tg for tech. tech int. decline
      p1 build m -3x4
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should not be able to spend 4tg if there is no tech tile", function () {
    this.timeout(15_000);
    const moves = parseMoves(`init 4 Rumbly-secretary-1245
    p4 rotate -5x2 2 -6x10 2 -3x5 5 3x-5 1 5x-2 3 2x3 4 0x0 5
    p1 faction itars
    p2 faction taklons
    p3 faction geodens
    p4 faction lantids
    itars build m 8B1
    taklons build m 9A10
    geodens build m 8B5
    lantids build m 8A2
    lantids build m 10A4
    geodens build m 1A11
    taklons build m 6B0
    itars build m 9A4
    lantids booster booster3
    geodens booster booster5
    taklons booster booster9
    itars booster booster2
    taklons brainstone area3
    itars build ts 8B1.
    geodens charge 1pw
    lantids charge 1pw
    taklons action power6. build m 8B3.
    geodens charge 1pw
    itars charge 2pw
    geodens build ts 8B5.
    itars charge 2pw
    taklons charge 1pw
    lantids build ts 8A2.
    itars charge 2pw
    itars burn 3. action power7.
    taklons up nav.
    geodens build lab 8B5. tech free1. up eco.
    itars charge 2pw
    taklons charge 1pw. brainstone area3
    lantids build lab 8A2. tech nav. up nav.
    itars charge 2pw
    itars burn 4. action power3.
    taklons burn 1. spend 4pw for 1q. build m 9B3.
    lantids charge 2pw
    itars charge 1pw
    geodens spend 1q for 1o. build ac1 8B5. tech free2. up eco.
    itars decline 2pw
    taklons charge 1pw. brainstone area2
    lantids up nav.
    itars build m 4A11.
    taklons charge 1pw
    lantids charge 2pw
    taklons build ts 8B3.
    geodens charge 3pw
    itars decline 2pw
    geodens action power4.
    lantids build m 5B5.
    itars build PI 8B1.
    taklons charge 2pw. brainstone area3
    geodens charge 3pw
    lantids charge 2pw
    taklons action power5.
    geodens up nav.
    lantids pass booster10
    itars up gaia.
    taklons build lab 8B3. tech free1. up eco.
    geodens charge 3pw
    itars decline 3pw
    geodens spend 3pw for 1o. special range+3. build m 5A7.
    lantids charge 1pw
    itars build gf 9A3.
    taklons build m 4B3.
    geodens pass booster3
    itars spend 1o for 1t. build ts 4A11.
    taklons charge 1pw. brainstone area2
    taklons pass booster5
    itars spend 1o for 1t. pass booster9
    taklons brainstone area3
    itars income 1t. income 1t
    itars spend 4tg for tech. tech free2. up nav. spend 4tg for tech. tech free3. up nav. spend 4tg for tech. tech terra. up terra
    lantids action power3.
    geodens build ts 5A7.
    lantids charge 1pw
    taklons action power4.
    itars build m 9A3.
    taklons charge 1pw. brainstone area2
    lantids build ts 5B5.
    geodens charge 2pw
    geodens spend 2q for 2o. build PI 5A7.
    lantids charge 2pw
    taklons build ts 9B3.
    lantids charge 2pw
    itars charge 2pw
    itars action power7.
    lantids build PI 5B5.
    geodens charge 3pw
    geodens spend 3pw for 1o. build m 2A1.
    taklons charge 2pw. brainstone area3
    taklons spend 3pw for 1o. build lab 9B3. tech nav. up nav.
    lantids charge 2pw
    itars charge 2pw
    itars burn 1. action power6. build m 2A2.
    taklons charge 2pw. brainstone area3
    geodens charge 1pw
    lantids spend 1q for 1o. spend 2pw for 2c. build m 5A7.
    geodens charge 3pw
    geodens up terra.
    taklons spend 3pw for 1o. special range+3. build m 2B5.
    geodens charge 1pw
    itars build gf 8A4.
    lantids up nav.
    geodens pass booster2
    taklons special 4pw. brainstone area3.
    itars pass booster3
    lantids spend 1pw for 1c. special 4pw.
    taklons action power5.
    lantids spend 2pw for 2c. spend 2pw for 2c. pass booster9
    taklons up eco.
    taklons pass booster8
    geodens income 2t. income 4pw. income 2pw
    itars income 1t. income 1t
    itars spend 4tg for tech. tech gaia. up gaia
    geodens action power4.
    itars build m 2B2.
    taklons charge 1pw. brainstone area3
    geodens charge 1pw
    lantids action power3.
    taklons action power5.
    geodens up terra.
    itars up gaia.
    lantids build ts 10A4.
    geodens charge 3pw
    taklons up nav. brainstone area3.
    geodens build m 1A0.
    itars burn 1. action power7.
    lantids special 4pw.
    taklons action power6. build m 5A6.
    geodens charge 3pw
    lantids charge 1pw
    geodens action power1.
    itars build ts 2B2.
    taklons charge 1pw
    geodens charge 1pw
    lantids build m 5A6.
    taklons charge 1pw. brainstone area3
    geodens decline 3pw
    taklons special 4pw.
    geodens up nav.
    itars build lab 2B2. tech free1. up gaia.
    taklons charge 1pw
    geodens charge 1pw
    lantids up nav.
    taklons spend 2pw for 2c. action power2. build m 3B1.
    geodens decline 3pw
    lantids charge 1pw
    geodens build m 3A4.
    taklons charge 1pw. brainstone area2
    itars build gf 7A2.
    lantids spend 2pw for 2c. federation 10A4,5A6,5A7,5A8,5B4,5B5 fed6.
    taklons up eco.
    geodens up nav.
    itars federation 4A10,4A11,8A3,8B1,9A3,9A4,9A5 fed3.
    lantids build m 3A4.
    taklons charge 1pw
    geodens decline 3pw
    taklons burn 1. spend 4pw for 1q. pass booster5
    geodens federation 3A2,3A3,3A4,5A7,8A10,8B5 fed5.
    itars build gf 2A7. spend 1o for 1t.
    lantids up nav. lostPlanet 7A3.
    taklons charge 1pw. brainstone area2
    geodens pass booster7
    itars pass booster10
    lantids pass booster2
    taklons brainstone area3
    geodens income 1t
    itars income 4pw. income 1pw
    lantids income 2t
    itars spend 4tg for tech. tech adv-gaia. cover gaia. up int
    taklons spend 4pw for 1q. build m 3B4.
    geodens up nav.
    itars build m 6B4.
    taklons charge 1pw. brainstone area2
    lantids build m 7B0.
    taklons spend 1pw for 1c. special range+3. build m 7B4.
    lantids charge 1pw
    geodens build m 10B3.
    lantids charge 1pw
    itars build lab 4A11. tech int. up int.
    taklons charge 2pw
    lantids spend 1pw for 1c. action power6. build m 2A9.
    taklons charge 1pw. brainstone area3
    taklons action power4.
    geodens action power3.
    itars up int.
    lantids special 4pw.
    taklons special 4pw. brainstone area3.
    geodens build m 4B5.
    lantids charge 2pw
    itars charge 2pw
    taklons charge 1pw
    itars spend 3pw for 1o. build m 7A2.
    taklons charge 1pw
    lantids charge 1pw
    lantids spend 2pw for 2c. build m 2B5.
    itars charge 2pw
    taklons charge 1pw
    geodens charge 1pw
    taklons action power5. brainstone area1.
    geodens build m 1B2.
    itars burn 3. spend 3pw for 1o. build m 2A7.
    taklons charge 1pw. brainstone area2
    lantids charge 1pw
    lantids up int.
    taklons build ts 6B0.
    itars charge 1pw
    geodens pass booster9
    itars spend 1q for 1o. burn 1. spend 1pw for 1c. build m 8A4.
    taklons charge 2pw. brainstone area3
    geodens charge 1pw
    lantids charge 2pw
    lantids spend 1pw for 1c. pass booster3
    taklons action power7. brainstone area1.
    itars build gf 3A10.
    taklons spend 3pw for 3c. build ts 3B4.
    itars charge 1pw
    itars pass booster2
    taklons up eco.
    taklons spend 1o for 1t. federation 4A10,4A8,4A9,4B3,4B4,6A0,6B0,8A5,8B3,9A6,9B3 fed5. brainstone area1.
    taklons build lab 3B4. tech adv-eco. cover free1. up nav.
    itars charge 1pw
    taklons pass booster8
    geodens income 2pw. income 1t
    itars income 2t. income 4pw. income 1t. income 1pw
    itars spend 4tg for tech. tech nav. up nav
    geodens build m 7A10.
    lantids action power4.
    itars action power7.
    taklons spend 1o for 1t. spend 1o for 1t. special 4pw.
    geodens build ts 10B3.
    lantids charge 2pw
    lantids special 4pw.
    itars up int.
    taklons action power6. build m 1A3.
    geodens build ts 4B5.
    lantids charge 2pw
    itars charge 2pw
    taklons charge 1pw
    lantids spend 4pw for 1q. action qic1. tech free1. up int.
    itars spend 1pw for 1c. build ac2 2B2. tech eco. up eco.
    taklons charge 1pw
    lantids charge 1pw
    taklons action power3.
    geodens spend 4pw for 1q. build m 9A1.
    itars charge 1pw
    lantids build m 4B3.
    taklons charge 1pw. brainstone area2
    geodens decline 2pw
    itars burn 1. spend 2pw for 2c. build m 3A10.
    taklons charge 2pw. brainstone area3
    geodens decline 2pw
    taklons action power5.
    geodens up terra.
    lantids build ts 2A9.
    itars charge 1pw
    taklons charge 1pw. brainstone area2
    itars build gf 10A9.
    taklons build m 7A5.
    lantids charge 2pw
    geodens build m 4A6.
    lantids charge 1pw
    taklons charge 1pw
    lantids build ac2 8A2. tech free3. up int.
    itars decline 4pw
    taklons charge 2pw. brainstone area3
    geodens decline 2pw
    itars build gf 1A9.
    taklons up int.
    geodens up eco.
    lantids action qic2. fedtile fed6.
    itars special 4pw. spend 3pw for 3c.
    taklons up int.
    geodens up eco.
    lantids special q.
    itars special q.
    taklons action qic3.
    geodens pass booster7
    lantids spend 1q for 1o. build m 3A5.
    itars charge 1pw
    taklons charge 1pw
    geodens charge 1pw
    itars build gf 5A2.
    taklons spend 3pw for 1o. build ts 3B1.
    geodens decline 3pw
    lantids charge 1pw
    lantids pass booster9
    itars build ts 3A10.
    taklons charge 2pw
    geodens decline 2pw
    taklons spend 3pw for 1o. build ts 5A6.
    geodens decline 3pw
    itars pass booster10
    taklons spend 1pw for 1c. build ts 7A5.
    taklons pass booster2
    geodens income 1t
    itars income 1t. income 1t
    taklons income 4pw`);

    const engine = new Engine(moves, { advancedRules: true });

    expect(() => engine.move("itars spend 4tg for tech. tech sci. up sci. spend 4tg for tech")).to.throw();
  });
});
