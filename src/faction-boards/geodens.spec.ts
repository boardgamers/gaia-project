import { expect } from "chai";
import Engine from "../engine";
import { Player, Federation } from '../enums';

const parseMoves = Engine.parseMoves;

describe("Geodens", () => {
  it ("should grant Geodens 3 knowledge after building mine on a new planet type with PI", () => {
    const engine = new Engine(parseMoves(`
      init 2 randomSeed
      p1 faction geodens
      p2 faction terrans
      p1 build m -4x0
      p2 build m -4x-1
      p2 build m -4x2
      p1 build m -1x-3
      p2 booster booster5
      p1 booster booster4
      p1 build ts -4x0.
      p2 charge 1pw
      p2 special range+3. build m -1x2.
      p1 build PI -4x0.
      p2 charge 1pw
      p2 build ts -4x-1.
      p1 charge 3pw
    `));

    const k = engine.player(Player.Player1).data.knowledge;

    engine.move("p1 special step. build m -5x0.");

    // Increase knowledge after building a mine on new planet type
    expect(engine.player(Player.Player1).data.knowledge).to.equal(k + 3);

    engine.loadMoves(parseMoves(`
      p2 charge 2pw
      p2 up gaia.
      p1 burn 2. action power6. build m -2x-4
    `));

    // Do NOT increase knowledge after building a mine on same planet type
    expect(engine.player(Player.Player1).data.knowledge).to.equal(k + 3);
  });
});
