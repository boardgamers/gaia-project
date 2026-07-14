import { createHash } from "crypto";
import { AvailableCommand } from "../../available/types";
import Engine from "../../engine";
import { Building, Command, Phase, Player, SubPhase } from "../../enums";
import { canonicalStateHash } from "../canonical-state";
import { planAfterActionConversionsForLine, planResourceConversions } from "../resources/planner";
import { OrderedConversionPlan } from "../resources/types";
import { stableCandidateJson } from "./canonical-key";
import { expandAtomicDecisions, expandInternallySuppliedAtomicCommands } from "./expand";
import { AtomicDecisionCandidate } from "./types";

export const COMMITTED_TURN_MACRO_SCHEMA = "gaia-ai-committed-turn-macro/v1" as const;

export type CommittedTurnMacroErrorCode = "unsupported-state" | "invalid-line" | "semantic-key-collision";

export class CommittedTurnMacroError extends Error {
  constructor(readonly code: CommittedTurnMacroErrorCode, message: string) {
    super(message);
    this.name = "CommittedTurnMacroError";
  }
}

/**
 * One recorded decision inside a committed macro line. `forced-follow-up` records exist for audit
 * only: a forced one-choice decision never becomes a policy branch and never enters the macro key.
 */
export interface MacroDecisionRecord {
  kind: "conversion-prefix" | "main" | "forced-follow-up" | "choice-follow-up" | "after-conversion" | "end-turn";
  command: Command | null;
  candidateKey: string | null;
  moveFragments: string[];
  /** Number of distinct options at this decision point (1 marks a forced decision). */
  options: number;
}

export interface CommittedTurnMacroDestination {
  stateHash: string;
  phase: Phase;
  round: number;
  /** Next player to act at the committed destination (leech interrupts included), null at EndGame. */
  nextActor: Player | null;
  /** True when the committed destination is an interrupting leech decision. */
  leechPending: boolean;
  /** True when this macro's actor has passed for the round at the destination. */
  actorPassed: boolean;
  passOrder: Player[];
  gameEnded: boolean;
}

export interface CommittedTurnMacro {
  schemaVersion: typeof COMMITTED_TURN_MACRO_SCHEMA;
  key: string;
  sourceStateHash: string;
  actor: Player;
  actorPrefix: string;
  phase: Phase;
  round: number;
  /** Phase 1.3 plan key of a non-empty pre-main conversion prefix, or null. */
  conversionPlanKey: string | null;
  /** Semantic wallet destination of the pre-main conversion prefix, or null when empty. */
  conversionDestinationStateKey: string | null;
  mainCandidateKey: string;
  mainCommand: Command;
  /** Candidate keys chosen at meaningful (more than one option) follow-up decisions, in order. */
  followUpChoiceKeys: string[];
  /** Candidate keys consumed at forced one-choice follow-ups, in order (audit only, not in key). */
  forcedFollowUpKeys: string[];
  /** Phase 1.3 plan key of a retained non-empty AfterMove conversion suffix, or null. */
  afterConversionPlanKey: string | null;
  afterConversionDestinationStateKey: string | null;
  decisions: MacroDecisionRecord[];
  moveFragments: string[];
  /** Complete executable line, exactly as a host would submit it. */
  moveLine: string;
  warnings: string[];
  destination: CommittedTurnMacroDestination;
}

export interface RejectedMacroLine {
  reason: "dead-end-follow-up" | "line-apply-failed" | "unsupported-destination";
  moveFragments: string[];
  detail: string;
}

export interface MacroDeduplication {
  key: string;
  keptMoveFragments: string[];
  mergedMoveFragments: string[];
}

