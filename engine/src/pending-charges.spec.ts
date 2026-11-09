import { expect } from "chai";
import { automove, canMoveOutOfTurn, currentPlayer, move as hostedMove, moveAI } from "../wrapper";
import Engine from "./engine";
import { Command, Operator, Phase } from "./enums";
import Event from "./events";
import { chargeDecisionSeats, chargeFor, waitingForCharges } from "./pending-charges";

const setup = [
  "init 4 concurrent-charge-test",
  "p1 faction terrans",
  "p2 faction nevlas",
  "p3 faction firaks",
  "p4 faction hadsch-hallas",
  "p1 build m 8A2",
  "p2 build m 8B1",
  "p3 build m 8B3",
  "p4 build m 7B5",
  "p4 build m 1A2",
  "p3 build m 7A4",
  "p2 build m 5A2",
  "p1 build m 4A4",
  "p4 booster booster2",
  "p3 booster booster4",
  "p2 booster booster5",
  "p1 booster booster6",
  "hadsch-hallas income 2t",
];

function game() {
  const engine = new Engine(setup, { concurrentCharges: true });
  engine.players.forEach((player) => {
    player.settings.autoChargePower = "ask";
  });
  return engine;
}
function answer(engine: Engine, seat: number, decline = false) {
  engine.generateAvailableCommandsIfNeeded();
  const cmd = engine.findAvailableCommand(seat, Command.ChargePower);
  engine.move(
    `p${seat + 1} ${decline ? Command.Decline : Command.ChargePower} ${cmd.data.offers[0].offer} @${cmd.data.requestId}`
  );
}
function pass(engine: Engine) {
  engine.generateAvailableCommandsIfNeeded();
  const cmd = engine.findAvailableCommand(engine.currentPlayer, Command.Pass);
  engine.move(`p${engine.currentPlayer + 1} pass ${cmd.data.boosters[0] ?? ""}`.trim());
}

