import Engine from "./engine";
import { Phase, Round } from "./enums";
import assert from "./utils/assert";

import type { AutomationState, PremoveCommand, PremovePlan, PremoveTiming } from "./premove-types";
import { MAX_PREMOVES } from "./premove-types";
export type { AutomationState, PremoveCommand, PremovePlan } from "./premove-types";

export function automation(engine: Engine): AutomationState {
  const state = (engine.automation ??= {
    version: 1,
    plans: {},
    increments: engine.players.map(() => 0),
    turns: engine.players.map(() => 0),
    liveUpdate: false,
  });
  state.roundPremoves = true;
  state.setupPremoves = true;
  return state;
}

const setupPhases = [Phase.SetupBuilding, Phase.SetupBooster];
const phases = [...setupPhases, Phase.RoundIncome, Phase.RoundGaia, Phase.RoundMove];
const phaseOrder = (phase: Phase) => phases.indexOf(phase === Phase.RoundLeech ? Phase.RoundMove : phase);
const position = (timing: PremoveTiming) => timing.round * phases.length + phaseOrder(timing.phase);
const sameTiming = (a: PremoveTiming, b: PremoveTiming) => a.round === b.round && a.phase === b.phase;

export function premoveTimings(plan: PremovePlan): PremoveTiming[] {
  return plan.timings ?? plan.moves.map(() => ({ round: plan.round, phase: Phase.RoundMove }));
}

export function assertOwnMove(engine: Engine, move: string, seat: number) {
  assert(typeof move === "string" && move.length <= 8000, "Invalid move");
  const actor = move.trim().split(/\s+/)[0];
  assert(actor === `p${seat + 1}` || actor === engine.players[seat]?.faction, "You may only play your own moves");
}

export function canQueue(engine: Engine, seat: number): boolean {
  return (
    Number.isInteger(seat) &&
    !!engine.players[seat] &&
    !engine.players[seat].dropped &&
    !engine.ended &&
    (phases.includes(engine.phase) || engine.phase === Phase.RoundLeech)
  );
}

export function setPremoves(engine: Engine, command: PremoveCommand, seat: number) {
  assert(canQueue(engine, seat), "Premoves are available after faction selection");
  const state = automation(engine);
  const old = state.plans[seat];
  assert(
    typeof command.requestId === "string" && command.requestId.length > 0 && command.requestId.length <= 80,
    "Invalid plan request"
  );
  if (old?.requestId === command.requestId) {
    state.liveUpdate = true;
    return;
  }
  assert(command.revision === (old?.revision ?? 0), "Your premove queue changed. Please check it and try again.");
  assert(Array.isArray(command.moves) && command.moves.length <= MAX_PREMOVES, "Queue at most three moves");
  let nextRound = engine.round + (engine.passedPlayers?.includes(seat) ? 1 : 0);
  const timings =
    command.timings ??
    command.moves.map((move) => {
      const timing = { round: nextRound, phase: setupPhases.includes(engine.phase) ? engine.phase : Phase.RoundMove };
      if (/\bpass\b/.test(move)) nextRound++;
      return timing;
    });
  assert(Array.isArray(timings) && timings.length === command.moves.length, "Invalid premove schedule");
  const cancelling =
    old &&
    command.moves.length < old.moves.length &&
    command.moves.every(
      (move, i) => move === old.moves[i] && timings[i] && sameTiming(timings[i], premoveTimings(old)[i])
    );
  let previous = position({ round: engine.round, phase: engine.phase });
  for (const timing of cancelling ? [] : timings) {
    assert(
      timing &&
        Number.isInteger(timing.round) &&
        timing.round >= engine.round &&
        timing.round <= Round.LastRound &&
        phases.includes(timing.phase) &&
        (setupPhases.includes(timing.phase) ? timing.round === Round.None : timing.round >= Round.Round1),
      "Invalid premove schedule"
    );
    assert(position(timing) >= previous, "Premoves must follow round order");
    previous = position(timing);
  }
  if (command.moves.length > 0 && !cancelling) {
    assert(
      command.round === engine.round && command.turn === state.turns[seat],
      "Your turn has changed. Please review your plan."
    );
    const preview = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    for (const [index, move] of command.moves.entries()) {
      assertOwnMove(preview, move, seat);
      const timing = timings[index];
      assert(
        !(timing.round === engine.round && engine.passedPlayers?.includes(seat)),
        "You have already passed this round"
      );
      if (setupPhases.includes(timing.phase)) {
        if (index === 0 && timing.phase === engine.phase && engine.playerToMove === seat) {
          preview.move(move);
          assert(preview.newTurn, "Finish each planned turn before queuing it");
        }
        continue;
      }
      // A later round/phase depends on income and other players' decisions. Validate its timing
      // and ownership now; execute the complete move atomically against the real board when due.
      if (
        timing.round !== engine.round ||
        timing.phase !== Phase.RoundMove ||
        engine.phase === Phase.RoundIncome ||
        engine.phase === Phase.RoundGaia
      )
        continue;
      assert(
        preview.round === engine.round && !preview.passedPlayers.includes(seat),
        "Schedule moves after passing in the next round"
      );
      // Validate the shape of future turns without assuming today's wallet is final. Charges
      // and income may arrive before them. Only this disposable preview may overdraw resources;
      // playNextPremove always checks the entire turn again on the real, unmodified position.
      const playsNow = engine.phase === Phase.RoundMove && engine.newTurn && engine.playerToMove === seat;
      preview.players[seat].data.analysis = true;
      preview.players[seat].data.validatingFuturePremove = !(playsNow && index === 0);
      preview.forcePremovePreviewTurn(seat);
      preview.move(move);
      assert(preview.newTurn, "Finish each planned turn before queuing it");
    }
  }
  state.plans[seat] = {
    moves: [...command.moves],
    timings: timings.map((timing) => ({ ...timing })),
    revision: (old?.revision ?? 0) + 1,
    round: engine.round,
    requestId: command.requestId,
  };
  state.liveUpdate = true;
}

