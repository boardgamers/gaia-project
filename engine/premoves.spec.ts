import { expect } from "chai";
import Engine from "./src/engine";
import { Phase } from "./src/enums";
import { automation, PremoveCommand } from "./src/premoves";
import {
  automove,
  canMoveOutOfTurn,
  isLiveUpdate,
  logSlice,
  move,
  replay,
  setPlayerSettings,
  stripSecret,
  timeIncrements,
  toSave,
} from "./wrapper";

const setup = Engine.parseMoves(`
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
let request = 0;
function game() {
  return new Engine(setup);
}
function command(engine: Engine, seat: number, moves: string[]): PremoveCommand {
  return {
    type: "premoves",
    requestId: `test-${++request}`,
    moves,
    revision: engine.automation?.plans[seat]?.revision ?? 0,
    round: engine.round,
    turn: engine.automation?.turns[seat] ?? 0,
  };
}
function queue(engine: Engine, seat: number, moves: string[]) {
  return move(engine, command(engine, seat, moves), seat);
}
function json(engine: Engine): Engine {
  return JSON.parse(JSON.stringify(engine));
}

describe("BGS premoves", () => {
  it("keeps the 3c Trading Station constraint and executes after a real neighbour arrives", () => {
    let engine = game();
    Object.assign(engine.players[0].data, { ores: 20, credits: 20, qics: 10 });
    setPlayerSettings(engine, 1, { autoCharge: "2" });
    const credits = engine.players[1].data.credits;
    engine = queue(engine, 1, ["nevlas build ts 4A11 cheap."]);
    expect(engine.automation.plans[1].moves).to.deep.equal(["nevlas build ts 4A11 cheap."]);
    expect(engine.players[1].data.credits).to.equal(credits);
    engine = move(json(engine), "terrans build m 4B0.", 0);
    expect(engine.automation.plans[1].notice.kind).to.equal("played");
    expect(engine.players[1].data.credits).to.equal(credits - 3);
    expect(timeIncrements(engine)).to.deep.equal([1, 1]);
  });

  it("stops an isolated 3c-only upgrade atomically instead of spending 6c", () => {
    let engine = game();
    const credits = engine.players[1].data.credits;
    const qics = engine.players[1].data.qics;
    const ores = engine.players[1].data.ores;
    expect(credits).to.be.at.least(6);
    engine = queue(engine, 1, ["nevlas spend 1q for 1o. build ts 4A11 cheap."]);
    engine = move(json(engine), "terrans up nav.", 0);
    expect(engine.automation.plans[1].notice.kind).to.equal("stopped");
    expect(engine.automation.plans[1].notice.text).to.contain("not available for 3c");
    expect(engine.automation.plans[1].moves).to.deep.equal([]);
    expect(engine.players[1].data.credits).to.equal(credits);
    expect(engine.players[1].data.qics).to.equal(qics);
    expect(engine.players[1].data.ores).to.equal(ores);
    expect(timeIncrements(engine)).to.deep.equal([1, 0]);
  });

  it("can queue a power spend before a charge, then uses real autoleech when the turn arrives", () => {
    let engine = game();
    Object.assign(engine.players[1].data.power, { area1: 0, area2: 1, area3: 0 });
    setPlayerSettings(engine, 1, { autoCharge: "2" });
    const credits = engine.players[1].data.credits;
    engine = queue(engine, 1, ["nevlas spend 1pw for 1c. up nav."]);
    expect(engine.players[1].data.power.area3).to.equal(0);
    expect(engine.players[1].data.credits).to.equal(credits);
    expect(engine.players[1].data.analysis).to.equal(false);
    expect(timeIncrements(engine)).to.deep.equal([0, 0]);
    engine = move(json(engine), "terrans build ts -1x2.", 0);
    expect(engine.automation.plans[1].notice.kind).to.equal("played");
    expect(engine.players[1].data.credits).to.equal(credits + 1);
    expect(engine.players[1].data.power.area3).to.equal(0);
    expect(timeIncrements(engine)).to.deep.equal([1, 1]);
  });

  it("stops instead of waiting or fabricating power when the anticipated charge never arrives", () => {
    let engine = game();
    Object.assign(engine.players[1].data.power, { area1: 0, area2: 1, area3: 0 });
    const credits = engine.players[1].data.credits;
    engine = queue(engine, 1, ["nevlas spend 1pw for 1c. up nav."]);
    engine = move(json(engine), "terrans up nav.", 0);
    expect(engine.playerToMove).to.equal(1);
    expect(engine.automation.plans[1].notice.kind).to.equal("stopped");
    expect(engine.automation.plans[1].moves).to.deep.equal([]);
    expect(engine.players[1].data.power.area3).to.equal(0);
    expect(engine.players[1].data.credits).to.equal(credits);
    expect(timeIncrements(engine)).to.deep.equal([1, 0]);
  });

  it("still rejects an unaffordable move submitted to play immediately", () => {
    const engine = game();
    engine.players[0].data.knowledge = 0;
    expect(() => queue(engine, 0, ["terrans up nav."])).to.throw();
    expect(engine.players[0].data.knowledge).to.equal(0);
  });

  it("saves a private off-turn queue without changing turns, logs or clocks", () => {
    let engine = game();
    const before = engine.moveHistory.length;
    const cmd = command(engine, 1, ["nevlas up nav."]);
    expect(canMoveOutOfTurn(json(engine), cmd, 1)).to.equal(true);
    engine = move(json(engine), cmd, 1);
    expect(toSave(engine)).to.equal(engine);
    expect(isLiveUpdate(engine)).to.equal(true);
    expect(engine.playerToMove).to.equal(0);
    expect(engine.moveHistory.length).to.equal(before);
    expect(timeIncrements(engine)).to.deep.equal([0, 0]);
    expect(stripSecret(engine, 1).automation.plans[1].moves).to.deep.equal(cmd.moves);
    expect(stripSecret(engine, 0).automation.plans).to.deep.equal({});
    expect(logSlice(engine).state.automation.plans).to.deep.equal({});
  });
  it("runs the queue after auto-leech and awards each completed main turn exactly once", () => {
    let engine = queue(game(), 1, ["nevlas up nav."]);
    engine = move(json(engine), "terrans build ts -1x2.", 0);
    expect(engine.moveHistory.slice(-3)[1]).to.match(/^nevlas charge/);
    expect(engine.moveHistory.slice(-1)[0]).to.match(/^nevlas up nav/);
    expect(timeIncrements(engine)).to.deep.equal([1, 1]);
    expect(isLiveUpdate(engine)).to.equal(false);
    expect(engine.automation.plans[1].moves).to.deep.equal([]);
    automove(engine);
    expect(timeIncrements(engine)).to.deep.equal([1, 1]);
  });
  it("keeps a queue through a manual charge decision and executes after it", () => {
    let engine = game();
    engine.move("terrans build ts -1x2.");
    automove(engine);
    engine.move("nevlas build ts -1x0.");
    expect(engine.phase).to.equal(Phase.RoundLeech);
    engine = queue(engine, 0, ["terrans up nav."]);
    expect(engine.automation.plans[0].moves).to.have.length(1);
    expect(timeIncrements(engine)).to.deep.equal([0, 0]);
    engine = move(json(engine), "terrans charge 2pw", 0);
    expect(engine.automation.plans[0].moves).to.have.length(0);
    expect(timeIncrements(engine)).to.deep.equal([2, 0]);
    expect(engine.automation.turns).to.deep.equal([1, 0]);
  });
  it("runs several seats' queues, with autoleech between them", () => {
    let engine = queue(game(), 1, ["nevlas build ts -1x0."]);
    setPlayerSettings(engine, 0, { autoCharge: "2" });
    engine = queue(engine, 0, ["terrans build ts -1x2.", "terrans up nav."]);
    expect(engine.automation.plans[0].moves).to.have.length(0);
    expect(engine.automation.plans[1].moves).to.have.length(0);
    expect(timeIncrements(engine)).to.deep.equal([2, 1]);
  });
  it("stops an illegal chain atomically, leaving the resources and active turn intact", () => {
    let engine = queue(game(), 1, ["nevlas up nav.", "nevlas build ts -1x0."]);
    engine.players[1].data.knowledge = 0;
    const wallet = engine.players[1].data.ores;
    engine = move(json(engine), "terrans up nav.", 0);
    expect(engine.playerToMove).to.equal(1);
    expect(engine.players[1].data.ores).to.equal(wallet);
    expect(engine.automation.plans[1].moves).to.deep.equal([]);
    expect(engine.automation.plans[1].notice.kind).to.equal("stopped");
    expect(timeIncrements(engine)).to.deep.equal([1, 0]);
  });
  it("rejects another seat's moves, incomplete plans, stale turns and stale queue edits", () => {
    const engine = game();
    expect(() => queue(engine, 1, ["terrans up nav."])).to.throw("own moves");
    expect(() => queue(engine, 1, ["nevlas burn 1"])).to.throw();
    const stale = command(engine, 1, ["nevlas up nav."]);
    queue(engine, 1, ["nevlas up terra."]);
    expect(() => move(engine, stale, 1)).to.throw("queue changed");
    const turn = command(engine, 1, ["nevlas up nav."]);
    automation(engine).turns[1]++;
    expect(() => move(engine, turn, 1)).to.throw("turn has changed");
    expect(canMoveOutOfTurn(engine, "nevlas up nav.", 1)).to.equal(false);
    expect(canMoveOutOfTurn(engine, stale, -1)).to.equal(false);
  });
  it("makes duplicate submissions harmless, even after the move has executed", () => {
    let engine = game();
    const cmd = command(engine, 0, ["terrans up nav."]);
    engine = move(engine, cmd, 0);
    const history = [...engine.moveHistory];
    engine = move(json(engine), cmd, 0);
    expect(engine.moveHistory).to.deep.equal(history);
    expect(timeIncrements(engine)).to.deep.equal([1, 0]);
    expect(engine.automation.plans[0].moves).to.have.length(0);
  });

  it("rolls back free conversions when a later command in the same premove becomes illegal", () => {
    let engine = queue(game(), 1, ["nevlas spend 1q for 1o. up nav."]);
    engine.players[1].data.knowledge = 0;
    const before = [engine.players[1].data.qics, engine.players[1].data.ores];
    engine = move(json(engine), "terrans up nav.", 0);
    expect([engine.players[1].data.qics, engine.players[1].data.ores]).to.deep.equal(before);
    expect(engine.automation.plans[1].notice.kind).to.equal("stopped");
  });

  it("allows cancellation even when the retained prefix is no longer legal", () => {
    let engine = queue(game(), 1, ["nevlas up nav.", "nevlas build ts -1x0."]);
    engine.players[1].data.knowledge = 0;
    engine = queue(engine, 1, ["nevlas up nav."]);
    expect(engine.automation.plans[1].moves).to.deep.equal(["nevlas up nav."]);
    engine = queue(engine, 1, []);
    expect(engine.automation.plans[1].moves).to.deep.equal([]);
    expect(timeIncrements(engine)).to.deep.equal([0, 0]);
  });

  it("keeps a queued move after a pass and executes it in the next round", () => {
    let engine = queue(game(), 0, ["terrans pass booster4", "terrans up nav."]);
    expect(engine.round).to.equal(1);
    expect(engine.automation.plans[0].moves).to.deep.equal(["terrans up nav."]);
    expect(timeIncrements(engine)).to.deep.equal([1, 0]);
    engine = move(json(engine), "nevlas pass booster5", 1);
    expect(engine.round).to.equal(2);
    expect(engine.automation.plans[0].moves).to.deep.equal([]);
    expect(engine.players[0].data.research.nav).to.equal(1);
    expect(timeIncrements(engine)).to.deep.equal([2, 1]);
  });

  it("can queue after already passing without reopening the current round", () => {
    let engine = move(game(), "terrans pass booster4", 0);
    const before = [...engine.moveHistory];
    engine = queue(engine, 0, ["terrans up nav."]);
    expect(engine.moveHistory).to.deep.equal(before);
    expect(isLiveUpdate(engine)).to.equal(true);
    expect(engine.automation.plans[0].timings).to.deep.equal([{ round: 2, phase: Phase.RoundMove }]);
    engine = move(json(engine), "nevlas pass booster5", 1);
    expect(engine.automation.plans[0].moves).to.deep.equal([]);
    expect(timeIncrements(engine)).to.deep.equal([2, 1]);
  });

  it("still limits the queue to three moves", () => {
    expect(() => queue(game(), 1, Array(4).fill("nevlas up nav."))).to.throw("at most three");
  });

  const passedItarsGame = () => {
    const engine = new Engine([
      "init 2 Gaudy-plow-4506",
      "p1 faction itars",
      "p2 faction ivits",
      "itars build m 3B3",
      "itars build m 2B2",
      "ivits build PI 4B3",
      "ivits booster booster3",
      "itars booster booster8",
      "ivits income t",
      "itars pass booster9",
    ]);
    engine.players.forEach((player) => {
      player.settings.autoIncome = false;
    });
    return engine;
  };

  it("queues next-round income and a main turn while waiting for the opponent's manual income", () => {
    let engine = passedItarsGame();
    engine = move(
      engine,
      {
        ...command(engine, 0, ["itars income t", "itars up nav."]),
        timings: [
          { round: 2, phase: Phase.RoundIncome },
          { round: 2, phase: Phase.RoundMove },
        ],
      },
      0
    );
    expect(isLiveUpdate(engine)).to.equal(true);
    engine = move(json(engine), "ivits pass booster5", 1);
    expect(engine.phase).to.equal(Phase.RoundIncome);
    expect(engine.playerToMove).to.equal(1);
    expect(engine.automation.plans[0].moves).to.deep.equal(["itars up nav."]);
    expect(timeIncrements(engine)).to.deep.equal([1, 1]);
    engine = move(json(engine), "ivits income t", 1);
    expect(engine.automation.plans[0].moves).to.deep.equal([]);
    expect(engine.players[0].data.research.nav).to.equal(1);
    expect(timeIncrements(engine)).to.deep.equal([2, 2]);
  });

  it("waits for an unplanned manual income choice without clearing next-round moves", () => {
    let engine = queue(passedItarsGame(), 0, ["itars up nav."]);
    engine = move(json(engine), "ivits pass booster5", 1);
    expect(engine.phase).to.equal(Phase.RoundIncome);
    expect(engine.playerToMove).to.equal(0);
    expect(engine.automation.plans[0].moves).to.have.length(1);
    engine = move(json(engine), "itars income t", 0);
    expect(engine.automation.plans[0].moves).to.have.length(1);
    engine = move(json(engine), "ivits income t", 1);
    expect(engine.automation.plans[0].moves).to.have.length(0);
    expect(timeIncrements(engine)).to.deep.equal([2, 2]);
  });

  it("does not replay or credit income that automatic income has already resolved", () => {
    let engine = passedItarsGame();
    engine.players.forEach((player) => {
      player.settings.autoIncome = true;
    });
    engine = move(
      engine,
      {
        ...command(engine, 0, ["itars income t", "itars up nav."]),
        timings: [
          { round: 2, phase: Phase.RoundIncome },
          { round: 2, phase: Phase.RoundMove },
        ],
      },
      0
    );
    engine = move(json(engine), "ivits pass booster5", 1);
    expect(engine.automation.plans[0].moves).to.deep.equal([]);
    expect(engine.players[0].data.research.nav).to.equal(1);
    expect(timeIncrements(engine)).to.deep.equal([1, 1]);
  });

  it("can cancel next-round moves and rejects schedules that go backwards", () => {
    let engine = queue(passedItarsGame(), 0, ["itars up nav."]);
    engine = queue(engine, 0, []);
    engine = move(json(engine), "ivits pass booster5", 1);
    engine = move(json(engine), "itars income t", 0);
    engine = move(json(engine), "ivits income t", 1);
    expect(engine.players[0].data.research.nav).to.equal(0);
    expect(() =>
      move(
        engine,
        {
          ...command(engine, 0, ["itars up nav.", "itars up terra."]),
          timings: [
            { round: 3, phase: Phase.RoundMove },
            { round: 2, phase: Phase.RoundMove },
          ],
        },
        0
      )
    ).to.throw("round order");
  });
  it("preserves increment totals and clears plans when replaying an existing game", async () => {
    let engine = queue(game(), 1, ["nevlas up nav."]);
    engine = move(engine, "terrans up nav.", 0);
    const counts = timeIncrements(engine);
    engine = await replay(json(engine), { to: setup.length });
    expect(timeIncrements(engine)).to.deep.equal(counts);
    expect(engine.automation.plans).to.deep.equal({});
  });
});
