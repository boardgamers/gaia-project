import { expect } from 'chai';
import Engine from './engine';
import { Player } from './enums';

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

  it ("should prevent the rescore fed action when no federation token", () => {
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
});