export interface MacroBranchStatistics {
  conversionIntegration: boolean;
  macroCount: number;
  mainCandidateCount: number;
  /** Distinct non-empty pre-main conversion prefixes across emitted macros. */
  conversionPlanCount: number;
  /** Macros carrying a retained AfterMove bowl-opening conversion suffix. */
  afterConversionMacroCount: number;
  /** Distinct candidate keys chosen at meaningful follow-up decisions. */
  meaningfulFollowUpKeyCount: number;
  /** Distinct candidate keys consumed at forced one-choice follow-ups. */
  forcedFollowUpKeyCount: number;
  rejectedLineCount: number;
  deduplicationCount: number;
  /** Count of federation tiles reachable only through the unsupported custom fallback. */
  unsupportedCustomFederationCount: number;
}

export interface CommittedTurnMacroSet {
  schemaVersion: typeof COMMITTED_TURN_MACRO_SCHEMA;
  sourceStateHash: string;
  actor: Player;
  actorPrefix: string;
  phase: Phase;
  round: number;
  macros: CommittedTurnMacro[];
  rejected: RejectedMacroLine[];
  deduplications: MacroDeduplication[];
  /**
   * Federation tiles the engine offered ONLY through its custom (un-enumerated geometry)
   * fallback at this state. The macro set is explicitly incomplete when this is non-empty: a real
   * player may still form one of these federations by hand-picking hexes, which no offline layer
   * can enumerate until the Phase 3 federation planner exists. Consumers must treat this as a
   * first-class incompleteness marker; it is never silently dropped.
   */
  unsupportedCustomFederationTiles: string[];
  statistics: MacroBranchStatistics;
}

export interface CommittedTurnMacroBuildOptions {
  /**
   * True (default) integrates Phase 1.3 conversion planning: nondominated pre-main conversion
   * prefixes per main candidate plus retained AfterMove bowl-opening suffixes. False builds only
   * root-affordable lines with every conversion deferred; that mode exists to measure branch
   * statistics before conversion integration and for cheap corpus sweeps, and both modes produce
   * identical keys for the shared conversion-free macros.
   */
  conversionIntegration?: boolean;
  /**
   * Controls the retained AfterMove bowl-opening branches separately from the pre-main axis;
   * defaults to `conversionIntegration`. The AfterMove window runs one complete, uncapped Phase
   * 1.3 fixpoint per distinct post-main wallet, which is exact but measurably expensive on
   * resource-rich wallets (the pristine locked Round-1 wallet grows past practical wall-clock),
   * so statistics runs and corpus sweeps state explicitly which axes were enabled instead of
   * silently capping the planner.
   */
  afterConversionIntegration?: boolean;
  /** Optional Phase 1.2 main-candidate key filter for the RoundMove path. */
  mainCandidateKeys?: readonly string[];
}

/**
 * Structural runaway detector, not a semantic search cap: a legal committed line in the supported
 * boundary is far shorter, so exceeding this many dot-separated parts is a loud builder/engine
 * mismatch failure instead of a silently truncated macro.
 */
const MAX_LINE_FRAGMENTS = 64;

const NARROW_AFTER_WINDOW_COMMANDS = new Set<Command>([Command.Spend, Command.BurnPower, Command.EndTurn]);

interface LineState {
  fragments: string[];
  decisions: MacroDecisionRecord[];
  conversionPlanKey: string | null;
  conversionDestinationStateKey: string | null;
  mainCandidate: AtomicDecisionCandidate;
  afterConversionPlanKey: string | null;
  afterConversionDestinationStateKey: string | null;
  afterWindowResolved: boolean;
  warnings: string[];
}

function hydrate(engine: Engine): Engine {
  return Engine.fromData(JSON.parse(JSON.stringify(engine)));
}

function isMainCandidate(candidate: AtomicDecisionCandidate): boolean {
  return ![Command.Spend, Command.BurnPower, Command.BrainStone, Command.EndTurn].includes(candidate.command);
}

function isNarrowAfterWindow(commands: AvailableCommand[]): boolean {
  return (
    commands.some((command) => command.name === Command.EndTurn) &&
    commands.every((command) => NARROW_AFTER_WINDOW_COMMANDS.has(command.name))
  );
}

