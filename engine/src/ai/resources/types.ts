import { AtomicDecisionCandidate, ResourceAmount } from "../actions/types";
import { Faction, Phase, Player, PowerArea, Resource, SubPhase } from "../../enums";

export const CONVERSION_STATE_SCHEMA = "gaia-ai-conversion-state/v1" as const;
export const CONVERSION_PLAN_SCHEMA = "gaia-ai-conversion-plan/v1" as const;

export type CanonicalConversionStateKey = string;
export type CanonicalConversionPlanKey = string;

export type ConversionTimingContext =
  | {
      kind: "pre-action";
      phase: Phase.RoundMove;
      subphase: SubPhase.BeforeMove;
    }
  | {
      kind: "post-action-before-leech";
      phase: Phase.RoundMove;
      subphase: SubPhase.AfterMove;
      mainCandidateKey: string;
      /** True only for an internally replayed, ordinary non-pass main action. */
      nextTurnDeferralProven: boolean;
    };

export interface ProjectedPowerState {
  area1: number;
  area2: number;
  area3: number;
  gaia: number;
  brainstone: PowerArea | null;
}

export interface ProjectedGaiaformerState {
  total: number;
  inGaia: number;
  onBoard: number;
  usedForAsteroid: number;
  usedForOther: number;
  available: number;
}

/**
 * Resource-only projection used by the conversion graph. `contextKey` binds a projection to the
 * unchanged board/action context, so equal-looking wallets from different positions never merge.
 */
export interface ProjectedConversionState {
  schemaVersion: typeof CONVERSION_STATE_SCHEMA;
  contextKey: string;
  actor: Player;
  faction: Faction;
  phase: Phase.RoundMove;
  round: number;
  finalRound: boolean;
  timing: ConversionTimingContext;
  credits: number;
  ores: number;
  knowledge: number;
  qics: number;
  victoryPoints: number;
  power: ProjectedPowerState;
  gaiaformers: ProjectedGaiaformerState;
  tokenModifier: number;
  terraformCostDiscount: number;
  temporaryRange: number;
  temporaryStep: number;
  satellites: number;
  tradeBonus: number;
  tradeDiscount: number;
  tradeShips: number;
  hasPlanetaryInstitute: boolean;
  conversionRights: string[];
}

export interface ExecutableConversionStep {
  kind: "spend" | "burn";
  familyKey: string;
  cost: ResourceAmount[];
  reward: ResourceAmount[];
  effects: string[];
  /** One Spend/Burn fragment followed by a BrainStone choice fragment when production requires it. */
  moveFragments: string[];
  beforeStateKey: CanonicalConversionStateKey;
  afterStateKey: CanonicalConversionStateKey;
  changesPowerBowls: boolean;
}

export interface OrderedConversionPlan {
  schemaVersion: typeof CONVERSION_PLAN_SCHEMA;
  key: CanonicalConversionPlanKey;
  timing: ConversionTimingContext;
  sourceStateKey: CanonicalConversionStateKey;
  destinationStateKey: CanonicalConversionStateKey;
  steps: ExecutableConversionStep[];
  moveFragments: string[];
}

export interface PaymentResult {
  candidateKey: string;
  conversionPlanKey: CanonicalConversionPlanKey;
  affordable: boolean;
  cost: ResourceAmount[];
  postPaymentState: ProjectedConversionState;
  postPaymentStateKey: CanonicalConversionStateKey;
  brainstoneChoice: PowerArea | "discard" | null;
  moveFragments: string[];
}

export interface ParetoFrontierResult<T> {
  frontier: T[];
  dominated: Array<{
    dominatedKey: string;
    dominatingKey: string;
  }>;
}

export interface CandidateConversionPlans {
  candidate: AtomicDecisionCandidate;
  plans: OrderedConversionPlan[];
  payments: ParetoFrontierResult<PaymentResult>;
}

export interface ConversionMergeDiagnostic {
  destinationStateKey: CanonicalConversionStateKey;
  keptPlanKey: CanonicalConversionPlanKey;
  keptMoveFragments: string[];
  mergedMoveFragments: string[];
  reason: "commutative-order" | "equivalent-executable-sequence";
}

export interface LossyCycleDiagnostic {
  ancestorStateKey: CanonicalConversionStateKey;
  discardedStateKey: CanonicalConversionStateKey;
  moveFragments: string[];
  resourceCycle: Resource[];
  reason: "componentwise-dominated-cycle";
}

