import { expect } from "chai";
import Engine from "./src/engine";
import { automove, setPlayerSettings } from "./wrapper";

describe("wrapper", () => {
  describe("automove", () => {
    it("should automatically charge 1pw", () => {
      const moves = Engine.parseMoves(`
        init 2 randomSeed
        p1 faction terrans
        p2 faction nevlas
        terrans build m -1x2
        nevlas build m -1x0
        nevlas build m 0x-4
        terrans build m -4x-1
        nevlas booster booster7
        terrans booster booster3
        terrans build ts -1x2.
      `);

      const engine = new Engine(moves);

      automove(engine);

      expect(engine.moveHistory.length).to.equal(moves.length + 1);
      expect(engine.moveHistory.slice(-1).pop()).to.equal("nevlas charge 1pw");
    });

    it("should not automatically charge 2pw", () => {
      const engine = new Engine(moves2pw);

      expect(engine.moveHistory.length).to.equal(moves2pw.length);
    });

    it("should automatically charge 2pw when the setting is set", () => {
      const engine = new Engine(moves2pw.slice(0, 5));

      setPlayerSettings(engine, 0, { autoCharge: "2" });

      engine.loadMoves(moves2pw.slice(5));

      automove(engine);

      expect(engine.moveHistory.length).to.equal(moves2pw.length + 1);
      expect(engine.moveHistory.slice(-1).pop()).to.equal("terrans charge 2pw");
    });

    it("should automatically decline 2pw when the setting is set to 0", () => {
      const engine = new Engine(moves2pw.slice(0, 5));

      setPlayerSettings(engine, 0, { autoCharge: "0" });

      engine.loadMoves(moves2pw.slice(5));

      automove(engine);

      expect(engine.moveHistory.length).to.equal(moves2pw.length + 1);
      expect(engine.moveHistory.slice(-1).pop()).to.equal("terrans decline 2pw");
    });
  });
});

const moves2pw = Engine.parseMoves(`
  init 4 randomSeed
  p1 faction terrans
  p2 faction xenos
  p3 faction geodens
  p4 faction nevlas
  p1 build m -1x6
  p2 build m -3x-1
  p3 build m -4x1
  p4 build m -1x3
  p4 build m 1x4
  p3 build m -9x6
  p2 build m 1x5
  p1 build m -5x4
  p2 build m -8x5
  p4 booster booster1
  p3 booster booster2
  p2 booster booster3
  p1 booster booster4
  p1 build ts -1x6.
  p2 charge 1pw
  p4 charge 1pw
  p2 build ts 1x5.
  p4 charge 1pw
`);
