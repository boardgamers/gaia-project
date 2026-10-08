import { expect } from "chai";
import { PlayerEnum } from ".";
import Beta2 from "./fixtures/Beta-2.json";
import Engine from "./src/engine";
import { Faction, Phase } from "./src/enums";
import { factionVariantBoard } from "./src/faction-boards";
import {
  analysisMove,
  automove,
  canLaunchAnalysisMode,
  createAnalysis,
  move,
  moveAI,
  playerSettings,
  replay,
  setPlayerSettings,
  toSave,
} from "./wrapper";

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

  describe("replay", () => {
    it("should replay a game with beta variants", () => {
      expect(() => replay(Engine.fromData(Beta2))).to.not.throw();
    });

    it("should keep player settings", async () => {
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
      const settings = {
        autoCharge: "3",
        autoChargeTargetSpendablePower: "2",
        autoChargeMaxPassedRoundLeech: "1",
        autoIncome: true,
        autoBrainstone: true,
        itarsAutoChargeToArea3: true,
      };
      const engine = new Engine(moves);
      setPlayerSettings(engine, PlayerEnum.Player1, settings);
      setPlayerSettings(engine, PlayerEnum.Player2, { autoCharge: "decline-cost" });

      // Like undoing a move on the platform, which hands the wrapper serialized data
      const data = JSON.parse(JSON.stringify(move(engine, "terrans up nav.", PlayerEnum.Player1)));
      const replayed = await replay(data, { to: moves.length });

      expect(replayed.moveHistory.length).to.equal(moves.length);
      expect(playerSettings(replayed, PlayerEnum.Player1)).to.deep.equal(settings);
      expect(playerSettings(replayed, PlayerEnum.Player2).autoCharge).to.equal("decline-cost");
    });

    it("should automatically charge 2pw after replaying when the setting is set", async () => {
      const engine = new Engine(moves2pw.slice(0, 5));
      setPlayerSettings(engine, PlayerEnum.Player1, { autoCharge: "2" });
      engine.loadMoves(moves2pw.slice(5));

      const replayed = await replay(JSON.parse(JSON.stringify(engine)));

      expect(replayed.moveHistory.length).to.equal(moves2pw.length + 1);
      expect(replayed.moveHistory.slice(-1).pop()).to.equal("terrans charge 2pw (4/4/0/0 ⇒ 2/6/0/0)");
    });

    it("should load the faction picked again after replaying to the faction selection", async () => {
      const engine = new Engine(
        Engine.parseMoves(`
          init 2 randomSeed
          p1 faction terrans
          p2 faction nevlas
          terrans build m -1x2
        `),
        { factionVariant: "beta" }
      );
      expect(engine.player(PlayerEnum.Player1).variant.board).to.not.be.undefined;

      const replayed = await replay(JSON.parse(JSON.stringify(engine)), { to: 1 });
      expect(replayed.players.map((pl) => pl.variant)).to.deep.equal([null, null]);

      replayed.move("p1 faction gleens");
      replayed.move("p2 faction nevlas");
      const gleens = factionVariantBoard(replayed.factionCustomization, Faction.Gleens);
      expect(gleens).to.not.be.null;
      expect(replayed.player(PlayerEnum.Player1).variant).to.deep.equal({
        board: gleens.board,
        version: gleens.version,
      });
    });
  });

  describe("moveAI", () => {
    it("should make a move for the current player, given serialized data", () => {
      const engine = new Engine(["init 2 randomSeed"]);
      engine.generateAvailableCommandsIfNeeded();

      const data = JSON.parse(JSON.stringify(engine));
      const newEngine = moveAI(data, 0);

      expect(newEngine.moveHistory.length).to.equal(2);
      expect(newEngine.playerToMove).to.equal(1);
    });

    it("should return a saveable state", () => {
      const engine = new Engine(["init 2 randomSeed"]);
      engine.generateAvailableCommandsIfNeeded();

      const newEngine = moveAI(JSON.parse(JSON.stringify(engine)), 0);

      expect(toSave(newEngine)).to.not.equal(undefined);
    });

    it("should do nothing when it is not the player's turn", () => {
      const engine = new Engine(["init 2 randomSeed"]);
      engine.generateAvailableCommandsIfNeeded();

      const newEngine = moveAI(JSON.parse(JSON.stringify(engine)), 1);

      expect(newEngine.moveHistory.length).to.equal(1);
    });

    it("should let bots play a full game through the wrapper", function () {
      this.timeout(60000);

      let engine = new Engine(["init 2 randomSeed"]);

      // like on the platform, players have auto-charge settings
      for (let player = 0; player < engine.players.length; player++) {
        engine = setPlayerSettings(engine, player, { autoCharge: "1" });
      }
      engine.generateAvailableCommandsIfNeeded();

      let moves = 0;
      while (!engine.ended && moves < 2000) {
        const historyLength = engine.moveHistory.length;

        // the platform hands the wrapper serialized data
        engine = moveAI(JSON.parse(JSON.stringify(engine)), engine.playerToMove);

        if (engine.moveHistory.length === historyLength) {
          // the current player cannot move: it played itself into a dead end.
          // On the platform it would be dropped by the other players
          engine.players[engine.playerToMove].dropped = true;
          automove(engine);
        }
        moves++;
      }

      expect(engine.ended).to.be.true;
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

describe("saved analyses", () => {
  const history = Engine.parseMoves(`
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
  it("copies a public position without plans or automatic charging", () => {
    const source = new Engine(history);
    const original = JSON.stringify(source);
    const copy = createAnalysis(source, { to: history.length, sourceEnded: false });
    expect(copy.moveHistory).to.deep.equal(source.moveHistory);
    expect(copy.automation).to.equal(undefined);
    expect(copy.phase).to.equal(Phase.RoundLeech);
    const result = analysisMove(copy, "nevlas charge 1pw", 1);
    expect(result.moveHistory.length).to.equal(copy.moveHistory.length + 1);
    expect(JSON.stringify(source)).to.equal(original);
    expect(() => analysisMove(copy, { type: "premoves" } as any, 1)).to.throw("Premoves");
  });
  it("blocks ongoing hidden setup and rewinding an active game into setup", () => {
    const source = new Engine(history);
    expect(canLaunchAnalysisMode(source)).to.equal(true);
    expect(canLaunchAnalysisMode(createAnalysis(source, { to: 1, sourceEnded: false }))).to.equal(false);
    source.phase = Phase.SetupSilentBid;
    source.round = 0;
    expect(canLaunchAnalysisMode(source)).to.equal(false);
  });
  it("starts every player with default settings", () => {
    const source = new Engine(history);
    setPlayerSettings(source, 0, { autoCharge: "2", autoIncome: true });
    const copy = createAnalysis(source, { to: history.length, sourceEnded: false });
    expect(playerSettings(copy, 0)).to.deep.equal(playerSettings(new Engine(history), 0));
  });
  it("can branch before the auction once the source has ended", () => {
    const copy = createAnalysis(new Engine(history), { to: 1, sourceEnded: true });
    expect(copy.moveHistory.length).to.equal(1);
    expect(copy.ended).to.equal(false);
  });
});
