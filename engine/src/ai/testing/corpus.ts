import Engine from "../../engine";
import { Command, Phase, Player } from "../../enums";
import { rngFromString } from "../../fuzz/rng";
import { buildCommittedTurnMacros, CommittedTurnMacroError, CommittedTurnMacroSet } from "../actions/turn-builder";
import { canonicalJson, canonicalStateHash, projectCanonicalState } from "../canonical-state";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "../challenge";

export const MACRO_CORPUS_SCHEMA = "gaia-ai-macro-corpus/v1" as const;

/**
 * One committed corpus state, described by the hash/legal/apply/replay evidence gathered for it.
 * The corpus never serializes transient states: every record is a committed snapshot reached by
 * host-style macro commits from the locked challenge prefix.
 */
export interface MacroCorpusStateRecord {
  playSeed: string;
  /** Committed lines after the scripted prefix when this state was observed. */
  lineIndex: number;
  phase: Phase;
  round: number;
  actor: Player;
  stateHash: string;
  conversionIntegration: boolean;
  macroCount: number;
  rejectedLineCount: number;
  deduplicationCount: number;
  decisionCommands: string[];
  sampledMacroKey: string;
}

export interface MacroBranchAggregate {
  states: number;
  totalMacros: number;
  minMacros: number;
  maxMacros: number;
  totalRejectedLines: number;
  totalDeduplications: number;
}

export interface MacroGamePlayOptions {
  playSeed: string;
  /**
   * Run full Phase 1.3 conversion integration on every Nth RoundMove decision (1 = every RoundMove
   * decision, 0 = never). When integration runs it is the complete, uncapped exhaustive planner;
   * this schedule only chooses on which turns the sampled player converts at all, mirroring a real
   * player who often defers conversions, and is not a cap on conversion depth or count.
   */
  conversionIntegrationEvery?: number;
  /**
   * Restrict integration turns to these rounds (default: every round). Exhaustive planning cost is
   * wallet-dependent and measured to reach many minutes on the pristine Round-1 wallet and on
   * power-rich Round-6 wallets, so sampled-play workloads schedule integration on measured-cheap
   * rounds. This chooses when the sampled player converts; it never caps the planner itself.
   */
  conversionIntegrationRounds?: readonly number[];
  /**
   * Enable the exhaustive AfterMove bowl-opening axis on integration turns. Defaults to false for
   * corpus sweeps because one complete AfterMove fixpoint runs per distinct post-main wallet and
   * measured costs on resource-rich wallets reach minutes; the focused Phase 1.4 suite exercises
   * this axis explicitly instead of silently capping it.
   */
  afterConversionIntegration?: boolean;
  /** Loud termination-failure guard, mirroring the fuzzer's maxLines rule. Not a semantic cap. */
  maxCommittedLines?: number;
  /** Continue from an existing committed engine instead of the scripted challenge prefix. */
  startEngine?: Engine;
  onState?: (record: MacroCorpusStateRecord, engine: Engine, macroSet: CommittedTurnMacroSet) => void;
}

export interface MacroGameResult {
  playSeed: string;
  committedLines: number;
  finished: boolean;
  finalRound: number;
  states: number;
  integrationOnStates: number;
  commandCoverage: string[];
  branchStatistics: { off: MacroBranchAggregate; on: MacroBranchAggregate };
  moveHistory: string[];
  finalEngine: Engine;
}

export class MacroCorpusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MacroCorpusError";
  }
}

function hydrate(engine: Engine): Engine {
  return Engine.fromData(JSON.parse(JSON.stringify(engine)));
}

/**
 * Canonical JSON with every player's federationCache projection masked out. Phase 1.1 hashes the
 * cache on purpose because current engine behavior genuinely depends on it, and `Player.toJSON()`
 * drops the cache's `custom` flag, so a live `custom: true` state and its serialized counterpart
 * are different states under the current engine (the base-003 federation-cache staleness class).
 * The campaign uses this mask to verify that any replay-path hash difference is confined to that
 * documented class and to fail hard on anything else.
 */
function federationCacheMaskedJson(engine: Engine): string {
  const projection = projectCanonicalState(engine);
  for (const player of projection.players) {
    player.federationCache = null;
  }
  return canonicalJson(projection);
}

function emptyAggregate(): MacroBranchAggregate {
  return {
    states: 0,
    totalMacros: 0,
    minMacros: Number.POSITIVE_INFINITY,
    maxMacros: 0,
    totalRejectedLines: 0,
    totalDeduplications: 0,
  };
}