/**
 * Deterministic subphase label for a chained follow-up decision, derived only from the offered
 * command set so macro keys are identical across constructor replay, slow motion, hydration, and
 * host-style replay. The label feeds candidate keys; the macro key additionally contains the whole
 * decision path, so a coarse label can never merge two genuinely different macros.
 */
function followUpSubphase(commands: AvailableCommand[]): SubPhase | null {
  if (isNarrowAfterWindow(commands)) {
    return SubPhase.AfterMove;
  }
  const first = commands[0];
  switch (first.name) {
    case Command.ChooseTechTile:
      return SubPhase.ChooseTechTile;
    case Command.ChooseCoverTechTile:
      return SubPhase.CoverTechTile;
    case Command.UpgradeResearch:
      return SubPhase.UpgradeResearch;
    case Command.PlaceLostPlanet:
      return SubPhase.PlaceLostPlanet;
    case Command.ChooseFederationTile:
      return (first as AvailableCommand<Command.ChooseFederationTile>).data.rescore
        ? SubPhase.RescoreFederationTile
        : SubPhase.ChooseFederationTile;
    case Command.ChooseArtifactToken:
      return SubPhase.ChooseArtifactToken;
    case Command.PlacePowerRing:
      return SubPhase.PlacePowerRing;
    case Command.BrainStone:
      return SubPhase.BrainStone;
    case Command.PISwap:
      return SubPhase.PISwap;
    case Command.GaiaFormTransdim:
      return SubPhase.InstantGaiaforming;
    case Command.Build:
    case Command.Explore:
      return commands.some((command) => command.name === Command.Explore)
        ? SubPhase.BuildMineOrGaiaFormer
        : SubPhase.BuildMine;
    default:
      return null;
  }
}

/**
 * Wallet-and-context signature mirroring the Phase 1.3 dominance dimensions. Two lines that reach
 * the narrow AfterMove window with the same main candidate and the same signature see the same
 * legal conversion catalogue, so the exhaustive AfterMove fixpoint result can be shared.
 */
function afterWalletSignature(engine: Engine, actor: Player): string {
  const player = engine.player(actor);
  const data = player.data;
  return stableCandidateJson({
    credits: data.credits,
    ores: data.ores,
    knowledge: data.knowledge,
    qics: data.qics,
    victoryPoints: data.victoryPoints,
    power: {
      area1: data.power.area1,
      area2: data.power.area2,
      area3: data.power.area3,
      gaia: data.power.gaia,
      brainstone: data.brainstone ?? null,
    },
    gaiaformers: data.gaiaformers,
    gaiaformersInGaia: data.gaiaformersInGaia,
    gaiaformersOnBoard: data.buildings[Building.GaiaFormer] ?? 0,
    gaiaformersUsedForAsteroid: data.gaiaformersUsedForAsteroid,
    gaiaformersUsedForOther: data.gaiaformersUsedForOther,
    tokenModifier: data.tokenModifier,
    terraformCostDiscount: data.terraformCostDiscount,
    temporaryRange: data.temporaryRange,
    temporaryStep: data.temporaryStep,
    satellites: data.satellites,
    tradeBonus: data.tradeBonus,
    tradeDiscount: data.tradeDiscount,
    tradeShips: data.tradeShips,
    hasPlanetaryInstitute: data.hasPlanetaryInstitute(),
  });
}

function macroKey(material: {
  sourceStateHash: string;
  actor: Player;
  conversionDestinationStateKey: string | null;
  mainCandidateKey: string;
  followUpChoiceKeys: string[];
  afterConversionDestinationStateKey: string | null;
}): string {
  const digest = createHash("sha256")
    .update(stableCandidateJson({ schemaVersion: COMMITTED_TURN_MACRO_SCHEMA, ...material }))
    .digest("hex");
  return `macro-v1:${digest}`;
}