export function creditDecision(engine: Engine, seat: number, phase: Phase) {
  const state = automation(engine);
  state.increments[seat]++;
  if (phase === Phase.RoundMove || setupPhases.includes(phase)) state.turns[seat]++;
}

export function clearExpiredPremoves(engine: Engine) {
  for (const [seat, plan] of Object.entries(automation(engine).plans)) {
    if (plan.moves.length && (engine.ended || engine.players[+seat].dropped)) {
      plan.moves = [];
      plan.timings = [];
      plan.revision++;
      plan.notice = {
        kind: "stopped",
        text: "Your remaining premoves were cleared because you are no longer playing.",
      };
    }
  }
}

export function playNextPremove(engine: Engine): boolean {
  if (engine.ended || !phases.includes(engine.phase) || !engine.newTurn) return false;
  const seat = engine.playerToMove;
  const state = automation(engine);
  const plan = state.plans[seat];
  if (!plan?.moves.length) return false;
  const timings = premoveTimings(plan);
  const timing = timings[0];
  const current = { round: engine.round, phase: engine.phase };
  if (position(timing) > position(current)) return false;
  // Automatic income or a manual income choice may already have answered this prompt. Consume
  // that planned choice without applying it twice; subsequent moves use the actual resources.
  if (timing.round === engine.round && timing.phase === Phase.RoundIncome && engine.phase !== Phase.RoundIncome) {
    plan.moves.shift();
    plan.timings = timings.slice(1);
    plan.revision++;
    return true;
  }
  const move = plan.moves[0];
  try {
    assert(sameTiming(timing, current), "The round or phase planned for this move has already passed");
    const probe = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    assertOwnMove(probe, move, seat);
    probe.move(move);
    assert(probe.newTurn, "The planned move no longer completes a turn");
  } catch (error) {
    plan.moves = [];
    plan.timings = [];
    plan.revision++;
    plan.notice = {
      kind: "stopped",
      text: `Premoves stopped: ${error instanceof Error ? error.message : String(error)}`,
    };
    return false;
  }
  // Validate on a disposable engine first: a failed multi-command turn must not spend anything.
  engine.move(move);
  engine.generateAvailableCommandsIfNeeded();
  plan.moves.shift();
  plan.timings = timings.slice(1);
  plan.revision++;
  plan.notice = { kind: "played", text: `Played for you: ${move}` };
  state.liveUpdate = false;
  creditDecision(engine, seat, current.phase);
  return true;
}

/** A manual turn replaces a due main-turn queue, but cannot erase a plan for a later round. */
export function reconcileManualPremoves(engine: Engine, seat: number, round: number, phase: Phase) {
  const plan = automation(engine).plans[seat];
  if (!plan?.moves.length) return;
  const timings = premoveTimings(plan);
  if (!sameTiming(timings[0], { round, phase })) return;
  if (phase === Phase.RoundIncome) {
    plan.moves.shift();
    plan.timings = timings.slice(1);
  } else {
    plan.moves = [];
    plan.timings = [];
  }
  plan.revision++;
}
