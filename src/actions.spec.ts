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
      p2 leech 1pw
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
      p2 leech 2pw
      p2 burn 3. action power7
    `);

    expect(() => new Engine(moves)).to.not.throw();
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
      p2 leech 1pw
      p2 build ts -2x-4.
      p1 leech 2pw
      p1 build lab -2x-5. tech nav.
      p2 leech 2pw
      p2 build lab -2x-4. tech eco.
      p1 leech 2pw
    `);

    const engine = new Engine(moves);
    expect(engine.player(Player.Player1).data.qics).to.equal(3);
    expect(() => engine.move("p1 action qic2")).to.throw();
  });
});