describe("independent charge decisions", () => {
  it("lets the next player move and recipients answer in either order, but requires their own charges first", () => {
    const engine = game();
    engine.move("terrans build ts 8A2.");
    expect(currentPlayer(engine)).to.deep.equal([1, 3]);
    answer(engine, 1, true);
    expect(currentPlayer(engine)).to.deep.equal([3, 1]);
    if (chargeFor(engine, 1)) answer(engine, 1, true);
    engine.move("nevlas build ts 8B1.");
    expect(chargeDecisionSeats(engine)).to.deep.equal([3, 2, 0]);
    expect(engine.pendingCharges.map((c) => c.player)).to.deep.equal([3, 2, 0]);
    expect(() => Engine.fromData(JSON.parse(JSON.stringify(engine))).move("firaks up eco.")).to.throw("own charges");
    answer(engine, 2);
    engine.move("firaks up eco.");
    expect(engine.currentPlayer).to.equal(3);
    expect(engine.pendingCharges.map((c) => c.player)).to.deep.equal([3, 0]);
    answer(engine, 0);
    answer(engine, 3);
    expect(engine.pendingCharges).to.deep.equal([]);
    expect(engine.playerToMove).to.equal(3);
  });

  it("persists committed waits without deadlocking and clears them automatically", () => {
    const engine = game();
    engine.move("terrans build ts 8A2.");
    answer(engine, 1, true);
    const waited = hostedMove(engine, "nevlas waitForCharges", 1);
    expect(waitingForCharges(waited, 1)).to.equal(true);
    expect(currentPlayer(JSON.parse(JSON.stringify(waited)))).to.equal(3);
    expect(waited.automation.turns[1]).to.equal(0);
    expect(canMoveOutOfTurn(waited, "nevlas resumeCharges", 1)).to.equal(false);
    expect(waited.generateAvailableCommandsIfNeeded().some((command) => command.player === 1)).to.equal(false);
    const before = JSON.stringify(waited);
    for (const move of ["nevlas resumeCharges", "p2 resumeCharges", "nevlas waitForCharges", "p2 waitForCharges"]) {
      for (let attempt = 0; attempt < 3; attempt++) {
        expect(() => hostedMove(waited, move, 1)).to.throw();
        expect(JSON.stringify(waited)).to.equal(before);
        expect(() => waited.move(move)).to.throw();
        expect(JSON.stringify(waited)).to.equal(before);
      }
    }
    expect(() => Engine.fromData(JSON.parse(JSON.stringify(waited))).move("hadsch-hallas waitForCharges")).to.throw();
    answer(waited, 3, true);
    expect(waitingForCharges(waited, 1)).to.equal(false);
    expect(waited.playerToMove).to.equal(1);
    expect(waited.chargeWaits).to.deep.equal({});
  });

  it("replays historical wait/resume cycles without rewriting history", () => {
    const history = [
      ...setup,
      "terrans build ts 8A2.",
      "nevlas decline 1pw @1",
      "nevlas waitForCharges",
      "nevlas resumeCharges",
      "nevlas waitForCharges",
    ];
    const strict = new Engine(history, { concurrentCharges: true });
    expect(strict.moveHistory.slice(-3)).to.deep.equal(history.slice(-3));
    expect(strict.replay).not.to.equal(true);
    expect(strict.allowsHistoricalChargeResume).to.equal(false);
    expect(waitingForCharges(strict, 1)).to.equal(true);
    const strictBefore = JSON.stringify(strict);
    expect(() => strict.move("nevlas resumeCharges")).to.throw();
    expect(() => strict.loadMoves(["nevlas resumeCharges"])).to.throw();
    expect(() => hostedMove(strict, "p2 resumeCharges", 1)).to.throw();
    expect(JSON.stringify(strict)).to.equal(strictBefore);
    // The compatibility context must not bypass ordinary strict move validation.
    expect(() => new Engine([...history, "hadsch-hallas up eco"], { concurrentCharges: true })).to.throw();
    expect(() => new Engine([...history.slice(0, -2), "firaks resumeCharges"], { concurrentCharges: true })).to.throw(
      "You are not waiting for charges"
    );
    const replay = new Engine(history, { concurrentCharges: true }, undefined, true);
    expect(replay.moveHistory.slice(-3)).to.deep.equal(history.slice(-3));
    expect(waitingForCharges(replay, 1)).to.equal(true);
    const resumed = replay.replayedTo(history.length - 1, false);
    expect(waitingForCharges(resumed, 1)).to.equal(false);
    expect(resumed.moveHistory).to.deep.equal(replay.moveHistory.slice(0, -1));
    resumed.move("nevlas waitForCharges");
    const before = JSON.stringify(resumed);
    expect(() => resumed.move("nevlas resumeCharges")).to.throw();
    expect(JSON.stringify(resumed)).to.equal(before);
    const replayBefore = JSON.stringify(replay);
    expect(() => hostedMove(replay, "p2 resumeCharges", 1)).to.throw();
    expect(JSON.stringify(replay)).to.equal(replayBefore);
    const serialized = JSON.parse(replayBefore);
    expect(() => hostedMove(serialized, "nevlas resumeCharges", 1)).to.throw();
    expect(JSON.stringify(serialized)).to.equal(replayBefore);

    const saved = JSON.parse(JSON.stringify(replay));
    saved.availableCommands = [{ name: Command.ResumeCharges, player: 1 }];
    const restored = Engine.fromData(saved);
    expect(restored.generateAvailableCommandsIfNeeded().some((c) => c.name === Command.ResumeCharges)).to.equal(false);
    expect(restored.moveHistory).to.deep.equal(replay.moveHistory);
    answer(restored, 3, true);
    expect(waitingForCharges(restored, 1)).to.equal(false);
  });

  it("allows only earlier offers to be waited on, preventing cycles", () => {
    const engine = game();
    engine.move("terrans build ts 8A2.");
    answer(engine, 1, true);
    engine.move("nevlas build ts 8B1.");
    engine.move("firaks waitForCharges");
    expect(engine.chargeWaits[2]).to.deep.equal([chargeFor(engine, 3).id]);
    expect(() => hostedMove(engine, "hadsch-hallas waitForCharges", 3)).to.throw();
    answer(engine, 3, true);
    expect(waitingForCharges(engine, 2)).to.equal(false);
    expect(chargeFor(engine, 0)).not.to.equal(undefined);
    expect(
      engine.generateAvailableCommandsIfNeeded().some((c) => c.player === 2 && c.name === Command.ChargePower)
    ).to.equal(true);
  });

  it("waits for every referenced offer, but not offers added later", () => {
    const engine = game();
    engine.move("terrans build ts 8A2.");
    answer(engine, 1, true);
    engine.move("nevlas build ts 8B1.");
    engine.move("terrans waitForCharges");
    const ids = engine.chargeWaits[0].slice();
    expect(ids).to.have.length(2);
    // A later offer for the same opponent must not extend this committed wait.
    engine.pendingCharges.push({ ...chargeFor(engine, 3), id: engine.nextChargeId++ });
    answer(engine, 3, true);
    expect(waitingForCharges(engine, 0)).to.equal(true);
    expect(engine.chargeWaits[0]).to.deep.equal(ids);
    answer(engine, 2, true);
    expect(waitingForCharges(engine, 0)).to.equal(false);
    expect(engine.chargeWaits[0]).to.equal(undefined);
    expect(chargeFor(engine, 3)).not.to.equal(undefined);
  });

  it("rejects a stale answer instead of consuming the next offer", () => {
    const engine = game();
    engine.move("terrans build ts 8A2.");
    if (chargeFor(engine, 1)) answer(engine, 1, true);
    engine.move("nevlas build ts 8B1.");
    answer(engine, 2, true);
    engine.move("firaks up eco.");
    answer(engine, 3, true);
    engine.move("hadsch-hallas build ts 7B5.");
    expect(engine.pendingCharges.filter((charge) => charge.player === 0)).to.have.length(2);
    const id = chargeFor(engine, 0).id;
    answer(engine, 0, true);
    expect(() => Engine.fromData(JSON.parse(JSON.stringify(engine))).move(`terrans decline 2pw @${id}`)).to.throw(
      "offer has changed"
    );
  });

  it("replays and serializes overlapping decisions deterministically", () => {
    let engine = game();
    engine.move("terrans build ts 8A2.");
    if (chargeFor(engine, 1)) answer(engine, 1, true);
    engine.move("nevlas build ts 8B1.");
    engine.move("firaks waitForCharges");
    engine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    answer(engine, 0);
    answer(engine, 3, true);
    answer(engine, 2);
    const replay = new Engine(engine.moveHistory, engine.options);
    expect(replay.pendingCharges).to.deep.equal(engine.pendingCharges);
    expect(replay.players.map((p) => p.data.toJSON())).to.deep.equal(engine.players.map((p) => p.data.toJSON()));
    expect(JSON.parse(JSON.stringify(replay.advancedLog))).to.deep.equal(
      JSON.parse(JSON.stringify(engine.advancedLog))
    );
    expect(replay.playerToMove).to.equal(engine.playerToMove);
  });

  it("keeps queued turns pending until the player's own charge is resolved", () => {
    let engine = game();
    engine = hostedMove(
      engine,
      { type: "premoves", requestId: "charge-test", revision: 0, round: 1, turn: 0, moves: ["nevlas up nav."] },
      1
    );
    engine = hostedMove(engine, "terrans build ts 8A2.", 0);
    expect(engine.automation.plans[1].moves).to.have.length(1);
    engine = hostedMove(engine, `nevlas decline 1pw @${chargeFor(engine, 1).id}`, 1);
    expect(engine.automation.plans[1].runs[0].steps[0].status).to.equal("played");
    expect(engine.pendingCharges.some((charge) => charge.player === 3)).to.equal(true);
    expect(engine.automation.turns[1]).to.equal(1);
  });

  it("auto-charges other recipients even while the first one is deciding", () => {
    const engine = game();
    engine.move("terrans build ts 8A2.");
    engine.players[3].settings.autoChargePower = 1;
    automove(engine);
    expect(chargeFor(engine, 1)).to.not.equal(undefined);
    expect(chargeFor(engine, 3)).to.equal(undefined);
    expect(engine.currentPlayer).to.equal(1);
  });

  it("keeps a Taklons Brainstone follow-up on the charging player", () => {
    const engine = new Engine(
      Engine.parseMoves(`
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
      itars charge 1pw @1
      itars build ts 2B0.
    `),
      { concurrentCharges: true }
    );
    const id = chargeFor(engine, 0).id;
    // The Taklons have passed: their answer must stay theirs even while Itars may take a turn.
    engine.currentPlayer = 1;
    engine.turnOrder = [1];
    engine.passedPlayers = [0];
    const copy = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    copy.move(`taklons charge 2pw @${id}`);
    expect(copy.newTurn).to.equal(false);
    const restored = Engine.fromData(JSON.parse(JSON.stringify(copy)));
    expect(restored.tempCurrentPlayer).to.equal(0);
    expect(restored.findAvailableCommand(0, Command.BrainStone)).to.not.equal(undefined);
    expect(copy.findAvailableCommand(0, Command.BrainStone)).to.not.equal(undefined);
    engine.players[0].settings.autoBrainstone = true;
    const completed = hostedMove(engine, `taklons charge 2pw @${id}`, 0);
    expect(completed.newTurn).to.equal(true);
    expect(completed.moveHistory[completed.moveHistory.length - 1]).to.contain("brainstone area2");
    expect(completed.pendingCharges).to.have.length(0);
  });

  it("lets a bot answer its charge while another player can take a turn", () => {
    let engine = game();
    engine.move("terrans build ts 8A2.");
    answer(engine, 1, true);
    expect(engine.playerToMove).to.equal(1);
    engine = moveAI(JSON.parse(JSON.stringify(engine)), 3);
    expect(chargeFor(engine, 3)).to.equal(undefined);
    expect(engine.currentPlayer).to.equal(1);
    expect(engine.automation.turns[3]).to.equal(0);
  });

  it("hands income to the first passer after the last concurrent turn ends", () => {
    const engine = game();
    // Both the first and last passers have an income choice, as in Silver-signal-3116.
    for (const seat of [0, 3]) engine.player(seat).loadEvents(Event.parse(["+t", "+4pw"], null));
    for (let i = 0; i < 4; i++) pass(engine);

    expect(engine.round).to.equal(2);
    expect(engine.phase).to.equal(Phase.RoundIncome);
    expect(engine.tempCurrentPlayer).to.equal(undefined);
    expect(engine.playerToMove).to.equal(0);
    expect(currentPlayer(JSON.parse(JSON.stringify(engine)))).to.equal(0);
    const choices = engine.generateAvailableCommandsIfNeeded();
    expect(choices.map((command) => command.player)).to.deep.equal([0]);
    expect(choices[0].name).to.equal(Command.ChooseIncome);

    const completed = hostedMove(JSON.parse(JSON.stringify(engine)), "terrans income t", 0);
    expect(completed.newTurn).to.equal(true);
    expect(completed.phase).to.equal(Phase.RoundMove);
    expect(completed.playerToMove).to.equal(0);
    expect(
      completed.moveHistory.slice(engine.moveHistory.length).some((move) => move.startsWith("hadsch-hallas income"))
    ).to.equal(true);
  });

  it("keeps the first passer's turn when income needs no choices", () => {
    const engine = game();
    for (const player of engine.players) player.events[Operator.Income] = [];
    for (let i = 0; i < 4; i++) pass(engine);

    expect(engine.round).to.equal(2);
    expect(engine.phase).to.equal(Phase.RoundMove);
    expect(engine.tempCurrentPlayer).to.equal(undefined);
    expect(engine.playerToMove).to.equal(0);
    expect(currentPlayer(JSON.parse(JSON.stringify(engine)))).to.equal(0);
  });

  it("repairs a saved last-passer override without changing resources or history", () => {
    const engine = game();
    for (const seat of [0, 3]) engine.player(seat).loadEvents(Event.parse(["+t", "+4pw"], null));
    for (let i = 0; i < 4; i++) pass(engine);
    const saved = JSON.parse(JSON.stringify(engine));
    saved.tempCurrentPlayer = 3;
    saved.availableCommands = [{ name: Command.ChooseIncome, player: 3, data: ["t", "4pw"] }];

    const restored = Engine.fromData(saved);
    expect(restored.playerToMove).to.equal(0);
    expect(restored.generateAvailableCommandsIfNeeded().map((command) => command.player)).to.deep.equal([0]);
    expect(JSON.parse(JSON.stringify(restored.players))).to.deep.equal(saved.players);
    expect(restored.moveHistory).to.deep.equal(saved.moveHistory);
    const completed = hostedMove(restored, "terrans income t", 0);
    expect(completed.newTurn).to.equal(true);
    expect(completed.phase).to.equal(Phase.RoundMove);
  });

  it("settles remaining charges before starting the next round", () => {
    const engine = game();
    pass(engine);
    pass(engine);
    pass(engine);
    engine.move("hadsch-hallas build ts 7B5.");
    expect(engine.pendingCharges.length).to.be.greaterThan(0);
    pass(engine);
    expect(engine.round).to.equal(1);
    expect(engine.currentPlayer).to.equal(undefined);
    while (engine.pendingCharges.length) answer(engine, engine.pendingCharges[0].player, true);
    expect(engine.round).to.equal(2);
    expect(engine.pendingCharges).to.deep.equal([]);
  });
});