function recordAggregate(aggregate: MacroBranchAggregate, macroSet: CommittedTurnMacroSet): void {
  aggregate.states += 1;
  aggregate.totalMacros += macroSet.statistics.macroCount;
  aggregate.minMacros = Math.min(aggregate.minMacros, macroSet.statistics.macroCount);
  aggregate.maxMacros = Math.max(aggregate.maxMacros, macroSet.statistics.macroCount);
  aggregate.totalRejectedLines += macroSet.statistics.rejectedLineCount;
  aggregate.totalDeduplications += macroSet.statistics.deduplicationCount;
}

function finishAggregate(aggregate: MacroBranchAggregate): MacroBranchAggregate {
  if (aggregate.states === 0) {
    return { ...aggregate, minMacros: 0 };
  }
  return aggregate;
}

/** Decision-command coverage for one macro set, including conversion and end-turn fragments. */
export function macroSetDecisionCommands(macroSet: CommittedTurnMacroSet): string[] {
  const commands = new Set<string>();
  for (const macro of macroSet.macros) {
    for (const decision of macro.decisions) {
      if (decision.command !== null) {
        commands.add(decision.command);
      }
      if (decision.kind === "conversion-prefix" || decision.kind === "after-conversion") {
        for (const fragment of decision.moveFragments) {
          if (fragment.startsWith(`${Command.Spend} `)) {
            commands.add(Command.Spend);
          } else if (fragment.startsWith(`${Command.BurnPower} `)) {
            commands.add(Command.BurnPower);
          } else if (fragment.startsWith(`${Command.BrainStone} `)) {
            commands.add(Command.BrainStone);
          }
        }
      }
    }
  }
  return Array.from(commands).sort();
}

/**
 * Play one complete game from the locked challenge prefix by sampling committed macros, applying
 * each with the host commit rule (fresh clone, one `move()`, commit only when `newTurn`). Every
 * intermediate state is validated for the corpus hash/legal/apply properties as it is visited.
 */
export function playMacroGame(options: MacroGamePlayOptions): MacroGameResult {
  const rng = rngFromString(options.playSeed);
  const maxCommittedLines = options.maxCommittedLines ?? 800;
  const integrationEvery = options.conversionIntegrationEvery ?? 0;
  let engine = options.startEngine ?? new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());

  const coverage = new Set<string>();
  const branchStatistics = { off: emptyAggregate(), on: emptyAggregate() };
  let committedLines = 0;
  let roundMoveDecisions = 0;
  let states = 0;
  let integrationOnStates = 0;

  while (!engine.ended) {
    if (committedLines >= maxCommittedLines) {
      throw new MacroCorpusError(
        `macro game ${options.playSeed} did not reach EndGame within ${maxCommittedLines} committed lines ` +
          `(round ${engine.round}, phase ${engine.phase})`
      );
    }
    let conversionIntegration = false;
    if (engine.phase === Phase.RoundMove) {
      // Deterministic schedule; offset by one so the expensive pristine first RoundMove decision
      // is not always the integrated one. This chooses on which turns the sampled player converts;
      // conversion planning itself stays exact and uncapped whenever it runs.
      conversionIntegration =
        integrationEvery > 0 &&
        (roundMoveDecisions + 1) % integrationEvery === 0 &&
        (options.conversionIntegrationRounds === undefined ||
          options.conversionIntegrationRounds.includes(engine.round));
      roundMoveDecisions += 1;
    }

    const stateHash = canonicalStateHash(engine);
    const macroSet = buildCommittedTurnMacros(engine, {
      conversionIntegration,
      afterConversionIntegration: conversionIntegration && (options.afterConversionIntegration ?? false),
    });
    if (macroSet.macros.length === 0) {
      throw new MacroCorpusError(
        `no committed macro available at ${options.playSeed} line ${committedLines} (phase ${engine.phase})`
      );
    }
    if (macroSet.sourceStateHash !== stateHash) {
      throw new MacroCorpusError(`macro set source hash diverged at ${options.playSeed} line ${committedLines}`);
    }
    const keys = macroSet.macros.map((macro) => macro.key);
    if (new Set(keys).size !== keys.length) {
      throw new MacroCorpusError(`duplicate macro keys at ${options.playSeed} line ${committedLines}`);
    }

    states += 1;
    if (conversionIntegration) {
      integrationOnStates += 1;
      recordAggregate(branchStatistics.on, macroSet);
    } else {
      recordAggregate(branchStatistics.off, macroSet);
    }
    for (const command of macroSetDecisionCommands(macroSet)) {
      coverage.add(command);
    }

    const sampled = macroSet.macros[Math.floor(rng() * macroSet.macros.length)];
    if (options.onState) {
      options.onState(
        {
          playSeed: options.playSeed,
          lineIndex: committedLines,
          phase: engine.phase,
          round: engine.round,
          actor: macroSet.actor,
          stateHash,
          conversionIntegration,
          macroCount: macroSet.statistics.macroCount,
          rejectedLineCount: macroSet.statistics.rejectedLineCount,
          deduplicationCount: macroSet.statistics.deduplicationCount,
          decisionCommands: macroSetDecisionCommands(macroSet),
          sampledMacroKey: sampled.key,
        },
        engine,
        macroSet
      );
    }

    const committed = hydrate(engine);
    committed.move(sampled.moveLine);
    if (!committed.newTurn) {
      throw new CommittedTurnMacroError(
        "invalid-line",
        `sampled macro ${sampled.key} did not commit when applied host-style`
      );
    }
    const destinationHash = canonicalStateHash(committed);
    if (destinationHash !== sampled.destination.stateHash) {
      throw new MacroCorpusError(
        `sampled macro ${sampled.key} committed to ${destinationHash}, expected ${sampled.destination.stateHash}`
      );
    }
    if ((committed.playerToMove ?? null) !== sampled.destination.nextActor) {
      throw new MacroCorpusError(`sampled macro ${sampled.key} recorded the wrong destination actor`);
    }
    engine = committed;
    committedLines += 1;
  }

  return {
    playSeed: options.playSeed,
    committedLines,
    finished: engine.ended,
    finalRound: engine.round,
    states,
    integrationOnStates,
    commandCoverage: Array.from(coverage).sort(),
    branchStatistics: {
      off: finishAggregate(branchStatistics.off),
      on: finishAggregate(branchStatistics.on),
    },
    moveHistory: [...engine.moveHistory],
    finalEngine: engine,
  };
}