export interface ConversionAliasDiagnostic {
  moveFragment: string;
  canonicalUnitFragment: string;
  reason: "ranged-repeat-canonicalized";
}

export interface ParetoPruneDiagnostic {
  discardedStateKey: CanonicalConversionStateKey;
  dominatingStateKey: CanonicalConversionStateKey;
  moveFragments: string[];
  reason: "componentwise-dominated-transition";
}

export interface UnsupportedCustomFederationDiagnostic {
  /** Conversion state whose wallet made the engine offer only the custom-federation fallback. */
  stateKey: CanonicalConversionStateKey;
  tiles: string[];
  reason: "custom-federation-fallback-has-no-enumerable-geometry";
}

export interface ConversionPlannerDiagnostics {
  merges: ConversionMergeDiagnostic[];
  lossyCycles: LossyCycleDiagnostic[];
  aliases: ConversionAliasDiagnostic[];
  paretoPruned: ParetoPruneDiagnostic[];
  unavailableEffects: string[];
  /**
   * Frontier states where a FormFederation command carried no enumerable geometry (the engine's
   * custom fallback). The candidate result is explicitly incomplete for these tiles at these
   * wallets; nothing here is silently treated as "no federation".
   */
  unsupportedCustomFederations: UnsupportedCustomFederationDiagnostic[];
}

/** Deterministic work counters for profiling the exhaustive offline planner. */
export interface ResourceConversionPlannerCounters {
  statesGenerated: number;
  statesAccepted: number;
  activeFrontierSize: number;
  maximumActiveFrontierSize: number;
  transitionsConsidered: number;
  exactStateMerges: number;
  paretoPrunes: number;
  lossyCyclePrunes: number;
  dominanceComparisons: number;
  exactContextComputations: number;
  stateKeyComputations: number;
  planKeyComputations: number;
  resourceCycleGraphReconstructions: number;
  candidateStatesExpanded: number;
  paymentResultsGenerated: number;
}

/** Descriptive timings only. They are never consulted to terminate or prune planning. */
export interface ResourceConversionPlannerTimings {
  setupMs: number;
  reachabilityMs: number;
  resultAssemblyMs: number;
  candidateConstructionMs: number;
  paymentFrontiersMs: number;
  totalMs: number;
}

export interface ResourceConversionPlannerProfile {
  counters: ResourceConversionPlannerCounters;
  timings: ResourceConversionPlannerTimings;
}

export interface ResourceConversionPlannerProgress {
  counters: ResourceConversionPlannerCounters;
  largestConversionDepth: number;
  elapsedMs: number;
}

export interface ResourceConversionPlanningResult {
  sourceStateKey: CanonicalConversionStateKey;
  timing: ConversionTimingContext;
  reachableStates: ProjectedConversionState[];
  reachablePlans: OrderedConversionPlan[];
  stateFrontier: ParetoFrontierResult<ProjectedConversionState>;
  candidates: CandidateConversionPlans[];
  diagnostics: ConversionPlannerDiagnostics;
  largestConversionDepth: number;
  profile: ResourceConversionPlannerProfile;
}

export interface DeferredAfterActionPlan {
  planKey: CanonicalConversionPlanKey;
  moveFragments: string[];
  reason:
    | "ordinary-resources-unobservable-before-next-before-move"
    | "trailing-non-bowl-conversions-deferred-after-capacity-opening"
    | "power-bowl-change-does-not-increase-leech-capacity";
}

export interface RetainedAfterActionPlan {
  plan: OrderedConversionPlan;
  leechCapacityBefore: number;
  leechCapacityAfter: number;
  reason: "opens-power-bowl-capacity-before-leech" | "deferral-proof-unavailable" | "wait";
}

export interface AfterActionConversionResult {
  status: "planned" | "not-applicable";
  reason: string | null;
  mainCandidate: AtomicDecisionCandidate;
  retained: RetainedAfterActionPlan[];
  deferred: DeferredAfterActionPlan[];
  planning: ResourceConversionPlanningResult | null;
}

export interface ResourceConversionPlannerOptions {
  /** Optional Phase 1.2 candidate filter. Keys not legal in a reached state simply have no result. */
  mainCandidates?: readonly AtomicDecisionCandidate[];
  /** Optional offline profiler callback. It observes work and never changes planner semantics. */
  onProgress?: (progress: ResourceConversionPlannerProgress) => void;
  /** Deterministic transition interval for `onProgress`; defaults to 100,000. */
  progressEveryTransitions?: number;
}
