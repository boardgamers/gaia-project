import { expect } from "chai";
import Engine from "../engine";
import { Phase, Player as PlayerEnum } from "../enums";
import { moveAI } from "./ai";

describe("moveAI", () => {
  it("should generate a legal faction move", () => {
    const engine = new Engine(["init 2 randomSeed"]);

    const move = moveAI(engine, engine.playerToMove);

    expect(/^p1 faction /.test(move)).to.be.true;
    expect(() => engine.move(move)).to.not.throw();
  });

  it("should not generate a move when there is no player to move", () => {
    const engine = new Engine();

    expect(moveAI(engine, PlayerEnum.Player1)).to.equal(null);
    expect(engine.moveAI()).to.be.false;
  });

  it("should make a move through the engine method", () => {
    const engine = new Engine(["init 2 randomSeed"]);

    expect(engine.moveAI()).to.be.true;
    expect(engine.moveHistory.length).to.equal(2);
    expect(engine.playerToMove).to.equal(PlayerEnum.Player2);
  });

  it("should be deterministic for a given seed", () => {
    const run = () => {
      const engine = new Engine(["init 2 randomSeed"]);
      for (let i = 0; i < 30 && !engine.ended; i++) {
        engine.moveAI();
        // auto-charge free leech decisions of the other players
        while (engine.autoMove()) {
          // process all forced moves
        }
      }
      return engine.moveHistory;
    };

    expect(run()).to.deep.equal(run());
  });

  it("should let a bot complete the setup phase", () => {
    const engine = new Engine(["init 2 randomSeed"]);

    let moves = 0;
    while (engine.phase !== Phase.RoundMove && moves < 100) {
      expect(engine.moveAI(), `stuck in phase ${engine.phase}`).to.be.true;
      moves++;
    }

    expect(engine.phase).to.equal(Phase.RoundMove);
  });

  it("should let bots play a full game until the end", function () {
    this.timeout(60000);

    const engine = new Engine(["init 2 randomSeed"]);

    let moves = 0;
    while (!engine.ended && moves < 2000) {
      const progressed =
        // auto-charge free leech decisions of the other players
        engine.autoMove() || engine.moveAI();
      if (!progressed) {
        // a bot played itself into a dead end and was dropped: auto-pass it
        expect(engine.autoMove(undefined, { autoPass: true }), "game is stuck").to.be.true;
      }
      moves++;
    }

    expect(engine.ended).to.be.true;
    expect(engine.players.map((pl) => pl.data.victoryPoints)).to.satisfy((scores: number[]) =>
      scores.every((score) => score >= 0)
    );
  });

  it("should play identical games when replaying the same seed", function () {
    this.timeout(60000);

    const playGame = () => {
      const engine = new Engine(["init 2 randomSeed"]);
      let moves = 0;
      while (!engine.ended && moves < 2000) {
        const progressed = engine.autoMove() || engine.moveAI() || engine.autoMove(undefined, { autoPass: true });
        expect(progressed, "game is stuck").to.be.true;
        moves++;
      }
      return engine.moveHistory;
    };

    expect(playGame()).to.deep.equal(playGame());
  });
});