function sortedUnique(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function conversionSeed(main: AtomicDecisionCandidate, plan: OrderedConversionPlan | null, options: number): LineState {
  const decisions: MacroDecisionRecord[] = [];
  if (plan) {
    decisions.push({
      kind: "conversion-prefix",
      command: null,
      candidateKey: null,
      moveFragments: [...plan.moveFragments],
      options,
    });
  }
  decisions.push({
    kind: "main",
    command: main.command,
    candidateKey: main.key,
    moveFragments: [main.moveFragment],
    options,
  });
  return {
    fragments: [...(plan?.moveFragments ?? []), main.moveFragment],
    decisions,
    conversionPlanKey: plan?.key ?? null,
    conversionDestinationStateKey: plan?.destinationStateKey ?? null,
    mainCandidate: main,
    afterConversionPlanKey: null,
    afterConversionDestinationStateKey: null,
    afterWindowResolved: false,
    warnings: [...main.warnings],
  };
}

/**
 * Build every complete committed-turn macro from one committed snapshot, replaying each candidate
 * line against a fresh clone exactly like the production hosts and the fuzzer commit rule
 * (`copy.move(line)`, commit only when `copy.newTurn`). A macro contains an optional Phase 1.3
 * conversion prefix, exactly one Phase 1.2 main action, every forced follow-up, meaningful
 * follow-up choices as distinct branches, retained AfterMove bowl-opening conversions, and `end`
 * when the engine requires it. Committed leech interruptions are never folded in: they surface as
 * `destination.leechPending` and become the next committed decision edge. Transient states are
 * never serialized; a `DeadEnd` line or a line that fails to commit is rejected before exposure.
 */
export function buildCommittedTurnMacros(
  source: Engine,
  options: CommittedTurnMacroBuildOptions = {}
): CommittedTurnMacroSet {
  const sourceStateHash = canonicalStateHash(source);
  const conversionIntegration = options.conversionIntegration ?? true;
  const afterConversionIntegration = options.afterConversionIntegration ?? conversionIntegration;
  const actor = source.playerToMove;
  if (actor === undefined || actor === null || !source.player(actor)) {
    throw new CommittedTurnMacroError("unsupported-state", "Committed source state has no player to move");
  }
  const actorPrefix = source.player(actor).faction ?? `p${actor + 1}`;

  // The custom-federation fallback (`federations: []` with a truthy cache `custom` flag) has no
  // enumerable geometry, so Phase 1.2 rejects it outright. The macro layer must not let that make
  // whole states unusable, and it must never silently treat the fallback as "no federation":
  // the offer is stripped from expansion and surfaced as an explicit incompleteness marker.
  const unsupportedCustomFederationTiles: string[] = [];
  let expansion: ReturnType<typeof expandAtomicDecisions>;
  if (source.phase === Phase.RoundMove) {
    const probe = hydrate(source);
    const rootCommands = probe.generateAvailableCommandsIfNeeded();
    const customOnly = rootCommands.filter(
      (command): command is AvailableCommand<Command.FormFederation> =>
        command.name === Command.FormFederation && command.data.federations.length === 0
    );
    if (customOnly.length === 0) {
      expansion = expandAtomicDecisions(source);
    } else {
      for (const command of customOnly) {
        for (const tile of command.data.tiles) {
          unsupportedCustomFederationTiles.push(String(tile));
        }
      }
      unsupportedCustomFederationTiles.sort();
      expansion = expandInternallySuppliedAtomicCommands(
        probe,
        SubPhase.BeforeMove,
        rootCommands.filter((command) => !customOnly.includes(command as AvailableCommand<Command.FormFederation>))
      );
    }
  } else {
    expansion = expandAtomicDecisions(source);
  }
  const queue: LineState[] = [];

  if (source.phase === Phase.RoundMove) {
    let mains = expansion.candidates.filter(isMainCandidate);
    if (options.mainCandidateKeys) {
      const allowed = new Set(options.mainCandidateKeys);
      mains = mains.filter((candidate) => allowed.has(candidate.key));
    }
    if (!conversionIntegration) {
      for (const main of mains) {
        queue.push(conversionSeed(main, null, mains.length));
      }
    } else {
      // No planner-side candidate filter: conversion-enabled candidates that are unaffordable at
      // the root (13 of the locked state's 45 candidate frontiers) are exactly what integration
      // must expose. Any caller filter is applied to the complete candidate set afterwards.
      const planning = planResourceConversions(source);
      for (const diagnostic of planning.diagnostics.unsupportedCustomFederations) {
        for (const tile of diagnostic.tiles) {
          if (!unsupportedCustomFederationTiles.includes(tile)) {
            unsupportedCustomFederationTiles.push(tile);
          }
        }
      }
      unsupportedCustomFederationTiles.sort();
      const allowedKeys = options.mainCandidateKeys ? new Set(options.mainCandidateKeys) : null;
      for (const entry of planning.candidates) {
        const main = entry.candidate;
        if (allowedKeys && !allowedKeys.has(main.key)) {
          continue;
        }
        const planByKey = new Map(entry.plans.map((plan) => [plan.key, plan]));
        const seenPlans = new Set<string>();
        const seeds: LineState[] = [];
        for (const payment of entry.payments.frontier) {
          if (seenPlans.has(payment.conversionPlanKey)) {
            continue;
          }
          seenPlans.add(payment.conversionPlanKey);
          const plan = planByKey.get(payment.conversionPlanKey);
          if (!plan) {
            throw new CommittedTurnMacroError(
              "invalid-line",
              `Payment frontier references unknown conversion plan ${payment.conversionPlanKey}`
            );
          }
          seeds.push(conversionSeed(main, plan.steps.length === 0 ? null : plan, 0));
        }
        for (const seed of seeds) {
          for (const decision of seed.decisions) {
            decision.options = seeds.length;
          }
          queue.push(seed);
        }
      }
    }
  } else {
    for (const candidate of expansion.candidates) {
      queue.push({
        fragments: [candidate.moveFragment],
        decisions: [
          {
            kind: "main",
            command: candidate.command,
            candidateKey: candidate.key,
            moveFragments: [candidate.moveFragment],
            options: expansion.candidates.length,
          },
        ],
        conversionPlanKey: null,
        conversionDestinationStateKey: null,
        mainCandidate: candidate,
        afterConversionPlanKey: null,
        afterConversionDestinationStateKey: null,
        afterWindowResolved: false,
        warnings: [...candidate.warnings],
      });
    }
  }

  const macros = new Map<string, CommittedTurnMacro>();
  const deduplications: MacroDeduplication[] = [];
  const rejected: RejectedMacroLine[] = [];

  const finalize = (line: LineState, committed: Engine) => {
    let destinationHash: string;
    try {
      destinationHash = canonicalStateHash(committed);
    } catch (error) {
      rejected.push({
        reason: "unsupported-destination",
        moveFragments: [...line.fragments],
        detail: String((error as Error)?.message ?? error),
      });
      return;
    }
    const followUpChoiceKeys = line.decisions
      .filter((decision) => decision.kind === "choice-follow-up")
      .map((decision) => decision.candidateKey as string);
    const forcedFollowUpKeys = line.decisions
      .filter((decision) => decision.kind === "forced-follow-up")
      .map((decision) => decision.candidateKey as string);
    const key = macroKey({
      sourceStateHash,
      actor,
      conversionDestinationStateKey: line.conversionDestinationStateKey,
      mainCandidateKey: line.mainCandidate.key,
      followUpChoiceKeys,
      afterConversionDestinationStateKey: line.afterConversionDestinationStateKey,
    });
    const macro: CommittedTurnMacro = {
      schemaVersion: COMMITTED_TURN_MACRO_SCHEMA,
      key,
      sourceStateHash,
      actor,
      actorPrefix,
      phase: source.phase,
      round: source.round,
      conversionPlanKey: line.conversionPlanKey,
      conversionDestinationStateKey: line.conversionDestinationStateKey,
      mainCandidateKey: line.mainCandidate.key,
      mainCommand: line.mainCandidate.command,
      followUpChoiceKeys,
      forcedFollowUpKeys,
      afterConversionPlanKey: line.afterConversionPlanKey,
      afterConversionDestinationStateKey: line.afterConversionDestinationStateKey,
      decisions: line.decisions,
      moveFragments: [...line.fragments],
      moveLine: `${actorPrefix} ${line.fragments.join(". ")}`,
      warnings: sortedUnique(line.warnings),
      destination: {
        stateHash: destinationHash,
        phase: committed.phase,
        round: committed.round,
        nextActor: committed.playerToMove ?? null,
        leechPending: committed.phase === Phase.RoundLeech,
        actorPassed: (committed.passedPlayers ?? []).includes(actor),
        passOrder: [...(committed.passedPlayers ?? [])],
        gameEnded: committed.phase === Phase.EndGame,
      },
    };
    const existing = macros.get(key);
    if (existing) {
      if (existing.destination.stateHash !== macro.destination.stateHash) {
        throw new CommittedTurnMacroError(
          "semantic-key-collision",
          `Macro key ${key} maps to two different committed destinations`
        );
      }
      deduplications.push({
        key,
        keptMoveFragments: existing.moveFragments,
        mergedMoveFragments: macro.moveFragments,
      });
      return;
    }
    macros.set(key, macro);
  };

  const afterWindowCache = new Map<string, ReturnType<typeof planAfterActionConversionsForLine>>();

  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const line = queue[queueIndex];
    queueIndex += 1;
    if (line.fragments.length > MAX_LINE_FRAGMENTS) {
      throw new CommittedTurnMacroError(
        "invalid-line",
        `Macro line exceeded ${MAX_LINE_FRAGMENTS} fragments without committing: ${line.fragments.join(". ")}`
      );
    }
    const clone = hydrate(source);
    try {
      clone.move(`${actorPrefix} ${line.fragments.join(". ")}`);
    } catch (error) {
      rejected.push({
        reason: "line-apply-failed",
        moveFragments: [...line.fragments],
        detail: String((error as Error)?.message ?? error),
      });
      continue;
    }
    if (clone.newTurn) {
      finalize(line, clone);
      continue;
    }
    const commands = clone.availableCommands;
    if (!commands || commands.length === 0) {
      throw new CommittedTurnMacroError(
        "invalid-line",
        `Incomplete line offered no follow-up commands: ${line.fragments.join(". ")}`
      );
    }
    if (commands.some((command) => command.name === Command.DeadEnd)) {
      rejected.push({
        reason: "dead-end-follow-up",
        moveFragments: [...line.fragments],
        detail: "Engine offered DeadEnd for a required chained decision; a real player must undo this line",
      });
      continue;
    }

    if (source.phase === Phase.RoundMove && isNarrowAfterWindow(commands)) {
      let resolvedRetained = false;
      if (!line.afterWindowResolved && afterConversionIntegration && line.mainCandidate.command !== Command.Pass) {
        // One exhaustive AfterMove fixpoint per distinct (main candidate, post-main wallet) pair;
        // lines converging on the same wallet reuse the identical retained/deferred result.
        const cacheKey = `${line.mainCandidate.key}\0${afterWalletSignature(clone, actor)}`;
        let after = afterWindowCache.get(cacheKey);
        if (!after) {
          after = planAfterActionConversionsForLine(source, line.mainCandidate, line.fragments);
          afterWindowCache.set(cacheKey, after);
        }
        if (after.status === "planned") {
          for (const retainedEntry of after.retained) {
            const plan = retainedEntry.plan;
            const wait = plan.steps.length === 0;
            queue.push({
              ...line,
              fragments: [...line.fragments, ...plan.moveFragments, Command.EndTurn],
              decisions: [
                ...line.decisions,
                ...(wait
                  ? []
                  : [
                      {
                        kind: "after-conversion" as const,
                        command: null,
                        candidateKey: null,
                        moveFragments: [...plan.moveFragments],
                        options: after.retained.length,
                      },
                    ]),
                {
                  kind: "end-turn" as const,
                  command: Command.EndTurn,
                  candidateKey: null,
                  moveFragments: [Command.EndTurn],
                  options: after.retained.length,
                },
              ],
              afterConversionPlanKey: wait ? null : plan.key,
              afterConversionDestinationStateKey: wait ? null : plan.destinationStateKey,
              afterWindowResolved: true,
              warnings: [...line.warnings],
            });
          }
          resolvedRetained = after.retained.length > 0;
        }
      }
      if (!resolvedRetained) {
        queue.push({
          ...line,
          fragments: [...line.fragments, Command.EndTurn],
          decisions: [
            ...line.decisions,
            {
              kind: "end-turn",
              command: Command.EndTurn,
              candidateKey: null,
              moveFragments: [Command.EndTurn],
              options: 1,
            },
          ],
          afterWindowResolved: true,
          warnings: [...line.warnings],
        });
      }
      continue;
    }

    const subphase = followUpSubphase(commands);
    const followUps =
      clone.phase === Phase.RoundMove && subphase !== null
        ? expandInternallySuppliedAtomicCommands(clone, subphase, commands)
        : expandAtomicDecisions(source, {
            priorMoveFragments: line.fragments,
            subphase,
          });
    if (followUps.candidates.length === 1) {
      const only = followUps.candidates[0];
      queue.push({
        ...line,
        fragments: [...line.fragments, only.moveFragment],
        decisions: [
          ...line.decisions,
          {
            kind: "forced-follow-up",
            command: only.command,
            candidateKey: only.key,
            moveFragments: [only.moveFragment],
            options: 1,
          },
        ],
        warnings: [...line.warnings, ...only.warnings],
      });
      continue;
    }
    for (const candidate of followUps.candidates) {
      queue.push({
        ...line,
        fragments: [...line.fragments, candidate.moveFragment],
        decisions: [
          ...line.decisions,
          {
            kind: "choice-follow-up",
            command: candidate.command,
            candidateKey: candidate.key,
            moveFragments: [candidate.moveFragment],
            options: followUps.candidates.length,
          },
        ],
        warnings: [...line.warnings, ...candidate.warnings],
      });
    }
  }

  const sortedMacros = Array.from(macros.values()).sort((a, b) => a.key.localeCompare(b.key));
  const statistics: MacroBranchStatistics = {
    conversionIntegration,
    macroCount: sortedMacros.length,
    mainCandidateCount: new Set(sortedMacros.map((macro) => macro.mainCandidateKey)).size,
    conversionPlanCount: new Set(
      sortedMacros.map((macro) => macro.conversionPlanKey).filter((key): key is string => key !== null)
    ).size,
    afterConversionMacroCount: sortedMacros.filter((macro) => macro.afterConversionPlanKey !== null).length,
    meaningfulFollowUpKeyCount: new Set(sortedMacros.flatMap((macro) => macro.followUpChoiceKeys)).size,
    forcedFollowUpKeyCount: new Set(sortedMacros.flatMap((macro) => macro.forcedFollowUpKeys)).size,
    rejectedLineCount: rejected.length,
    deduplicationCount: deduplications.length,
    unsupportedCustomFederationCount: unsupportedCustomFederationTiles.length,
  };

  return {
    schemaVersion: COMMITTED_TURN_MACRO_SCHEMA,
    sourceStateHash,
    actor,
    actorPrefix,
    phase: source.phase,
    round: source.round,
    macros: sortedMacros,
    rejected: rejected.sort(
      (a, b) => a.moveFragments.join(". ").localeCompare(b.moveFragments.join(". ")) || a.reason.localeCompare(b.reason)
    ),
    deduplications: deduplications.sort(
      (a, b) =>
        a.key.localeCompare(b.key) || a.mergedMoveFragments.join(". ").localeCompare(b.mergedMoveFragments.join(". "))
    ),
    unsupportedCustomFederationTiles,
    statistics,
  };
}
