/**
 * Tier-1 structural oracles (FUZZER_PLAN.md §3 tier 1 — no rules knowledge):
 * - every non-EndGame state offers ≥1 available command that is not DeadEnd (checked by the driver
 *   before each line; the "playing an offered command never throws" half is also driver-enforced),
 * - games terminate within the move cap (driver-enforced),
 * - determinism: `new Engine(moveHistory, options)` replay produces equivalent state, and
 *   `Engine.fromData(JSON(engine))` round-trips identically,
 * - commitment: `newTurn` is true after every committed line (§J1 — the multiplayer stack persists
 *   only completed turns),
 * - `playerToMove` is always a seated player; leech interrupts resolve (no stuck tempCurrentPlayer).
 */
import { isEqual } from "lodash";
import Engine from "../../engine";
import { Command, Phase } from "../../enums";
import { cloneOptions, normalizedEngineState } from "../state";
import { failuresOf, Oracle, OracleContext, OracleFailure } from "./types";

const CITATION = "FUZZER_PLAN.md §3 tier-1 (structural); §J1/§J2 via RULES_CLARIFICATIONS.md";

export const structuralAfterLine: Oracle = {
  name: "tier1.structural.state",
  citation: CITATION,
  afterLine(ctx: OracleContext): string[] {
    const messages: string[] = [];
    const engine = ctx.engine;

    // §J1: only completed turns are committed — newTurn must be true after every committed line.
    if (!engine.newTurn) {
      messages.push("newTurn is false after a committed line (incomplete turn was committed)");
    }

    if (engine.phase !== Phase.EndGame) {
      const playerToMove = engine.playerToMove;
      if (playerToMove === undefined || playerToMove < 0 || playerToMove >= ctx.players) {
        // §J2: leech interrupts must resolve to a seated player, never a stuck tempCurrentPlayer.
        messages.push(`playerToMove is ${playerToMove}, not a seated player (0..${ctx.players - 1})`);
      } else {
        const commands = engine.generateAvailableCommandsIfNeeded();
        if (!commands.some((c) => c.name !== Command.DeadEnd)) {
          messages.push(
            `non-EndGame state offers no available command other than DeadEnd (phase ${engine.phase})`
          );
        }
      }
    }

    return messages;
  },
};

export const structuralDeterminism: Oracle = {
  name: "tier1.structural.determinism",
  citation: CITATION + "; §J3 (engine is deterministic from seed + moves)",
  atEnd(ctx: OracleContext): string[] {
    return determinismMessages(ctx);
  },
};

/** Shared by the atEnd oracle and the driver's optional mid-game checkpoints. */
export function determinismMessages(ctx: OracleContext): string[] {
  const messages: string[] = [];
  const reference = normalizedEngineState(ctx.engine);

  // §J3: replaying seed + moves must reproduce the exact same state.
  let replayed: Engine;
  try {
    replayed = new Engine([...ctx.moves], cloneOptions(ctx.options));
  } catch (err) {
    return [`replay of the recorded moves threw: ${err.message}`];
  }
  if (!isEqual(normalizedEngineState(replayed), reference)) {
    messages.push("replaying the recorded moves from scratch does not reproduce the same state");
  }

  // Serialization round trip must be lossless (the multiplayer stack replays from JSON).
  let roundTripped: Engine;
  try {
    roundTripped = Engine.fromData(JSON.parse(JSON.stringify(ctx.engine)));
  } catch (err) {
    return [...messages, `Engine.fromData(JSON(engine)) threw: ${err.message}`];
  }
  if (!isEqual(normalizedEngineState(roundTripped), reference)) {
    messages.push("Engine.fromData(JSON(engine)) does not round-trip to the same state");
  }

  return messages;
}

export function structuralOracles(): Oracle[] {
  return [structuralAfterLine, structuralDeterminism];
}

export function runOracles(
  oracles: Oracle[],
  ctx: OracleContext,
  stage: "afterLine" | "atEnd"
): OracleFailure[] {
  const failures: OracleFailure[] = [];
  for (const oracle of oracles) {
    const check = oracle[stage];
    if (check) {
      failures.push(...failuresOf(oracle, check.call(oracle, ctx)));
    }
  }
  return failures;
}
