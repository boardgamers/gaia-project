import { expect } from "chai";
import { PlayerEnum } from ".";
import Engine from "./src/engine";
import { automove, move, setPlayerSettings } from "./wrapper";

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
      expect(engine.moveHistory.slice(-1).pop()).to.equal("nevlas charge 1pw (2/4/0/0 ⇒ 1/5/0/0)");
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
      expect(engine.moveHistory.slice(-1).pop()).to.equal("terrans charge 2pw (4/4/0/0 ⇒ 2/6/0/0)");
    });

    it("should automatically decline 2pw when the setting is set to 0", () => {
      const engine = new Engine(moves2pw.slice(0, 5));

      setPlayerSettings(engine, 0, { autoCharge: "decline-cost" });

      engine.loadMoves(moves2pw.slice(5));

      automove(engine);

      expect(engine.moveHistory.length).to.equal(moves2pw.length + 1);
      expect(engine.moveHistory.slice(-1).pop()).to.equal("terrans decline 2pw");
    });

    it("should be able to automatically charge 2 pw and move brainstone at the same time with correct settings", () => {
      const engine = new Engine(move2pwAndBrainstone);

      setPlayerSettings(engine, 0, { autoCharge: "2", autoBrainstone: true });

      automove(engine);

      expect(engine.moveHistory.length).to.equal(move2pwAndBrainstone.length + 1);
      expect(engine.moveHistory.slice(-1)[0]).to.equal("taklons charge 2pw. brainstone area2 (2,B/4/0/0 ⇒ 1/5,B/0/0)");
    });

    it("should NOT be able to automatically charge 2 pw and move brainstone if only autobrainstone is set", () => {
      const engine = new Engine(move2pwAndBrainstone);

      setPlayerSettings(engine, 0, { autoCharge: "1", autoBrainstone: true });

      automove(engine);

      expect(engine.moveHistory.length).to.equal(move2pwAndBrainstone.length);
    });

    it("should be able to automatically move the brainstone if the player manually charges power", () => {
      const engine = new Engine(move2pwAndBrainstone);

      setPlayerSettings(engine, 0, { autoCharge: "1", autoBrainstone: true });

      const newEngine = move(engine, "taklons charge 2pw", 0);

      expect(newEngine.moveHistory.length).to.equal(move2pwAndBrainstone.length + 1);
      expect(newEngine.moveHistory.slice(-1)[0]).to.equal(
        "taklons charge 2pw. brainstone area2 (2,B/4/0/0 ⇒ 1/5,B/0/0)"
      );
    });
  });

  describe("move completion", () => {
    it("should add research info to move history", () => {
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
      `);

      const engine = new Engine(moves);

      const newEngine = move(engine, "terrans up gaia", PlayerEnum.Player1);

      expect(newEngine.moveHistory.length).to.equal(moves.length + 1);
      expect(newEngine.moveHistory.slice(-1).pop()).to.equal("terrans up gaia (1 ⇒ 2) (4/4/0/0 ⇒ 7/4/0/0)");
    });

    it("should add returned booster to move history", () => {
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
      `);

      const engine = new Engine(moves);

      const newEngine = move(engine, "terrans pass booster4", PlayerEnum.Player1);

      expect(newEngine.moveHistory.length).to.equal(moves.length + 1);
      expect(newEngine.moveHistory.slice(-1).pop()).to.equal("terrans pass booster4 returning booster3");
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

const move2pwAndBrainstone = Engine.parseMoves(`
  init 2 Curious-supply-341
  p1 faction taklons
  p2 faction itars
  taklons build m 1B1
  itars build m 2B0
  itars build m 4A11
  taklons build m 2B3
  itars booster booster2
  taklons booster booster7
  taklons build ts 2B3.
  itars charge 1pw
  itars build ts 2B0.
`);
