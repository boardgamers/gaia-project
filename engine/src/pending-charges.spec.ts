import { expect } from "chai";
import { automove, canMoveOutOfTurn, currentPlayer, move as hostedMove, moveAI } from "../wrapper";
import Engine from "./engine";
import { Command } from "./enums";
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

  it("persists optional waits without deadlocking, and allows cancelling the wait", () => {
    const engine = game();
    engine.move("terrans build ts 8A2.");
    answer(engine, 1, true);
    let waited = hostedMove(engine, "nevlas waitForCharges", 1);
    expect(waitingForCharges(waited, 1)).to.equal(true);
    expect(currentPlayer(JSON.parse(JSON.stringify(waited)))).to.equal(3);
    expect(waited.automation.turns[1]).to.equal(0);
    expect(canMoveOutOfTurn(waited, "nevlas resumeCharges", 1)).to.equal(true);
    waited = hostedMove(waited, "nevlas resumeCharges", 1);
    expect(waitingForCharges(waited, 1)).to.equal(false);
    expect(() => Engine.fromData(JSON.parse(JSON.stringify(waited))).move("hadsch-hallas waitForCharges")).to.throw();
    waited.move("nevlas waitForCharges");
    answer(waited, 3, true);
    expect(waitingForCharges(waited, 1)).to.equal(false);
    expect(waited.playerToMove).to.equal(1);
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
