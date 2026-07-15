import { expect } from "chai";
import "mocha";
import Engine from "../../engine";
import { Phase, Player } from "../../enums";
import { buildCommittedTurnMacros } from "../actions/turn-builder";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "../challenge";
import { applyMacroHostStyle, chooseFixedFrame } from "./common";
import { GreedyMacroBot } from "./greedy";
import { HeuristicMacroBot } from "./heuristic";
import { RandomMacroBot } from "./random";
import { playPairedBaselineMatchup } from "../testing/self-play";

function challengeSetup(): Engine {
  return new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
}

describe("Phase 2 committed-macro baseline bots", function () {
  this.timeout(30 * 60 * 1000);

  it("samples random macros deterministically and applies the choice host-style", () => {
    const engine = challengeSetup();
    const first = new RandomMacroBot("ai-6-random-lock").select(engine);
    const second = new RandomMacroBot("ai-6-random-lock").select(engine);
    expect(second.macro.key).to.equal(first.macro.key);
    expect(first.macroSet.macros.some((macro) => macro.key === first.macro.key)).to.equal(true);
    const committed = applyMacroHostStyle(engine, first.macro);
    expect(committed.newTurn).to.equal(true);
  });

  it("greedy chooses only from the Phase 1.4 committed macro set", () => {
    const engine = challengeSetup();
    const selection = new GreedyMacroBot().select(engine);
    expect(selection.macroSet.macros.some((macro) => macro.key === selection.macro.key)).to.equal(true);
    expect(selection.evaluation.value).to.be.a("number");
    expect(applyMacroHostStyle(engine, selection.macro).newTurn).to.equal(true);
  });

  it("keeps the frozen greedy bot default and exposes income normalization as an opt-in policy", () => {
    expect(new GreedyMacroBot().name).to.equal("greedy-macro");
    expect(new GreedyMacroBot({ valueMode: "income-normalized" }).name).to.equal("income-normalized-greedy-macro");
  });

  it("heuristic selection is deterministic, inspectable, and committed", () => {
    const engine = challengeSetup();
    const bot = new HeuristicMacroBot();
    const first = bot.select(engine);
    const second = bot.select(engine);
    expect(second.macro.key).to.equal(first.macro.key);
    expect(second.evaluation).to.deep.equal(first.evaluation);
    expect(first.evaluation.features).to.not.be.empty;
    expect(first.macroSet.macros.some((macro) => macro.key === first.macro.key)).to.equal(true);
    expect(applyMacroHostStyle(engine, first.macro).newTurn).to.equal(true);
  });

  it("maximizes for seat 0 and minimizes the same values for seat 1 without edge negation", () => {
    const macros = buildCommittedTurnMacros(challengeSetup(), { conversionIntegration: false }).macros;
    const candidates = [
      { macro: macros[0], value: -3 },
      { macro: macros[1], value: 7 },
      { macro: macros[2], value: 2 },
    ];
    expect(chooseFixedFrame(Player.Player1, candidates).value).to.equal(7);
    expect(chooseFixedFrame(Player.Player2, candidates).value).to.equal(-3);
    expect(candidates.map((candidate) => candidate.value)).to.deep.equal([-3, 7, 2]);
  });

  it("plays paired greedy-v-random and heuristic-v-greedy games to EndGame with both factions", () => {
    const greedyRandom = playPairedBaselineMatchup(
      () => new GreedyMacroBot(),
      (_seat, label) => new RandomMacroBot(label),
      "ai-6-greedy-random"
    );
    const heuristicGreedy = playPairedBaselineMatchup(
      () => new HeuristicMacroBot(),
      () => new GreedyMacroBot(),
      "ai-6-heuristic-greedy"
    );
    for (const paired of [greedyRandom, heuristicGreedy]) {
      expect(paired.aAsXenos.finalEngine.phase).to.equal(Phase.EndGame);
      expect(paired.aAsHadschHallas.finalEngine.phase).to.equal(Phase.EndGame);
      expect(paired.aAsXenos.seat0Bot).to.equal(paired.botA);
      expect(paired.aAsHadschHallas.seat1Bot).to.equal(paired.botA);
      expect(paired.aMargins).to.have.length(2);
      expect(paired.pairedMarginMean).to.equal((paired.aMargins[0] + paired.aMargins[1]) / 2);
      for (const game of [paired.aAsXenos, paired.aAsHadschHallas]) {
        expect(game.fullGameReport.players.map((player) => player.score.finalScore)).to.deep.equal([
          game.finalSeat0Score,
          game.finalSeat1Score,
        ]);
        for (const player of game.fullGameReport.players) {
          expect(player.rounds.map((round) => round.round)).to.deep.equal([1, 2, 3, 4, 5, 6]);
          expect(player.rounds.map((round) => round.rawScoreAfterRound)).to.have.length(6);
          expect(player.totalPasses).to.equal(6);
          expect(player.score.accountedFinalScore).to.equal(player.score.finalScore);
        }
      }
    }
    expect({
      aAsXenos: [greedyRandom.aAsXenos.finalSeat0Score, greedyRandom.aAsXenos.finalSeat1Score],
      aAsHadschHallas: [greedyRandom.aAsHadschHallas.finalSeat0Score, greedyRandom.aAsHadschHallas.finalSeat1Score],
      aMargins: greedyRandom.aMargins,
      lines: [greedyRandom.aAsXenos.committedLines, greedyRandom.aAsHadschHallas.committedLines],
    }).to.deep.equal({
      aAsXenos: [68, 51],
      aAsHadschHallas: [20, 46],
      aMargins: [17, 26],
      lines: [45, 37],
    });
    expect({
      aAsXenos: [heuristicGreedy.aAsXenos.finalSeat0Score, heuristicGreedy.aAsXenos.finalSeat1Score],
      aAsHadschHallas: [
        heuristicGreedy.aAsHadschHallas.finalSeat0Score,
        heuristicGreedy.aAsHadschHallas.finalSeat1Score,
      ],
      aMargins: heuristicGreedy.aMargins,
      lines: [heuristicGreedy.aAsXenos.committedLines, heuristicGreedy.aAsHadschHallas.committedLines],
    }).to.deep.equal({
      aAsXenos: [52, 77],
      aAsHadschHallas: [72, 38],
      aMargins: [-25, -34],
      lines: [33, 43],
    });
  });
});
