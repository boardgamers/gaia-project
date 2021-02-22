import { expect } from "chai";
import Engine from "./engine";
import { Player } from "./enums";

const parseMoves = Engine.parseMoves;

describe("Free Actions", () => {
  it("should allow free action as first move after setupsetup is correct", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m -4x-1
      p2 build m -1x0
      p2 build m 0x-4
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster4
      p1 spend 1q for 1o
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should allow free actions to spend 1q for 1c", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m -4x-1
      p2 build m -1x0
      p2 build m 0x-4
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster4
      p1 spend 1q for 1c
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should prevent unreasonable free actions", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m -4x-1
      p2 build m -1x0
      p2 build m 0x-4
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster4
    `);

    const engine = new Engine(moves);

    expect(() => engine.move("p1 spend ~ for ~")).to.throw();
    expect(() => engine.move("p1 spend 1q for 2o")).to.throw();
  });

  it("should allow to do free actions after main actions", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction nevlas
      p1 build m -1x2
      p2 build m -1x0
      p2 build m 0x-4
      p1 build m -4x2
      p2 booster booster4
      p1 booster booster7
      p1 build ts -1x2. burn 2.
      p2 charge 1pw
      p2 build ts -1x0. burn 1
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });
});

describe("Power/QIC Actions", () => {
  it("should allow poweraction", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction bescods
      p1 build m -1x2
      p2 build m -1x-1
      p2 build m 3x-2
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster7
      p1 up gaia.
      p2 build ts -1x-1.
      p1 build m -1x0.
      p2 charge 2pw
      p2 burn 3. action power7
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("action power6 should increase terraforming step", () => {
    const moves = parseMoves(`
      init 2 randomSeed2
      p1 faction ivits
      p2 faction geodens
      p2 build m 3x-1
      p2 build m -1x-1
      p1 build PI 2x-1
      p2 booster booster4
      p1 booster booster3
      p1 income 4pw
      p1 burn 1. action power6. build m 3x2
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("action qic2 should rescore federation", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction bescods
      p1 build m -1x2
      p2 build m -1x-1
      p2 build m 3x-2
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster7
      p1 up gaia.
      p2 build ts -1x-1.
      p1 build gf -2x3.
      p2 build m -1x0.
      p1 charge 1pw
      p1 build ts -1x2.
      p2 charge 1pw
      p2 build m 1x0.
      p1 charge 2pw
      p1 build m -3x4.
      p2 pass booster8
      p1 build PI -1x2.
      p2 charge 1pw
      p1 pass booster3
      p1 income t
      p1 spend 4tg for 1k. spend 2tg for 2c
      p2 burn 3. spend 3pw for 1o. pass booster5
      p1 build m -2x3. spend 2pw for 2c.
      p1 build ts -4x2.
      p1 federation -1x2,-2x3,-3x3,-3x4,-4x2,-4x3 fed2.
    `);

    expect(() => new Engine([...moves, "p1 burn 1. spend 4pw for 1q. action qic2. fedtile fed3"])).to.throw();

    const engine = new Engine(moves);
    const vp = engine.player(Player.Player1).data.victoryPoints;
    expect(() => engine.move("p1 burn 1. spend 4pw for 1q. action qic2. fedtile fed2")).to.not.throw();
    expect(engine.player(Player.Player1).data.victoryPoints).to.equal(vp + 8);
  });

  it("should prevent the rescore fed action when no federation token", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction bescods
      p2 faction hadsch-hallas
      p1 build m 3x-2
      p2 build m -2x-4
      p2 build m -5x0
      p1 build m -2x-5
      p2 booster booster4
      p1 booster booster3
      p1 build ts -2x-5.
      p2 charge 1pw
      p2 build ts -2x-4.
      p1 charge 2pw
      p1 build lab -2x-5. tech nav. up nav.
      p2 charge 2pw
      p2 build lab -2x-4. tech eco. up eco.
      p1 charge 2pw
    `);

    const engine = new Engine(moves);
    expect(engine.player(Player.Player1).data.qics).to.equal(3);
    expect(() => engine.move("p1 action qic2")).to.throw();
  });

  it("should not allow to take the same action multiple times in one turn", () => {
    const moves = [
      "init 4 Klingon-Empire",
      "p1 faction lantids",
      "p2 faction ivits",
      "p3 faction firaks",
      "p4 faction xenos",
      "lantids build m 3A5",
      "firaks build m 7A6",
      "xenos build m 5A10",
      "xenos build m 6A4",
      "firaks build m 8B5",
      "lantids build m 8A6",
      "xenos build m 3A4",
      "ivits build PI 7B0",
      "xenos booster booster5",
      "firaks booster booster1",
      "ivits booster booster9",
      "lantids booster booster2",
      "ivits income 4pw. income 1t",
      "lantids build ts 3A5.",
      "xenos charge 1pw",
      "ivits build m 7B4.",
      "firaks charge 1pw",
      "xenos charge 1pw",
      "firaks build ts 7A6.",
      "xenos charge 1pw",
      "ivits charge 1pw",
      "xenos build ts 5A10.",
      "firaks charge 2pw",
      "lantids build PI 3A5.",
      "xenos charge 1pw",
      "ivits action power3.",
      "firaks build lab 7A6. tech eco. up eco.",
      "xenos charge 2pw",
      "ivits charge 1pw",
      "xenos action power4.",
      "lantids build m 6B1.",
      "xenos charge 1pw",
      "ivits special space-station. build sp 7B3.",
      "firaks up eco.",
      "xenos build PI 5A10.",
      "firaks charge 2pw",
      "lantids up nav.",
      "ivits up int.",
      "firaks action power6. build m 8B3.",
      "lantids charge 1pw",
      "xenos special range+3. build m 7B2.",
      "ivits charge 3pw",
      "firaks charge 2pw",
      "lantids build m 8B3.",
      "firaks charge 1pw",
      "ivits build m 2A7.",
      "xenos charge 1pw",
      "lantids charge 1pw",
      "firaks pass booster6",
      "xenos up gaia.",
      "lantids pass booster1",
      "ivits pass booster10",
      "xenos burn 1. action power7.",
      "xenos build gf 6A5.",
      "xenos pass booster2",
      "ivits income 1t",
      "xenos income 2t",
      "firaks burn 1. action power4.",
      "lantids up nav.",
      "ivits build ts 7B4.",
      "firaks charge 2pw",
      "xenos charge 1pw",
      "xenos build ts 6A4.",
      "lantids charge 1pw",
      "ivits charge 2pw",
      "firaks build ts 8B5.",
      "lantids charge 1pw",
      "lantids spend 2pw for 2c. spend 1o for 1c. build ts 8A6.",
      "firaks charge 1pw",
      "ivits special space-station. build sp 7A5.",
      "xenos build ts 3A4.",
      "lantids charge 3pw",
      "ivits charge 1pw",
      "firaks build PI 8B5.",
      "lantids charge 1pw",
      "lantids spend 1pw for 1c. pass booster5",
      "ivits action power3.",
      "xenos spend 1q for 1o. build m 6A5.",
      "lantids charge 1pw",
      "firaks charge 3pw",
      "firaks up terra.",
      "ivits action power6. build m 5A11.",
      "firaks decline 2pw",
      "xenos charge 3pw",
      "xenos build gf 8A1.",
      "firaks special down-lab. build ts 7A6. up eco. spend 1pw for 1c.",
      "xenos charge 2pw",
      "ivits charge 2pw",
      "ivits build ts 5A11.",
      "firaks charge 2pw",
      "xenos action power7.",
      "firaks action power5.",
      "ivits build ts 2A7.",
      "xenos charge 2pw",
      "lantids charge 1pw",
      "xenos pass booster1",
      "firaks build lab 7A6. tech free2. up eco.",
      "xenos charge 3pw",
      "ivits charge 2pw",
      "ivits pass booster9",
      "firaks special 4pw.",
      "firaks spend 1pw for 1c. pass booster8",
      "ivits income 4pw. income 4pw",
      "firaks income 4pw. income 1t",
      "lantids action power4.",
      "xenos action power3.",
      "ivits special space-station. build sp 7B5.",
      "firaks action power5.",
      "lantids build m 6A4.",
      "ivits charge 2pw",
      "xenos charge 2pw",
      "xenos build m 8A1.",
      "lantids charge 1pw",
      "ivits charge 2pw",
      "firaks charge 3pw",
      "ivits action power6. build m 8B1.",
      "firaks charge 3pw",
      "xenos decline 3pw",
      "lantids charge 1pw",
      "firaks action power7.",
      "lantids build m 6A5.",
      "firaks charge 3pw",
      "xenos charge 2pw",
      "xenos build gf 7A10.",
      "ivits federation 5A11,7A5,7B0,7B3,7B4,7B5 fed4.",
      "firaks special down-lab. build ts 7A6. up sci.",
      "xenos charge 3pw",
      "ivits decline 2pw",
      "lantids build m 3A4.",
      "ivits decline 2pw",
      "xenos charge 2pw",
      "xenos build ts 7B2.",
      "ivits decline 3pw",
      "firaks charge 2pw",
      "ivits build lab 7B4. tech free1. up gaia.",
      "firaks charge 2pw",
      "lantids charge 1pw",
      "firaks up sci.",
      "lantids spend 2pw for 2c. federation 3A4,3A5,6A0,6A4,6A5,6B0,6B1,6B2 fed4.",
      "xenos spend 3pw for 1o. build ts 8A1.",
      "lantids charge 1pw",
      "ivits decline 2pw",
      "firaks charge 3pw",
      "ivits spend 3pw for 1o. spend 3pw for 1o. build lab 2A7. tech eco. up eco.",
      "xenos charge 2pw",
      "lantids charge 1pw",
      "firaks spend 1pw for 1c. up sci. spend 1pw for 1c.",
      "lantids build m 7B4.",
      "ivits decline 4pw",
      "firaks charge 2pw",
      "xenos charge 2pw",
      "xenos spend 3pw for 1o. federation 5A10,7A7,7B2,7B3,8A1,8A2 fed4.",
      "ivits build gf 6A1.",
      "firaks build ts 8B3. spend 1pw for 1c.",
      "lantids charge 1pw",
      "ivits charge 1pw",
      "lantids build m 7B0.",
      "ivits decline 4pw",
      "xenos charge 2pw",
      "xenos spend 2pw for 2c. pass booster2",
      "ivits pass booster10",
      "firaks build lab 8B3. tech sci. up sci.",
      "ivits charge 1pw",
      "lantids spend 1pw for 1c. special range+3. build m 1B4.",
      "firaks spend 3pw for 1o. federation 7A6,8A2,8A3,8B2,8B3,8B5,8C fed2.",
      "lantids up eco.",
      "firaks spend 1pw for 1c. spend 1pw for 1c. special 4pw.",
      "lantids up eco.",
      "firaks spend 3pw for 1o. pass booster1",
      "lantids spend 2pw for 2c. pass booster6",
      "xenos income 2t",
      "ivits income 1t",
      "firaks income 1t",
      "xenos build m 6B3.",
      "ivits action power3.",
      "firaks action power4.",
      "lantids build ts 1B4.",
      "xenos build m 7A10.",
      "ivits decline 4pw",
      "ivits build m 6A1.",
      "xenos charge 2pw",
      "firaks up terra.",
      "lantids action power6. build m 4A3.",
      "firaks charge 3pw",
      "xenos build lab 6A4. tech sci. up sci.",
      "lantids charge 1pw",
      "ivits charge 2pw",
      "ivits special space-station. build sp 7A0.",
      "firaks up nav.",
      "lantids spend 4o for 4c. build lab 1B4. tech free2. up eco.",
      "xenos build lab 3A4. tech int. up int.",
      "lantids charge 2pw",
      "ivits charge 2pw",
      "ivits build gf 2A5.",
      "firaks special 4pw. spend 4pw for 1q.",
      "lantids action power7.",
      "xenos up int.",
      "ivits build lab 5A11. tech int. up int.",
      "firaks charge 2pw",
      "xenos charge 3pw",
      "firaks action qic2. fedtile fed2.",
      "lantids up eco.",
      "xenos burn 1. spend 3pw for 1o. build m 5B1.",
      "ivits charge 2pw",
      "ivits spend 2pw for 2c. pass booster9",
      "firaks build lab 7A6. tech terra. up terra.",
      "xenos decline 3pw",
      "lantids charge 1pw",
      "ivits decline 2pw",
      "lantids special 4pw.",
      "xenos build gf 5A6.",
      "firaks special down-lab. build ts 7A6. up nav.",
      "xenos decline 3pw",
      "lantids charge 1pw",
      "ivits decline 2pw",
      "lantids spend 1pw for 1c. pass booster8",
      "xenos pass booster5",
      "firaks build m 4A6.",
      "firaks build lab 7A6. tech int. up int.",
      "xenos decline 3pw",
      "lantids charge 1pw",
      "ivits decline 2pw",
      "firaks spend 1pw for 1c. pass booster6",
      "ivits income 1t",
      "firaks income 4pw. income 1t",
      "ivits action power3.",
      "lantids action power4.",
      "xenos special range+3. build m 2A3.",
      "lantids charge 2pw",
      "firaks action power5.",
      "ivits action qic3.",
      "lantids build lab 8A6. tech terra. up terra.",
      "firaks charge 2pw",
      "xenos action power6. build m 1A11.",
      "lantids charge 2pw",
      "firaks up nav.",
      "ivits up int.",
      "lantids build ac1 8A6. tech adv-eco. cover terra. up nav.",
      "firaks charge 2pw",
      "xenos build m 5A6.",
      "firaks action qic2. fedtile fed2. spend 3pw for 1o.",
      "ivits build m 2A5.",
      "xenos charge 1pw",
      "lantids charge 1pw",
      "lantids build ts 4A3. spend 1pw for 1c.",
      "firaks charge 3pw",
      "xenos build gf 1A9.",
      "firaks up nav.",
      "ivits build ac2 5A11. tech nav. up nav.",
      "firaks charge 2pw",
      "xenos charge 3pw",
      "lantids spend 1pw for 1c. special 4pw.",
      "xenos up int.",
      "firaks build m 6B5.",
      "xenos charge 1pw",
      "ivits charge 1pw",
      "ivits special q.",
      "lantids spend 3pw for 1o. spend 2pw for 2c. build lab 4A3. tech int. up int.",
      "firaks charge 2pw",
      "xenos build m 1A3.",
      "firaks spend 3pw for 1o. build ts 6B5.",
      "xenos charge 1pw",
      "lantids decline 3pw",
      "ivits charge 1pw",
      "ivits federation 2A5,5A11,7A0,7A5,7B0,7B3,7B4,7B5 fed2.",
      "lantids pass booster2",
      "xenos spend 3pw for 1o. pass booster10",
      "firaks build lab 6B5. tech adv-nav. cover terra. up terra.",
      "xenos charge 1pw",
      "lantids decline 3pw",
      "ivits charge 1pw",
      "ivits up int.",
      "firaks up int.",
      "ivits special space-station. build sp 2B3.",
      "firaks special down-lab. build ts 7A6. up int.",
      "xenos decline 3pw",
      "lantids charge 1pw",
      "ivits decline 4pw",
      "ivits burn 3. action qic1. tech gaia. up gaia.",
      "firaks special 4pw. spend 6pw for 2o.",
      "ivits up int.",
      "firaks build ac1 6B5. tech free1. up int.",
      "xenos charge 1pw",
      "lantids decline 3pw",
      "ivits charge 1pw",
      "ivits spend 1pw for 1c. spend 5q for 5o. build ac1 2A7. tech free2. up gaia.",
      "xenos decline 2pw",
      "lantids charge 1pw",
      "firaks pass booster8",
      "ivits build gf 8A8.",
      "ivits special 4pw.",
      "ivits spend 3pw for 1o. federation 2A5,2A7,2B3,5A11,6A1,7A0,7A5,7B0,7B3,7B4,7B5 fed2.",
      "ivits pass booster6",
      "lantids income 4pw. income 4pw",
      "firaks income 4pw. income 4pw. income 1pw",
      "ivits income 4pw. income 1pw. income 1t",
      "lantids action qic2. fedtile fed4.",
      "xenos pass",
      "firaks build m 4B5.",
      "ivits special q.",
      "lantids action power2. build m 7A1.",
      "ivits decline 4pw",
      "xenos decline 2pw",
      "firaks build m 4A10.",
      "ivits special 4pw. burn 3.",
      "lantids build ac2 1B4. tech free1. up nav.",
      "xenos charge 1pw",
    ];

    const game = new Engine(moves, { layout: "xshape" });

    expect(() => game.move("firaks action qic2. fedtile fed2.")).to.throw();
  });
});