export interface MacroCorpusCampaignOptions {
  playSeeds: readonly string[];
  /** Minimum committed corpus states across all games; the campaign fails loudly if not reached. */
  minStates: number;
  conversionIntegrationEvery?: number;
  afterConversionIntegration?: boolean;
  /** Constructor-replay macro-key parity runs on every Nth corpus state (hash parity runs on all). */
  deepCheckEvery?: number;
  maxCommittedLinesPerGame?: number;
}

export interface MacroCorpusCampaignResult {
  schemaVersion: typeof MACRO_CORPUS_SCHEMA;
  states: number;
  games: number;
  finishedGames: number;
  committedLines: number;
  integrationOnStates: number;
  hydrationHashChecks: number;
  constructorReplayHashChecks: number;
  /**
   * Replay-path hash differences confined to the documented federationCache staleness class
   * (base-003): the live engine's cache flags a custom federation that serialization drops. Any
   * hash difference outside the masked cache projection fails the campaign instead.
   */
  federationCacheHashDivergences: number;
  macroKeyParityChecks: number;
  commandCoverage: string[];
  phasesCovered: string[];
  roundsCovered: number[];
  leechStates: number;
  /** States whose macro set carries the explicit unsupported-custom-federation marker. */
  unsupportedCustomFederationStates: number;
  /** Rejected-line diagnostics aggregated by reason; rejection is the required DeadEnd handling. */
  rejectedLineReasons: Record<string, number>;
  branchStatistics: { off: MacroBranchAggregate; on: MacroBranchAggregate };
}

/**
 * The Phase 1.4 corpus campaign: macro-driven games from the locked challenge, validating every
 * committed state for the hash/legal/apply/replay property families:
 *
 * - hash: the canonical hash computes and survives serialize/parse hydration unchanged;
 * - legal: typed expansion succeeds and the full macro set builds with unique keys and no exposed
 *   `DeadEnd` or non-committed line (enforced inside the builder);
 * - apply: every emitted macro line was applied to a fresh clone during construction, and the
 *   sampled macro is re-applied host-style with a matching committed destination hash;
 * - replay: constructor replay of the accumulated committed history reproduces the same canonical
 *   hash at every state, and full macro-key parity is re-checked on a deterministic subsample.
 */
