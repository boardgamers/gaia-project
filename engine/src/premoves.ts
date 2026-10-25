import Engine from "./engine";
import { Phase, Round } from "./enums";
import assert from "./utils/assert";

import type { AutomationState, PremoveCommand, PremovePlan, PremoveRun, PremoveTiming } from "./premove-types";
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

/** Lazily adopt queues saved by older engines; already-consumed moves cannot be recovered. */
function currentRun(plan: PremovePlan): PremoveRun {
  if (!plan.runs?.length) {
    const timings = premoveTimings(plan);
    plan.runs = [
      {
        id: plan.requestId ?? `legacy-${plan.revision}`,
        status: "queued",
        steps: plan.moves.map((move, index) => ({ move, timing: timings[index], status: "queued" })),
      },
    ];
  }
  return plan.runs[0];
}

function recordPremove(plan: PremovePlan, status: "played" | "skipped", moveIndex?: number) {
  const run = currentRun(plan);
  const step = run.steps.find((step) => step.status === "queued");
  if (step) {
    step.status = status;
    if (moveIndex !== undefined) step.moveIndex = moveIndex;
  }
  if (!run.steps.some((step) => step.status === "queued")) run.status = "completed";
}

function stopPremoves(plan: PremovePlan, status: PremoveRun["status"], reason: string, blocked = false) {
  const run = currentRun(plan);
  run.status = status;
  run.reason = reason;
  for (const step of run.steps) {
    if (step.status !== "queued") continue;
    step.status = blocked ? "blocked" : "unplayed";
    blocked = false;
  }
}

/** A replay cancels automation, but keeps its explanation and invalidates taken-back results. */
export function premoveHistoryAfterReplay(plans: AutomationState["plans"], moveCount: number) {
  const history: AutomationState["plans"] = JSON.parse(JSON.stringify(plans));
  for (const plan of Object.values(history)) {
    if (plan.moves.length) stopPremoves(plan, "stopped", "The game was replayed or taken back.");
    for (const run of plan.runs ?? []) {
      for (const step of run.steps) {
        if (["played", "skipped"].includes(step.status) && step.moveIndex >= moveCount) {
          step.status = "undone";
          run.status = "stopped";
          run.reason = "The game was taken back.";
        }
      }
    }
    plan.moves = [];
    plan.timings = [];
    plan.revision++;
    delete plan.notice;
  }
  return history;
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
  assert(Array.isArray(command.moves), "Invalid premove queue");
  assert(
    command.label === undefined || (typeof command.label === "string" && command.label.length <= 40),
    "Invalid plan label"
  );
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
  if (old?.moves.length) {
    stopPremoves(
      old,
      command.moves.length ? "replaced" : "cancelled",
      command.moves.length ? "Replaced by a new queue." : "Cancelled by you."
    );
  }
  const runs = old?.runs ?? [];
  if (command.moves.length) {
    runs.unshift({
      id: command.requestId,
      ...(command.label ? { label: command.label } : {}),
      status: "queued",
      steps: command.moves.map((move, index) => ({ move, timing: { ...timings[index] }, status: "queued" })),
    });
  }
  state.plans[seat] = {
    moves: [...command.moves],
    timings: timings.map((timing) => ({ ...timing })),
    revision: (old?.revision ?? 0) + 1,
    round: engine.round,
    requestId: command.requestId,
    // Bound saved game size while retaining the current queue and recent attempts across devices.
    runs: runs.slice(0, 10),
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
      stopPremoves(plan, "stopped", engine.ended ? "The game ended." : "You left the game.");
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
    recordPremove(plan, "skipped", engine.moveHistory.length - 1);
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
    stopPremoves(plan, "stopped", error instanceof Error ? error.message : String(error), true);
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
  recordPremove(plan, "played", engine.moveHistory.length - 1);
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
    recordPremove(plan, "skipped", engine.moveHistory.length - 1);
    plan.moves.shift();
    plan.timings = timings.slice(1);
  } else {
    stopPremoves(plan, "stopped", `A move was played manually: ${engine.moveHistory[engine.moveHistory.length - 1]}`);
    plan.moves = [];
    plan.timings = [];
  }
  plan.revision++;
}
