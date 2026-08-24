import Engine from "../../engine";
import { Player } from "../../enums";
import {
  buildCommittedTurnMacros,
  CommittedTurnMacro,
  CommittedTurnMacroBuildOptions,
  CommittedTurnMacroSet,
} from "../actions/turn-builder";
import { canonicalStateHash } from "../canonical-state";

export class MacroBotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MacroBotError";
  }
}

function hydrate(engine: Engine): Engine {
  return Engine.fromData(JSON.parse(JSON.stringify(engine)));
}

export function buildBotMacroSet(
  engine: Engine,
  options: CommittedTurnMacroBuildOptions = {
    conversionIntegration: false,
    afterConversionIntegration: false,
  }
): CommittedTurnMacroSet {
  const macroSet = buildCommittedTurnMacros(engine, options);
  if (macroSet.macros.length === 0) {
    throw new MacroBotError(
      `No committed macro for actor ${macroSet.actor} at round ${engine.round}, phase ${engine.phase}`
    );
  }
  return macroSet;
}

/** Fresh-clone, one-move host commit with destination verification. */
export function applyMacroHostStyle(source: Engine, macro: CommittedTurnMacro): Engine {
  const committed = hydrate(source);
  committed.move(macro.moveLine);
  if (!committed.newTurn) {
    throw new MacroBotError(`Macro ${macro.key} did not end at a committed turn boundary`);
  }
  const destinationHash = canonicalStateHash(committed);
  if (destinationHash !== macro.destination.stateHash) {
    throw new MacroBotError(`Macro ${macro.key} reached ${destinationHash}, expected ${macro.destination.stateHash}`);
  }
  if ((committed.playerToMove ?? null) !== macro.destination.nextActor) {
    throw new MacroBotError(`Macro ${macro.key} recorded the wrong destination actor`);
  }
  return committed;
}

/** Fixed seat-0 selection. Player 1 maximizes; Player 2 minimizes the same un-negated values. */
export function chooseFixedFrame<T extends { macro: CommittedTurnMacro; value: number }>(
  actor: Player,
  candidates: T[]
): T {
  if (candidates.length === 0) {
    throw new MacroBotError("Cannot choose from an empty committed macro set");
  }
  let best = candidates[0];
  for (const candidate of candidates.slice(1)) {
    const better = actor === Player.Player1 ? candidate.value > best.value : candidate.value < best.value;
    const tiedEarlier = candidate.value === best.value && candidate.macro.key.localeCompare(best.macro.key) < 0;
    if (better || tiedEarlier) {
      best = candidate;
    }
  }
  return best;
}