export function runMacroCorpusCampaign(options: MacroCorpusCampaignOptions): MacroCorpusCampaignResult {
  const deepCheckEvery = options.deepCheckEvery ?? 5;
  const result: MacroCorpusCampaignResult = {
    schemaVersion: MACRO_CORPUS_SCHEMA,
    states: 0,
    games: 0,
    finishedGames: 0,
    committedLines: 0,
    integrationOnStates: 0,
    hydrationHashChecks: 0,
    constructorReplayHashChecks: 0,
    federationCacheHashDivergences: 0,
    macroKeyParityChecks: 0,
    commandCoverage: [],
    phasesCovered: [],
    roundsCovered: [],
    leechStates: 0,
    unsupportedCustomFederationStates: 0,
    rejectedLineReasons: {},
    branchStatistics: { off: emptyAggregate(), on: emptyAggregate() },
  };
  const coverage = new Set<string>();
  const phases = new Set<string>();
  const rounds = new Set<number>();

  for (const playSeed of options.playSeeds) {
    const game = playMacroGame({
      playSeed,
      conversionIntegrationEvery: options.conversionIntegrationEvery ?? 0,
      afterConversionIntegration: options.afterConversionIntegration,
      maxCommittedLines: options.maxCommittedLinesPerGame,
      onState: (record, engine, macroSet) => {
        result.states += 1;
        phases.add(record.phase);
        rounds.add(record.round);
        if (record.phase === Phase.RoundLeech) {
          result.leechStates += 1;
        }
        for (const rejectedLine of macroSet.rejected) {
          result.rejectedLineReasons[rejectedLine.reason] = (result.rejectedLineReasons[rejectedLine.reason] ?? 0) + 1;
        }
        if (macroSet.unsupportedCustomFederationTiles.length > 0) {
          result.unsupportedCustomFederationStates += 1;
        }

        const hydrated = hydrate(engine);
        if (canonicalStateHash(hydrated) !== record.stateHash) {
          if (federationCacheMaskedJson(hydrated) !== federationCacheMaskedJson(engine)) {
            throw new MacroCorpusError(`hydration changed the canonical hash at ${playSeed} line ${record.lineIndex}`);
          }
          result.federationCacheHashDivergences += 1;
        }
        result.hydrationHashChecks += 1;

        const replayed = new Engine([...engine.moveHistory], challengeEngineOptions(), engine.version);
        const replayHashMatches = canonicalStateHash(replayed) === record.stateHash;
        if (!replayHashMatches) {
          if (federationCacheMaskedJson(replayed) !== federationCacheMaskedJson(engine)) {
            throw new MacroCorpusError(
              `constructor replay changed the canonical hash at ${playSeed} line ${record.lineIndex}`
            );
          }
          result.federationCacheHashDivergences += 1;
        }
        result.constructorReplayHashChecks += 1;

        if (record.lineIndex % deepCheckEvery === 0) {
          const liveMacros = record.conversionIntegration
            ? buildCommittedTurnMacros(engine, { conversionIntegration: false }).macros
            : macroSet.macros;
          const replayedMacros = buildCommittedTurnMacros(replayed, { conversionIntegration: false }).macros;
          if (replayHashMatches) {
            // Identical committed states must produce identical macro keys and destinations.
            const liveKeys = liveMacros.map((macro) => `${macro.key}\0${macro.destination.stateHash}`);
            const replayedKeys = replayedMacros.map((macro) => `${macro.key}\0${macro.destination.stateHash}`);
            if (JSON.stringify(replayedKeys) !== JSON.stringify(liveKeys)) {
              throw new MacroCorpusError(
                `constructor replay produced different macro keys at ${playSeed} line ${record.lineIndex}`
              );
            }
          } else {
            // The two replay paths are formally different states under the documented
            // federationCache class (macro keys embed the source hash by design), so parity is
            // checked on the hash-independent semantic content instead.
            const signature = (macros: typeof liveMacros) =>
              JSON.stringify(
                macros
                  .map((macro) =>
                    [macro.mainCandidateKey, macro.followUpChoiceKeys.join(","), macro.moveFragments.join(". ")].join(
                      "\0"
                    )
                  )
                  .sort()
              );
            if (signature(replayedMacros) !== signature(liveMacros)) {
              throw new MacroCorpusError(
                `constructor replay produced semantically different macros at ${playSeed} line ${record.lineIndex}`
              );
            }
          }
          result.macroKeyParityChecks += 1;
        }
      },
    });
    result.games += 1;
    if (game.finished) {
      result.finishedGames += 1;
    }
    result.committedLines += game.committedLines;
    result.integrationOnStates += game.integrationOnStates;
    for (const command of game.commandCoverage) {
      coverage.add(command);
    }
    mergeAggregate(result.branchStatistics.off, game.branchStatistics.off);
    mergeAggregate(result.branchStatistics.on, game.branchStatistics.on);
    if (result.states >= options.minStates) {
      break;
    }
  }

  if (result.states < options.minStates) {
    throw new MacroCorpusError(
      `corpus campaign produced only ${result.states} committed states, required ${options.minStates}`
    );
  }
  result.branchStatistics.off = finishAggregate(result.branchStatistics.off);
  result.branchStatistics.on = finishAggregate(result.branchStatistics.on);
  result.commandCoverage = Array.from(coverage).sort();
  result.phasesCovered = Array.from(phases).sort();
  result.roundsCovered = Array.from(rounds).sort((a, b) => a - b);
  return result;
}

function mergeAggregate(target: MacroBranchAggregate, source: MacroBranchAggregate): void {
  target.states += source.states;
  target.totalMacros += source.totalMacros;
  target.minMacros = Math.min(target.minMacros, source.states === 0 ? target.minMacros : source.minMacros);
  target.maxMacros = Math.max(target.maxMacros, source.maxMacros);
  target.totalRejectedLines += source.totalRejectedLines;
  target.totalDeduplications += source.totalDeduplications;
}
