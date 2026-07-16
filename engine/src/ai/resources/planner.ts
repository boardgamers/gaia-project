import { createHash } from "crypto";
import { performance } from "perf_hooks";
import { possibleFreeActions } from "../../available/actions";
import { AtomicDecisionCandidate, ResourceAmount } from "../actions/types";
import {
  expandAtomicDecisions,
  expandInternallyReplayedAtomicDecision,
  expandInternallySuppliedAtomicCommands,
} from "../actions/expand";
import { canonicalStateHash, projectCanonicalState } from "../canonical-state";
import Engine from "../../engine";
import { Building, Command, Faction, Phase, Player, PowerArea, Resource, Round, SubPhase } from "../../enums";
import { stableCandidateJson } from "../actions/canonical-key";
import { canonicalConversionPlanKey, canonicalConversionStateKey } from "./canonical-key";
import {
  AfterActionConversionResult,
  CandidateConversionPlans,
  CanonicalConversionStateKey,
  CONVERSION_PLAN_SCHEMA,
  CONVERSION_STATE_SCHEMA,
  ConversionPlannerDiagnostics,
  ConversionTimingContext,
  ExecutableConversionStep,
  OrderedConversionPlan,
  ParetoFrontierResult,
  PaymentResult,
  ProjectedConversionState,
  ResourceConversionPlannerCounters,
  ResourceConversionPlannerOptions,
  ResourceConversionPlanningResult,
} from "./types";

export type ResourceConversionPlannerErrorCode =
  | "unsupported-state"
  | "invalid-plan"
  | "unsupported-payment-resource"
  | "semantic-key-collision";

export class ResourceConversionPlannerError extends Error {
  constructor(readonly code: ResourceConversionPlannerErrorCode, message: string) {
    super(message);
    this.name = "ResourceConversionPlannerError";
  }
}

/** More is safe only when every listed dimension is componentwise no smaller. */
export const PARETO_MONOTONE_DIMENSIONS = [
  "credits",
  "ores",
  "knowledge",
  "qics",
  "victoryPoints",
  "power.area1",
  "power.area2",
  "power.area3",
  "power.gaia",
  "gaiaformers.available",
] as const;

/** These dimensions must be equal; Phase 1.3 never assigns exchange weights to them. */
export const PARETO_EXACT_DIMENSIONS = [
  "contextKey",
  "actor",
  "faction",
  "phase",
  "round",
  "finalRound",
  "timing",
  "power.brainstone",
  "gaiaformers.total",
  "gaiaformers.inGaia",
  "gaiaformers.onBoard",
  "gaiaformers.usedForAsteroid",
  "gaiaformers.usedForOther",
  "tokenModifier",
  "terraformCostDiscount",
  "temporaryRange",
  "temporaryStep",
  "satellites",
  "tradeBonus",
  "tradeDiscount",
  "tradeShips",
  "hasPlanetaryInstitute",
  "conversionRights",
] as const;

interface ReachabilityNode {
  state: ProjectedConversionState;
  stateKey: CanonicalConversionStateKey;
  plan: OrderedConversionPlan;
  lineageStates: ProjectedConversionState[];
}

interface CandidateAccumulator {
  candidate: AtomicDecisionCandidate;
  plans: Map<string, OrderedConversionPlan>;
  payments: PaymentResult[];
}

const BASE_CONVERSION_RIGHTS: readonly string[] = [
  "4pw->1q",
  "3pw->1o",
  "1q->1o",
  "4pw->1k",
  "1pw->1c",
  "1k->1c",
  "1o->1c",
  "1o->1t-area1",
  "burn-area2->area3",
];

function conversionRights(engine: Engine, actor: Player): string[] {
  const player = engine.player(actor);
  const rights: string[] = [...BASE_CONVERSION_RIGHTS];
  switch (player.faction) {
    case Faction.HadschHallas:
      if (player.data.hasPlanetaryInstitute()) {
        rights.push("4c->1q", "3c->1o", "4c->1k");
      }
      break;
    case Faction.Nevlas:
      rights.push("1t-area3->gaia+1k");
      if (player.data.hasPlanetaryInstitute()) {
        rights.push("2pw->2c", "4pw->1o+1c", "6pw->2o");
      }
      break;
    case Faction.BalTaks:
      rights.push("1gf->1q");
      break;
    case Faction.Taklons:
      rights.push("3pw->3c");
      break;
    case Faction.Xenos:
      if (engine.options.lostFleet) {
        rights.push("1o->1t-area3");
      }
      break;
  }
  return rights.sort();
}

function replayPrefix(source: Engine, fragments: readonly string[]): Engine {
  const replay = Engine.fromData(JSON.parse(JSON.stringify(source)));
  if (fragments.length === 0) {
    return replay;
  }
  const actor = replay.player(replay.playerToMove);
  if (!actor) {
    throw new ResourceConversionPlannerError("invalid-plan", "Conversion prefix has no current actor");
  }
  replay.move(`${actor.faction} ${fragments.join(". ")}`);
  return replay;
}

function stateContextKey(sourceHash: string, timing: ConversionTimingContext): string {
  return createHash("sha256")
    .update("gaia-ai-conversion-context/v1\0")
    .update(sourceHash)
    .update("\0")
    .update(stableCandidateJson(timing))
    .digest("hex");
}

function projectState(
  engine: Engine,
  contextKey: string,
  timing: ConversionTimingContext,
  rights: string[]
): ProjectedConversionState {
  const actor = engine.playerToMove;
  const player = engine.player(actor);
  if (!player || engine.phase !== Phase.RoundMove) {
    throw new ResourceConversionPlannerError(
      "unsupported-state",
      "Resource conversion projection requires an initialized RoundMove actor"
    );
  }
  const data = player.data;
  const onBoard = data.buildings[Building.GaiaFormer];
  return {
    schemaVersion: CONVERSION_STATE_SCHEMA,
    contextKey,
    actor,
    faction: player.faction,
    phase: Phase.RoundMove,
    round: engine.round,
    finalRound: engine.round === Round.LastRound,
    timing,
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
      brainstone: data.brainstone,
    },
    gaiaformers: {
      total: data.gaiaformers,
      inGaia: data.gaiaformersInGaia,
      onBoard,
      usedForAsteroid: data.gaiaformersUsedForAsteroid,
      usedForOther: data.gaiaformersUsedForOther,
      available: data.gaiaformers - data.gaiaformersInGaia - onBoard - data.gaiaformersUsedForAsteroid,
    },
    tokenModifier: data.tokenModifier,
    terraformCostDiscount: data.terraformCostDiscount,
    temporaryRange: data.temporaryRange,
    temporaryStep: data.temporaryStep,
    satellites: data.satellites,
    tradeBonus: data.tradeBonus,
    tradeDiscount: data.tradeDiscount,
    tradeShips: data.tradeShips,
    hasPlanetaryInstitute: data.hasPlanetaryInstitute(),
    conversionRights: [...rights],
  };
}

function emptyPlan(
  state: ProjectedConversionState,
  stateKey = canonicalConversionStateKey(state),
  planKey: typeof canonicalConversionPlanKey = canonicalConversionPlanKey
): OrderedConversionPlan {
  return {
    schemaVersion: CONVERSION_PLAN_SCHEMA,
    key: planKey({ sourceStateKey: stateKey, destinationStateKey: stateKey, timing: state.timing }),
    timing: state.timing,
    sourceStateKey: stateKey,
    destinationStateKey: stateKey,
    steps: [],
    moveFragments: [],
  };
}

function cloneState(state: ProjectedConversionState): ProjectedConversionState {
  return JSON.parse(JSON.stringify(state)) as ProjectedConversionState;
}

function exactDimensions(state: ProjectedConversionState): unknown {
  return {
    contextKey: state.contextKey,
    actor: state.actor,
    faction: state.faction,
    phase: state.phase,
    round: state.round,
    finalRound: state.finalRound,
    timing: state.timing,
    brainstone: state.power.brainstone,
    gaiaformers: {
      total: state.gaiaformers.total,
      inGaia: state.gaiaformers.inGaia,
      onBoard: state.gaiaformers.onBoard,
      usedForAsteroid: state.gaiaformers.usedForAsteroid,
      usedForOther: state.gaiaformers.usedForOther,
    },
    tokenModifier: state.tokenModifier,
    terraformCostDiscount: state.terraformCostDiscount,
    temporaryRange: state.temporaryRange,
    temporaryStep: state.temporaryStep,
    satellites: state.satellites,
    tradeBonus: state.tradeBonus,
    tradeDiscount: state.tradeDiscount,
    tradeShips: state.tradeShips,
    hasPlanetaryInstitute: state.hasPlanetaryInstitute,
    conversionRights: [...state.conversionRights].sort(),
  };
}

interface DominanceMaterial {
  exactKey: string;
  monotone: readonly number[];
}

function dominanceMaterial(state: ProjectedConversionState): DominanceMaterial {
  return {
    exactKey: stableCandidateJson(exactDimensions(state)),
    monotone: [
      state.credits,
      state.ores,
      state.knowledge,
      state.qics,
      state.victoryPoints,
      state.power.area1,
      state.power.area2,
      state.power.area3,
      state.power.gaia,
      state.gaiaformers.available,
    ],
  };
}

function materialDominates(left: DominanceMaterial, right: DominanceMaterial): boolean {
  if (left.exactKey !== right.exactKey) {
    return false;
  }
  let strict = false;
  for (let index = 0; index < left.monotone.length; index += 1) {
    if (left.monotone[index] < right.monotone[index]) {
      return false;
    }
    strict = strict || left.monotone[index] > right.monotone[index];
  }
  return strict;
}

interface DominanceIndexEntry<T extends object> {
  item: T;
  state: ProjectedConversionState;
  order: number;
  active: boolean;
}

/**
 * Exact-context plus credit/ore/knowledge/QIC buckets are a necessary-condition filter only.
 * Every returned relationship still passes the complete ten-dimensional strict predicate.
 */
class DominanceFrontierIndex<T extends object> {
  private readonly buckets = new Map<
    string,
    Map<number, Map<number, Map<number, Map<number, Array<DominanceIndexEntry<T>>>>>>
  >();
  private readonly entries = new Map<T, DominanceIndexEntry<T>>();
  private nextOrder = 0;

  constructor(
    private readonly materialFor: (state: ProjectedConversionState) => DominanceMaterial,
    private readonly dominates: (left: ProjectedConversionState, right: ProjectedConversionState) => boolean
  ) {}

  add(item: T, state: ProjectedConversionState): void {
    const entry: DominanceIndexEntry<T> = {
      item,
      state,
      order: this.nextOrder,
      active: true,
    };
    this.nextOrder += 1;
    this.entries.set(item, entry);
    const exact = this.materialFor(state).exactKey;
    const byCredit =
      this.buckets.get(exact) ??
      new Map<number, Map<number, Map<number, Map<number, Array<DominanceIndexEntry<T>>>>>>();
    const byOre =
      byCredit.get(state.credits) ?? new Map<number, Map<number, Map<number, Array<DominanceIndexEntry<T>>>>>();
    const byKnowledge = byOre.get(state.ores) ?? new Map<number, Map<number, Array<DominanceIndexEntry<T>>>>();
    const byQic = byKnowledge.get(state.knowledge) ?? new Map<number, Array<DominanceIndexEntry<T>>>();
    const entries = byQic.get(state.qics) ?? [];
    entries.push(entry);
    byQic.set(state.qics, entries);
    byKnowledge.set(state.knowledge, byQic);
    byOre.set(state.ores, byKnowledge);
    byCredit.set(state.credits, byOre);
    this.buckets.set(exact, byCredit);
  }

  remove(item: T): void {
    const entry = this.entries.get(item);
    if (entry) {
      entry.active = false;
    }
  }

  findDominator(state: ProjectedConversionState): T | undefined {
    let best: DominanceIndexEntry<T> | undefined;
    for (const entry of this.candidates(state, "dominator")) {
      if (this.dominates(entry.state, state) && (!best || entry.order < best.order)) {
        best = entry;
      }
    }
    return best?.item;
  }

  findDominated(state: ProjectedConversionState): T[] {
    return this.candidates(state, "dominated")
      .filter((entry) => this.dominates(state, entry.state))
      .sort((left, right) => left.order - right.order)
      .map((entry) => entry.item);
  }

  private candidates(
    state: ProjectedConversionState,
    direction: "dominator" | "dominated"
  ): Array<DominanceIndexEntry<T>> {
    const byCredit = this.buckets.get(this.materialFor(state).exactKey);
    if (!byCredit) {
      return [];
    }
    const result: Array<DominanceIndexEntry<T>> = [];
    for (const [credits, byOre] of byCredit) {
      if (direction === "dominator" ? credits < state.credits : credits > state.credits) {
        continue;
      }
      for (const [ores, byKnowledge] of byOre) {
        if (direction === "dominator" ? ores < state.ores : ores > state.ores) {
          continue;
        }
        for (const [knowledge, byQic] of byKnowledge) {
          if (direction === "dominator" ? knowledge < state.knowledge : knowledge > state.knowledge) {
            continue;
          }
          for (const [qics, entries] of byQic) {
            if (direction === "dominator" ? qics < state.qics : qics > state.qics) {
              continue;
            }
            for (const entry of entries) {
              if (entry.active && this.remainingDimensionsPossible(entry.state, state, direction)) {
                result.push(entry);
              }
            }
          }
        }
      }
    }
    return result;
  }

  private remainingDimensionsPossible(
    entry: ProjectedConversionState,
    target: ProjectedConversionState,
    direction: "dominator" | "dominated"
  ): boolean {
    if (direction === "dominator") {
      return (
        entry.victoryPoints >= target.victoryPoints &&
        entry.power.area1 >= target.power.area1 &&
        entry.power.area2 >= target.power.area2 &&
        entry.power.area3 >= target.power.area3 &&
        entry.power.gaia >= target.power.gaia &&
        entry.gaiaformers.available >= target.gaiaformers.available
      );
    }
    return (
      entry.victoryPoints <= target.victoryPoints &&
      entry.power.area1 <= target.power.area1 &&
      entry.power.area2 <= target.power.area2 &&
      entry.power.area3 <= target.power.area3 &&
      entry.power.gaia <= target.power.gaia &&
      entry.gaiaformers.available <= target.gaiaformers.available
    );
  }
}

/** Strict, weight-free dominance under one board/action/timing context. */
export function conversionStateDominates(left: ProjectedConversionState, right: ProjectedConversionState): boolean {
  return materialDominates(dominanceMaterial(left), dominanceMaterial(right));
}

function isConversion(candidate: AtomicDecisionCandidate): boolean {
  return candidate.command === Command.Spend || candidate.command === Command.BurnPower;
}

function isMainCandidate(candidate: AtomicDecisionCandidate): boolean {
  return ![Command.Spend, Command.BurnPower, Command.BrainStone, Command.EndTurn].includes(candidate.command);
}

function conversionFamilyKey(candidate: AtomicDecisionCandidate): string {
  return `${candidate.command}:${candidate.moveFragment}`;
}

function isUnitConversion(candidate: AtomicDecisionCandidate): boolean {
  if (candidate.command === Command.BurnPower) {
    return candidate.target.amount === 1;
  }
  if (candidate.command === Command.Spend) {
    return candidate.target.multiplier === 1;
  }
  return false;
}

function normalizedFlow(candidate: AtomicDecisionCandidate): string {
  if (candidate.command !== Command.Spend) {
    return candidate.moveFragment;
  }
  const divisor = candidate.target.multiplier;
  return stableCandidateJson({
    cost: candidate.resources.cost.map((entry) => ({
      resource: entry.resource,
      amount: entry.amount / divisor,
    })),
    reward: candidate.resources.reward.map((entry) => ({
      resource: entry.resource,
      amount: entry.amount / divisor,
    })),
    effects: candidate.resources.effects,
  });
}

function changesPower(before: ProjectedConversionState, after: ProjectedConversionState): boolean {
  return stableCandidateJson(before.power) !== stableCandidateJson(after.power);
}

function resourceNode(resource: Resource): Resource {
  switch (resource) {
    case Resource.PayPower:
    case Resource.GainToken:
    case Resource.GainTokenArea3:
    case Resource.BurnToken:
    case Resource.MoveTokenToGaiaArea:
    case Resource.MoveTokenFromArea3ToGaia:
      return Resource.ChargePower;
    default:
      return resource;
  }
}

function resourceCycle(steps: ExecutableConversionStep[]): Resource[] {
  const graph = new Map<Resource, Set<Resource>>();
  for (const step of steps) {
    for (const cost of step.cost) {
      for (const reward of step.reward) {
        const from = resourceNode(cost.resource);
        const to = resourceNode(reward.resource);
        if (from !== to) {
          const targets = graph.get(from) ?? new Set<Resource>();
          targets.add(to);
          graph.set(from, targets);
        }
      }
    }
  }
  const visiting = new Set<Resource>();
  const visited = new Set<Resource>();
  const path: Resource[] = [];
  const visit = (node: Resource): Resource[] => {
    if (visiting.has(node)) {
      return [...path.slice(path.indexOf(node)), node];
    }
    if (visited.has(node)) {
      return [];
    }
    visiting.add(node);
    path.push(node);
    for (const target of graph.get(node) ?? []) {
      const cycle = visit(target);
      if (cycle.length > 0) {
        return cycle;
      }
    }
    path.pop();
    visiting.delete(node);
    visited.add(node);
    return [];
  };
  for (const node of Array.from(graph.keys()).sort()) {
    const cycle = visit(node);
    if (cycle.length > 0) {
      return cycle;
    }
  }
  return [];
}

function sortedCandidates(candidates: AtomicDecisionCandidate[]): AtomicDecisionCandidate[] {
  return [...candidates].sort((a, b) => a.moveFragment.localeCompare(b.moveFragment) || a.key.localeCompare(b.key));
}

function applyProjectedState(engine: Engine, state: ProjectedConversionState): void {
  const player = engine.player(state.actor);
  const data = player.data;
  data.credits = state.credits;
  data.ores = state.ores;
  data.knowledge = state.knowledge;
  data.qics = state.qics;
  data.victoryPoints = state.victoryPoints;
  data.power.area1 = state.power.area1;
  data.power.area2 = state.power.area2;
  data.power.area3 = state.power.area3;
  data.power.gaia = state.power.gaia;
  data.brainstone = state.power.brainstone;
  data.gaiaformers = state.gaiaformers.total;
  data.gaiaformersInGaia = state.gaiaformers.inGaia;
  data.gaiaformersUsedForAsteroid = state.gaiaformers.usedForAsteroid;
  data.gaiaformersUsedForOther = state.gaiaformers.usedForOther;
  data.tokenModifier = state.tokenModifier;
  data.terraformCostDiscount = state.terraformCostDiscount;
  data.temporaryRange = state.temporaryRange;
  data.temporaryStep = state.temporaryStep;
  data.satellites = state.satellites;
  data.tradeBonus = state.tradeBonus;
  data.tradeDiscount = state.tradeDiscount;
  data.tradeShips = state.tradeShips;
  player.federationCache = null;
  engine.clearAvailableCommands();
}

function conversionCatalogue(
  engine: Engine,
  state: ProjectedConversionState,
  subphase: SubPhase
): { units: AtomicDecisionCandidate[]; aliases: AtomicDecisionCandidate[] } {
  const abundant = cloneState(state);
  abundant.credits = 30;
  abundant.ores = 15;
  abundant.knowledge = 15;
  abundant.qics = 15;
  abundant.power.area1 = 20;
  abundant.power.area2 = 20;
  abundant.power.area3 = 20;
  abundant.gaiaformers.total = abundant.gaiaformers.onBoard + 10;
  abundant.gaiaformers.inGaia = 0;
  abundant.gaiaformers.usedForAsteroid = 0;
  abundant.gaiaformers.usedForOther = 0;
  abundant.gaiaformers.available = 10;
  applyProjectedState(engine, abundant);
  const player = engine.player(engine.playerToMove);
  const offered = sortedCandidates(
    expandInternallySuppliedAtomicCommands(engine, subphase, possibleFreeActions(player)).candidates.filter(
      isConversion
    )
  );
  return {
    units: offered.filter(isUnitConversion),
    aliases: offered.filter((candidate) => !isUnitConversion(candidate)),
  };
}

function sameStepMultiset(left: OrderedConversionPlan, rightSteps: ExecutableConversionStep[]): boolean {
  return (
    left.steps
      .map((step) => step.familyKey)
      .sort()
      .join("\0") ===
    rightSteps
      .map((step) => step.familyKey)
      .sort()
      .join("\0")
  );
}

function addPaymentResource(
  states: Array<{ state: ProjectedConversionState; brainstoneChoice: PowerArea | "discard" | null }>,
  amount: ResourceAmount
): Array<{ state: ProjectedConversionState; brainstoneChoice: PowerArea | "discard" | null }> {
  const result: Array<{ state: ProjectedConversionState; brainstoneChoice: PowerArea | "discard" | null }> = [];
  for (const branch of states) {
    const state = branch.state;
    switch (amount.resource) {
      case Resource.Credit:
      case Resource.Ore:
      case Resource.Knowledge:
      case Resource.Qic:
      case Resource.VictoryPoint: {
        const field = {
          [Resource.Credit]: "credits",
          [Resource.Ore]: "ores",
          [Resource.Knowledge]: "knowledge",
          [Resource.Qic]: "qics",
          [Resource.VictoryPoint]: "victoryPoints",
        }[amount.resource] as "credits" | "ores" | "knowledge" | "qics" | "victoryPoints";
        if (state[field] < amount.amount) {
          continue;
        }
        const paid = cloneState(state);
        paid[field] -= amount.amount;
        result.push({ state: paid, brainstoneChoice: branch.brainstoneChoice });
        break;
      }
      case Resource.ChargePower:
      case Resource.PayPower:
        result.push(...spendPowerBranches(branch, amount.amount));
        break;
      case Resource.GainToken:
        result.push(...moveTokenBranches(branch, amount.amount, null));
        break;
      case Resource.MoveTokenToGaiaArea:
        result.push(...moveTokenBranches(branch, amount.amount, PowerArea.Gaia));
        break;
      case Resource.GainTokenArea3: {
        if (state.power.area3 < amount.amount) {
          continue;
        }
        const paid = cloneState(state);
        paid.power.area3 -= amount.amount;
        result.push({ state: paid, brainstoneChoice: branch.brainstoneChoice });
        break;
      }
      case Resource.MoveTokenFromArea3ToGaia: {
        if (state.power.area3 < amount.amount) {
          continue;
        }
        const paid = cloneState(state);
        paid.power.area3 -= amount.amount;
        paid.power.gaia += amount.amount;
        result.push({ state: paid, brainstoneChoice: branch.brainstoneChoice });
        break;
      }
      case Resource.GaiaFormer: {
        if (state.gaiaformers.available < amount.amount) {
          continue;
        }
        const paid = cloneState(state);
        paid.gaiaformers.inGaia += amount.amount;
        paid.gaiaformers.usedForOther += amount.amount;
        paid.gaiaformers.available -= amount.amount;
        result.push({ state: paid, brainstoneChoice: branch.brainstoneChoice });
        break;
      }
      case Resource.BurnToken: {
        const paid = cloneState(state);
        if (Math.floor((paid.power.area2 + (paid.power.brainstone === PowerArea.Area2 ? 1 : 0)) / 2) < amount.amount) {
          continue;
        }
        let remaining = amount.amount;
        if (paid.power.brainstone === PowerArea.Area2 && remaining > 0) {
          paid.power.brainstone = PowerArea.Area3;
          paid.power.area2 -= 1;
          remaining -= 1;
        }
        paid.power.area2 -= 2 * remaining;
        paid.power.area3 += remaining;
        result.push({ state: paid, brainstoneChoice: branch.brainstoneChoice });
        break;
      }
      default:
        throw new ResourceConversionPlannerError(
          "unsupported-payment-resource",
          `Phase 1.3 cannot project candidate payment resource ${amount.resource}`
        );
    }
  }
  return deduplicatePaymentBranches(result);
}

function spendPowerBranches(
  branch: { state: ProjectedConversionState; brainstoneChoice: PowerArea | "discard" | null },
  amount: number
): Array<{ state: ProjectedConversionState; brainstoneChoice: PowerArea | "discard" | null }> {
  const state = branch.state;
  const spendable =
    Math.floor(state.power.area3 * state.tokenModifier) + (state.power.brainstone === PowerArea.Area3 ? 3 : 0);
  if (spendable < amount) {
    return [];
  }
  const useChoices: boolean[] = [];
  if (state.power.brainstone !== PowerArea.Area3) {
    useChoices.push(false);
  } else {
    const needBrainstone = state.power.area3 < amount;
    if (needBrainstone) {
      useChoices.push(true);
    } else if (amount < 3) {
      useChoices.push(false);
    } else {
      useChoices.push(true, false);
    }
  }
  return useChoices.flatMap((useBrainstone) => {
    const paid = cloneState(state);
    let remaining = amount;
    let choice = branch.brainstoneChoice;
    if (useBrainstone) {
      paid.power.brainstone = PowerArea.Area1;
      remaining = Math.max(remaining - 3, 0);
      choice = PowerArea.Area1;
    } else if (state.power.brainstone === PowerArea.Area3 && amount >= 3) {
      choice = PowerArea.Area3;
    }
    const tokens = Math.ceil(remaining / paid.tokenModifier);
    if (tokens > paid.power.area3) {
      return [];
    }
    paid.power.area3 -= tokens;
    paid.power.area1 += tokens;
    return [{ state: paid, brainstoneChoice: choice }];
  });
}

function tokensBelow(state: ProjectedConversionState, area: PowerArea): number {
  switch (area) {
    case PowerArea.Area1:
      return state.power.area1;
    case PowerArea.Area2:
      return state.power.area1 + state.power.area2;
    case PowerArea.Area3:
      return state.power.area1 + state.power.area2 + state.power.area3;
    case PowerArea.Gaia:
      return state.power.area1 + state.power.area2 + state.power.area3 + state.power.gaia;
  }
}

function moveTokenBranches(
  branch: { state: ProjectedConversionState; brainstoneChoice: PowerArea | "discard" | null },
  amount: number,
  target: PowerArea.Gaia | null
): Array<{ state: ProjectedConversionState; brainstoneChoice: PowerArea | "discard" | null }> {
  const state = branch.state;
  const brainstoneInPlay = state.power.brainstone !== null && state.power.brainstone !== PowerArea.Gaia;
  const normal = state.power.area1 + state.power.area2 + state.power.area3;
  const discardable = normal + (brainstoneInPlay ? 1 : 0);
  if (discardable < amount) {
    return [];
  }
  let choices: boolean[] = [false];
  if (brainstoneInPlay) {
    if (discardable === amount) {
      choices = [true];
    } else if (target || tokensBelow(state, state.power.brainstone as PowerArea) < amount) {
      choices = [true, false];
    }
  }
  return choices.flatMap((moveBrainstone) => {
    const paid = cloneState(state);
    let remaining = amount;
    let choice = branch.brainstoneChoice;
    if (moveBrainstone) {
      paid.power.brainstone = target;
      remaining -= 1;
      choice = target ?? "discard";
    } else if (choices.length > 1) {
      choice = state.power.brainstone;
    }
    const a1 = Math.min(remaining, paid.power.area1);
    const a2 = Math.min(remaining - a1, paid.power.area2);
    const a3 = Math.min(remaining - a1 - a2, paid.power.area3);
    if (a1 + a2 + a3 !== remaining) {
      return [];
    }
    paid.power.area1 -= a1;
    paid.power.area2 -= a2;
    paid.power.area3 -= a3;
    if (target === PowerArea.Gaia) {
      paid.power.gaia += a1 + a2 + a3;
    }
    return [{ state: paid, brainstoneChoice: choice }];
  });
}

function deduplicatePaymentBranches<T extends { state: ProjectedConversionState }>(
  branches: T[],
  stateKey: typeof canonicalConversionStateKey = canonicalConversionStateKey
): T[] {
  const seen = new Map<string, T>();
  for (const branch of branches) {
    const key = stateKey(branch.state);
    if (!seen.has(key)) {
      seen.set(key, branch);
    }
  }
  return Array.from(seen.values()).sort((a, b) => stateKey(a.state).localeCompare(stateKey(b.state)));
}

function addConversionReward(
  branch: { state: ProjectedConversionState; brainstoneChoice: PowerArea | "discard" | null },
  reward: ResourceAmount
): { state: ProjectedConversionState; brainstoneChoice: PowerArea | "discard" | null } {
  const state = cloneState(branch.state);
  switch (reward.resource) {
    case Resource.Credit:
      state.credits = Math.min(30, state.credits + reward.amount);
      break;
    case Resource.Ore:
      state.ores = Math.min(15, state.ores + reward.amount);
      break;
    case Resource.Knowledge:
      state.knowledge = Math.min(15, state.knowledge + reward.amount);
      break;
    case Resource.Qic:
      state.qics += reward.amount;
      break;
    case Resource.VictoryPoint:
      state.victoryPoints += reward.amount;
      break;
    case Resource.GainToken:
      state.power.area1 += reward.amount;
      break;
    case Resource.GainTokenArea3:
      state.power.area3 += reward.amount;
      break;
    case Resource.GainTokenGaiaArea:
      state.power.gaia += reward.amount;
      break;
    case Resource.MoveTokenFromGaiaAreaToArea1:
      if (state.power.gaia < reward.amount) {
        throw new ResourceConversionPlannerError(
          "invalid-plan",
          `Conversion reward moves ${reward.amount} unavailable Gaia-area tokens`
        );
      }
      state.power.gaia -= reward.amount;
      state.power.area1 += reward.amount;
      break;
    case Resource.GaiaFormer:
      state.gaiaformers.total += reward.amount;
      state.gaiaformers.available += reward.amount;
      break;
    default:
      throw new ResourceConversionPlannerError(
        "unsupported-payment-resource",
        `Phase 1.3 cannot project conversion reward resource ${reward.resource}`
      );
  }
  return { state, brainstoneChoice: branch.brainstoneChoice };
}

function conversionTransitions(
  state: ProjectedConversionState,
  candidate: AtomicDecisionCandidate,
  stateKey: typeof canonicalConversionStateKey = canonicalConversionStateKey
): Array<{
  state: ProjectedConversionState;
  stepFragments: string[];
}> {
  let branches: Array<{ state: ProjectedConversionState; brainstoneChoice: PowerArea | "discard" | null }> = [
    { state: cloneState(state), brainstoneChoice: null },
  ];
  for (const cost of candidate.resources.cost) {
    branches = addPaymentResource(branches, cost);
  }
  for (const reward of candidate.resources.reward) {
    branches = branches.map((branch) => addConversionReward(branch, reward));
  }
  return deduplicatePaymentBranches(branches, stateKey).map((branch) => ({
    state: branch.state,
    stepFragments: [
      candidate.moveFragment,
      ...(branch.brainstoneChoice ? [`${Command.BrainStone} ${branch.brainstoneChoice}`] : []),
    ],
  }));
}

function paymentResults(
  candidate: AtomicDecisionCandidate,
  plan: OrderedConversionPlan,
  state: ProjectedConversionState,
  stateKey: typeof canonicalConversionStateKey = canonicalConversionStateKey
): PaymentResult[] {
  let branches: Array<{ state: ProjectedConversionState; brainstoneChoice: PowerArea | "discard" | null }> = [
    { state: cloneState(state), brainstoneChoice: null },
  ];
  for (const cost of candidate.resources.cost) {
    branches = addPaymentResource(branches, cost);
  }
  return branches.map((branch) => {
    const postPaymentStateKey = stateKey(branch.state);
    const brainstoneFragment = branch.brainstoneChoice ? [`${Command.BrainStone} ${branch.brainstoneChoice}`] : [];
    return {
      candidateKey: candidate.key,
      conversionPlanKey: plan.key,
      affordable: true,
      cost: candidate.resources.cost,
      postPaymentState: branch.state,
      postPaymentStateKey,
      brainstoneChoice: branch.brainstoneChoice,
      moveFragments: [...plan.moveFragments, candidate.moveFragment, ...brainstoneFragment],
    };
  });
}

function paymentFrontier(
  payments: PaymentResult[],
  dominates: typeof conversionStateDominates = conversionStateDominates,
  materialFor: (state: ProjectedConversionState) => DominanceMaterial = dominanceMaterial,
  translationPreserving = false
): ParetoFrontierResult<PaymentResult> {
  const byState = new Map<string, PaymentResult>();
  const fragmentKeys = new Map<string, string>();
  for (const payment of payments) {
    const fragmentKey = payment.moveFragments.join(". ");
    const existingKey = fragmentKeys.get(payment.postPaymentStateKey);
    if (existingKey === undefined || fragmentKey.localeCompare(existingKey) < 0) {
      byState.set(payment.postPaymentStateKey, payment);
      fragmentKeys.set(payment.postPaymentStateKey, fragmentKey);
    }
  }
  const unique = Array.from(byState.values()).sort((a, b) =>
    a.postPaymentStateKey.localeCompare(b.postPaymentStateKey)
  );
  if (translationPreserving) {
    return { frontier: unique, dominated: [] };
  }
  let frontier: PaymentResult[] = [];
  const index = new DominanceFrontierIndex<PaymentResult>(materialFor, dominates);
  const dominated: ParetoFrontierResult<PaymentResult>["dominated"] = [];
  for (const payment of unique) {
    const dominator = index.findDominator(payment.postPaymentState);
    if (dominator) {
      dominated.push({
        dominatedKey: payment.postPaymentStateKey,
        dominatingKey: dominator.postPaymentStateKey,
      });
    } else {
      const newlyDominated = index.findDominated(payment.postPaymentState);
      for (const other of newlyDominated) {
        dominated.push({
          dominatedKey: other.postPaymentStateKey,
          dominatingKey: payment.postPaymentStateKey,
        });
      }
      const removed = new Set(newlyDominated.map((entry) => entry.postPaymentStateKey));
      for (const other of newlyDominated) {
        index.remove(other);
      }
      frontier = frontier.filter((entry) => !removed.has(entry.postPaymentStateKey));
      frontier.push(payment);
      index.add(payment, payment.postPaymentState);
    }
  }
  frontier.sort((a, b) => a.postPaymentStateKey.localeCompare(b.postPaymentStateKey));
  dominated.sort(
    (a, b) => a.dominatedKey.localeCompare(b.dominatedKey) || a.dominatingKey.localeCompare(b.dominatingKey)
  );
  return { frontier, dominated };
}

function hasTranslationPreservingPayment(candidate: AtomicDecisionCandidate): boolean {
  const translationResources = new Set<Resource>([
    Resource.Credit,
    Resource.Ore,
    Resource.Knowledge,
    Resource.Qic,
    Resource.VictoryPoint,
  ]);
  return candidate.resources.cost.every((amount) => translationResources.has(amount.resource));
}

function assertSupportedSource(source: Engine): void {
  projectCanonicalState(source);
  if (source.phase !== Phase.RoundMove || source.subPhase !== SubPhase.BeforeMove || !source.newTurn) {
    throw new ResourceConversionPlannerError(
      "unsupported-state",
      "Phase 1.3 accepts only committed RoundMove/BeforeMove source states"
    );
  }
  if ((source.options.factionVariant ?? "standard") !== "standard") {
    throw new ResourceConversionPlannerError(
      "unsupported-state",
      `Phase 1.3 supports only factionVariant=standard, got ${source.options.factionVariant}`
    );
  }
}

function planForTiming(
  source: Engine,
  baseFragments: string[],
  timing: ConversionTimingContext,
  options: ResourceConversionPlannerOptions
): ResourceConversionPlanningResult {
  const startedAt = performance.now();
  const counters: ResourceConversionPlannerCounters = {
    statesGenerated: 0,
    statesAccepted: 0,
    activeFrontierSize: 0,
    maximumActiveFrontierSize: 0,
    transitionsConsidered: 0,
    exactStateMerges: 0,
    paretoPrunes: 0,
    lossyCyclePrunes: 0,
    dominanceComparisons: 0,
    exactContextComputations: 0,
    stateKeyComputations: 0,
    planKeyComputations: 0,
    resourceCycleGraphReconstructions: 0,
    candidateStatesExpanded: 0,
    paymentResultsGenerated: 0,
  };
  const stateKeyCache = new WeakMap<ProjectedConversionState, CanonicalConversionStateKey>();
  const computeStateKey: typeof canonicalConversionStateKey = (state) => {
    const cached = stateKeyCache.get(state);
    if (cached) {
      return cached;
    }
    counters.stateKeyComputations += 1;
    const key = canonicalConversionStateKey(state);
    stateKeyCache.set(state, key);
    return key;
  };
  const computePlanKey: typeof canonicalConversionPlanKey = (plan) => {
    counters.planKeyComputations += 1;
    return canonicalConversionPlanKey(plan);
  };
  const dominanceCache = new WeakMap<ProjectedConversionState, DominanceMaterial>();
  const materialFor = (state: ProjectedConversionState): DominanceMaterial => {
    const cached = dominanceCache.get(state);
    if (cached) {
      return cached;
    }
    counters.exactContextComputations += 1;
    const material = dominanceMaterial(state);
    dominanceCache.set(state, material);
    return material;
  };
  const dominates: typeof conversionStateDominates = (left, right) => {
    counters.dominanceComparisons += 1;
    return materialDominates(materialFor(left), materialFor(right));
  };
  const progressEvery = options.progressEveryTransitions ?? 100_000;
  if (!Number.isInteger(progressEvery) || progressEvery <= 0) {
    throw new ResourceConversionPlannerError(
      "unsupported-state",
      `progressEveryTransitions must be a positive integer, got ${progressEvery}`
    );
  }
  const sourceHash = canonicalStateHash(source);
  const actor = source.playerToMove;
  const rights = conversionRights(source, actor);
  const contextKey = stateContextKey(sourceHash, timing);
  const rootEngine = replayPrefix(source, baseFragments);
  const rootState = projectState(rootEngine, contextKey, timing, rights);
  const rootStateKey = computeStateKey(rootState);
  const rootPlan = emptyPlan(rootState, rootStateKey, computePlanKey);
  const root: ReachabilityNode = {
    state: rootState,
    stateKey: rootStateKey,
    plan: rootPlan,
    lineageStates: [rootState],
  };
  const nodes = new Map<CanonicalConversionStateKey, ReachabilityNode>([[root.stateKey, root]]);
  const queue: ReachabilityNode[] = [root];
  let activeFrontier: ReachabilityNode[] = [root];
  const activeStateKeys = new Set<CanonicalConversionStateKey>([root.stateKey]);
  const frontierIndex = new DominanceFrontierIndex<ReachabilityNode>(materialFor, dominates);
  frontierIndex.add(root, root.state);
  const availabilityEngine = Engine.fromData(JSON.parse(JSON.stringify(rootEngine)));
  const catalogue = conversionCatalogue(availabilityEngine, rootState, timing.subphase);
  const diagnostics: ConversionPlannerDiagnostics = {
    merges: [],
    lossyCycles: [],
    aliases: [],
    paretoPruned: [],
    unavailableEffects: [],
  };
  for (const alias of catalogue.aliases) {
    const unit =
      alias.command === Command.BurnPower
        ? catalogue.units.find((candidate) => candidate.command === Command.BurnPower)
        : catalogue.units.find(
            (candidate) => candidate.command === Command.Spend && normalizedFlow(candidate) === normalizedFlow(alias)
          );
    if (!unit) {
      throw new ResourceConversionPlannerError(
        "invalid-plan",
        `Ranged conversion ${alias.moveFragment} has no executable unit conversion`
      );
    }
    diagnostics.aliases.push({
      moveFragment: alias.moveFragment,
      canonicalUnitFragment: unit.moveFragment,
      reason: "ranged-repeat-canonicalized",
    });
  }
  const candidateFilter = options.mainCandidates
    ? new Map(options.mainCandidates.map((candidate) => [candidate.key, candidate]))
    : null;
  let largestConversionDepth = 0;
  counters.statesAccepted = 1;
  counters.activeFrontierSize = 1;
  counters.maximumActiveFrontierSize = 1;
  const setupFinishedAt = performance.now();
  const emitProgress = () => {
    if (!options.onProgress) {
      return;
    }
    counters.activeFrontierSize = activeFrontier.length;
    options.onProgress({
      counters: { ...counters },
      largestConversionDepth,
      elapsedMs: performance.now() - startedAt,
    });
  };

  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const node = queue[queueIndex];
    queueIndex += 1;
    if (!activeStateKeys.has(node.stateKey)) {
      continue;
    }
    const unitConversions = catalogue.units;
    for (const conversion of unitConversions) {
      counters.transitionsConsidered += 1;
      if (conversion.resources.effects.length > 0) {
        diagnostics.unavailableEffects.push(...conversion.resources.effects);
      }
      const resolvedNodes = conversionTransitions(node.state, conversion, computeStateKey);
      counters.statesGenerated += resolvedNodes.length;
      for (const resolved of resolvedNodes) {
        const stepFragments = resolved.stepFragments;
        const state = resolved.state;
        const stateKey = computeStateKey(state);
        const step: ExecutableConversionStep = {
          kind: conversion.command === Command.BurnPower ? "burn" : "spend",
          familyKey: conversionFamilyKey(conversion),
          cost: conversion.resources.cost,
          reward: conversion.resources.reward,
          effects: conversion.resources.effects,
          moveFragments: stepFragments,
          beforeStateKey: node.stateKey,
          afterStateKey: stateKey,
          changesPowerBowls: changesPower(node.state, state),
        };
        const steps = [...node.plan.steps, step];
        const moveFragments = [...node.plan.moveFragments, ...stepFragments];
        counters.resourceCycleGraphReconstructions += 1;
        const cycle = resourceCycle(steps);
        const dominatedAncestor =
          cycle.length > 0 ? node.lineageStates.find((ancestor) => dominates(ancestor, state)) : undefined;
        if (dominatedAncestor) {
          counters.lossyCyclePrunes += 1;
          diagnostics.lossyCycles.push({
            ancestorStateKey: computeStateKey(dominatedAncestor),
            discardedStateKey: stateKey,
            moveFragments,
            resourceCycle: cycle,
            reason: "componentwise-dominated-cycle",
          });
          continue;
        }
        const dominatingNode = frontierIndex.findDominator(state);
        if (dominatingNode) {
          counters.paretoPrunes += 1;
          diagnostics.paretoPruned.push({
            discardedStateKey: stateKey,
            dominatingStateKey: dominatingNode.stateKey,
            moveFragments,
            reason: "componentwise-dominated-transition",
          });
          continue;
        }
        const existing = nodes.get(stateKey);
        if (existing) {
          counters.exactStateMerges += 1;
          diagnostics.merges.push({
            destinationStateKey: stateKey,
            keptPlanKey: existing.plan.key,
            keptMoveFragments: existing.plan.moveFragments,
            mergedMoveFragments: moveFragments,
            reason: sameStepMultiset(existing.plan, steps) ? "commutative-order" : "equivalent-executable-sequence",
          });
          continue;
        }
        const newlyDominated = frontierIndex.findDominated(state);
        if (newlyDominated.length > 0) {
          counters.paretoPrunes += newlyDominated.length;
          for (const dominated of newlyDominated) {
            activeStateKeys.delete(dominated.stateKey);
            frontierIndex.remove(dominated);
            diagnostics.paretoPruned.push({
              discardedStateKey: dominated.stateKey,
              dominatingStateKey: stateKey,
              moveFragments: dominated.plan.moveFragments,
              reason: "componentwise-dominated-transition",
            });
          }
          const dominatedKeys = new Set(newlyDominated.map((entry) => entry.stateKey));
          activeFrontier = activeFrontier.filter((entry) => !dominatedKeys.has(entry.stateKey));
        }
        const plan: OrderedConversionPlan = {
          schemaVersion: CONVERSION_PLAN_SCHEMA,
          key: computePlanKey({
            sourceStateKey: root.stateKey,
            destinationStateKey: stateKey,
            timing,
          }),
          timing,
          sourceStateKey: root.stateKey,
          destinationStateKey: stateKey,
          steps,
          moveFragments,
        };
        const child: ReachabilityNode = {
          state,
          stateKey,
          plan,
          lineageStates: [...node.lineageStates, state],
        };
        nodes.set(stateKey, child);
        activeFrontier.push(child);
        frontierIndex.add(child, child.state);
        activeStateKeys.add(stateKey);
        queue.push(child);
        counters.statesAccepted += 1;
        counters.activeFrontierSize = activeFrontier.length;
        counters.maximumActiveFrontierSize = Math.max(counters.maximumActiveFrontierSize, activeFrontier.length);
        largestConversionDepth = Math.max(largestConversionDepth, steps.length);
      }
      if (counters.transitionsConsidered % progressEvery === 0) {
        emitProgress();
      }
    }
  }

  const reachabilityFinishedAt = performance.now();

  diagnostics.unavailableEffects = Array.from(new Set(diagnostics.unavailableEffects)).sort();
  diagnostics.aliases = Array.from(
    new Map(
      diagnostics.aliases.map((entry) => [`${entry.moveFragment}\0${entry.canonicalUnitFragment}`, entry])
    ).values()
  ).sort((a, b) => a.moveFragment.localeCompare(b.moveFragment));
  diagnostics.merges.sort(
    (a, b) =>
      a.destinationStateKey.localeCompare(b.destinationStateKey) ||
      a.mergedMoveFragments.join(". ").localeCompare(b.mergedMoveFragments.join(". "))
  );
  diagnostics.lossyCycles.sort(
    (a, b) =>
      a.discardedStateKey.localeCompare(b.discardedStateKey) ||
      a.moveFragments.join(". ").localeCompare(b.moveFragments.join(". "))
  );
  diagnostics.paretoPruned.sort(
    (a, b) =>
      a.discardedStateKey.localeCompare(b.discardedStateKey) ||
      a.moveFragments.join(". ").localeCompare(b.moveFragments.join(". "))
  );
  const reachable = Array.from(nodes.values()).sort((a, b) => a.stateKey.localeCompare(b.stateKey));
  const reachableStateFrontier: ParetoFrontierResult<ProjectedConversionState> = {
    frontier: activeFrontier
      .map((entry) => entry.state)
      .sort((a, b) => computeStateKey(a).localeCompare(computeStateKey(b))),
    dominated: Array.from(
      new Map(
        diagnostics.paretoPruned.map((entry) => [
          `${entry.discardedStateKey}\0${entry.dominatingStateKey}`,
          { dominatedKey: entry.discardedStateKey, dominatingKey: entry.dominatingStateKey },
        ])
      ).values()
    ).sort((a, b) => a.dominatedKey.localeCompare(b.dominatedKey) || a.dominatingKey.localeCompare(b.dominatingKey)),
  };
  const frontierKeys = new Set(reachableStateFrontier.frontier.map((state) => computeStateKey(state)));
  const resultAssemblyFinishedAt = performance.now();
  const candidates = new Map<string, CandidateAccumulator>();
  for (const node of reachable.filter((entry) => frontierKeys.has(entry.stateKey))) {
    counters.candidateStatesExpanded += 1;
    applyProjectedState(availabilityEngine, node.state);
    // Custom (hand-picked hex set) federations are deliberately out of scope (owner decision
    // 2026-07-14): the AI only ever forms one of the engine's enumerated federations, the ones
    // with a real satellite path. A wallet change can flip the heuristic into its custom-only
    // fallback (`federations: []`), which has no enumerable geometry and which Phase 1.2 rejects;
    // that command is dropped here so the run does not crash, and nothing enumerable is lost
    // because a custom-only offer means the heuristic found no satellite-path federation at this
    // wallet at all. States without the fallback take the byte-identical Phase 1.3 path.
    const offeredCommands =
      availabilityEngine.availableCommands ?? availabilityEngine.generateAvailableCommands(timing.subphase);
    const customOnlyFederations = offeredCommands.filter(
      (command) => command.name === Command.FormFederation && command.data.federations.length === 0
    );
    const expansion =
      customOnlyFederations.length === 0
        ? expandInternallyReplayedAtomicDecision(availabilityEngine, timing.subphase)
        : expandInternallySuppliedAtomicCommands(
            availabilityEngine,
            timing.subphase,
            offeredCommands.filter((command) => !customOnlyFederations.includes(command))
          );
    for (const candidate of sortedCandidates(expansion.candidates).filter(isMainCandidate)) {
      if (candidateFilter && !candidateFilter.has(candidate.key)) {
        continue;
      }
      const canonicalCandidate = candidateFilter?.get(candidate.key) ?? candidate;
      const accumulator = candidates.get(candidate.key) ?? {
        candidate: canonicalCandidate,
        plans: new Map<string, OrderedConversionPlan>(),
        payments: [],
      };
      accumulator.plans.set(node.plan.key, node.plan);
      const payments = paymentResults(canonicalCandidate, node.plan, node.state, computeStateKey);
      counters.paymentResultsGenerated += payments.length;
      accumulator.payments.push(...payments);
      candidates.set(candidate.key, accumulator);
    }
  }
  const candidateConstructionFinishedAt = performance.now();
  const paymentFrontiersStartedAt = performance.now();
  const candidateResults: CandidateConversionPlans[] = Array.from(candidates.values())
    .map((entry) => ({
      candidate: entry.candidate,
      plans: Array.from(entry.plans.values()).sort((a, b) => a.key.localeCompare(b.key)),
      payments: paymentFrontier(
        entry.payments,
        dominates,
        materialFor,
        hasTranslationPreservingPayment(entry.candidate)
      ),
    }))
    .sort((a, b) => a.candidate.key.localeCompare(b.candidate.key));
  const finishedAt = performance.now();
  counters.activeFrontierSize = activeFrontier.length;
  return {
    sourceStateKey: root.stateKey,
    timing,
    reachableStates: reachable.map((entry) => entry.state),
    reachablePlans: reachable.map((entry) => entry.plan),
    stateFrontier: reachableStateFrontier,
    candidates: candidateResults,
    diagnostics,
    largestConversionDepth,
    profile: {
      counters,
      timings: {
        setupMs: setupFinishedAt - startedAt,
        reachabilityMs: reachabilityFinishedAt - setupFinishedAt,
        resultAssemblyMs: resultAssemblyFinishedAt - reachabilityFinishedAt,
        candidateConstructionMs: candidateConstructionFinishedAt - resultAssemblyFinishedAt,
        paymentFrontiersMs: finishedAt - paymentFrontiersStartedAt,
        totalMs: finishedAt - startedAt,
      },
    },
  };
}

/** Enumerate the exact, finite conversion graph to a semantic fixpoint. No depth/time cap exists. */
export function planResourceConversions(
  source: Engine,
  options: ResourceConversionPlannerOptions = {}
): ResourceConversionPlanningResult {
  assertSupportedSource(source);
  return planForTiming(
    source,
    [],
    { kind: "pre-action", phase: Phase.RoundMove, subphase: SubPhase.BeforeMove },
    options
  );
}

function leechCapacity(state: ProjectedConversionState): number {
  const brainstone = state.power.brainstone;
  const brainstoneCapacity = brainstone === PowerArea.Area1 ? 2 : brainstone === PowerArea.Area2 ? 1 : 0;
  return state.power.area1 * 2 + state.power.area2 + brainstoneCapacity;
}

function resolveMainActionPrefixes(
  source: Engine,
  conversionPlan: OrderedConversionPlan,
  candidate: AtomicDecisionCandidate
): string[][] {
  const prefix = [...conversionPlan.moveFragments, candidate.moveFragment];
  const expansion = expandAtomicDecisions(source, {
    priorMoveFragments: prefix,
    subphase: SubPhase.AfterMove,
  });
  const brainstone = sortedCandidates(expansion.candidates.filter((entry) => entry.command === Command.BrainStone));
  if (brainstone.length === 0) {
    return [prefix];
  }
  if (expansion.candidates.some((entry) => entry.command !== Command.BrainStone)) {
    throw new ResourceConversionPlannerError(
      "invalid-plan",
      `Main action ${candidate.key} produced BrainStone alongside unrelated commands`
    );
  }
  return brainstone.map((choice) => [...prefix, choice.moveFragment]);
}

/**
 * Models only the internally produced AfterMove window. Phase 1.4 remains responsible for forced
 * follow-ups, complete committed lines, `end`, and opponent leech traversal.
 */
export function planAfterActionConversions(
  source: Engine,
  mainCandidate: AtomicDecisionCandidate,
  conversionPlan?: OrderedConversionPlan
): AfterActionConversionResult {
  assertSupportedSource(source);
  if (mainCandidate.command === Command.Pass) {
    return {
      status: "not-applicable",
      reason: "Passing has no AfterMove free-conversion window",
      mainCandidate,
      retained: [],
      deferred: [],
      planning: null,
    };
  }
  const pre =
    conversionPlan ??
    emptyPlan(
      projectState(
        source,
        stateContextKey(canonicalStateHash(source), {
          kind: "pre-action",
          phase: Phase.RoundMove,
          subphase: SubPhase.BeforeMove,
        }),
        { kind: "pre-action", phase: Phase.RoundMove, subphase: SubPhase.BeforeMove },
        conversionRights(source, source.playerToMove)
      )
    );
  const prefixes = resolveMainActionPrefixes(source, pre, mainCandidate);
  if (prefixes.length !== 1) {
    return {
      status: "not-applicable",
      reason: "Multiple main-payment BrainStone branches must be selected by the future Phase 1.4 line builder",
      mainCandidate,
      retained: [],
      deferred: [],
      planning: null,
    };
  }
  return planNarrowAfterActionWindow(source, mainCandidate, prefixes[0]);
}

/**
 * Phase 1.4 line-builder variant of `planAfterActionConversions`: the caller supplies the exact
 * executable prefix it has already validated from the committed source (an optional conversion
 * plan, exactly one non-pass main action, any main-payment brainstone choice, and every already
 * chosen forced/meaningful follow-up). The retained/deferred semantics are byte-identical to
 * `planAfterActionConversions`; only prefix resolution differs, so multi-branch main-payment
 * brainstone lines no longer have to be rejected as "not-applicable".
 */
export function planAfterActionConversionsForLine(
  source: Engine,
  mainCandidate: AtomicDecisionCandidate,
  lineFragments: readonly string[]
): AfterActionConversionResult {
  assertSupportedSource(source);
  if (mainCandidate.command === Command.Pass) {
    return {
      status: "not-applicable",
      reason: "Passing has no AfterMove free-conversion window",
      mainCandidate,
      retained: [],
      deferred: [],
      planning: null,
    };
  }
  return planNarrowAfterActionWindow(source, mainCandidate, [...lineFragments]);
}

function planNarrowAfterActionWindow(
  source: Engine,
  mainCandidate: AtomicDecisionCandidate,
  prefix: string[]
): AfterActionConversionResult {
  const expansion = expandAtomicDecisions(source, {
    priorMoveFragments: prefix,
    subphase: SubPhase.AfterMove,
  });
  const commands = new Set(expansion.candidates.map((candidate) => candidate.command));
  const allowed = new Set<Command>([Command.Spend, Command.BurnPower, Command.EndTurn]);
  if (!commands.has(Command.EndTurn) || Array.from(commands).some((command) => !allowed.has(command))) {
    return {
      status: "not-applicable",
      reason: "Main action produced a forced follow-up outside Phase 1.3's narrow AfterMove boundary",
      mainCandidate,
      retained: [],
      deferred: [],
      planning: null,
    };
  }
  const timing: ConversionTimingContext = {
    kind: "post-action-before-leech",
    phase: Phase.RoundMove,
    subphase: SubPhase.AfterMove,
    mainCandidateKey: mainCandidate.key,
    nextTurnDeferralProven: true,
  };
  const planning = planForTiming(source, prefix, timing, {});
  const root = planning.reachableStates.find(
    (state) => canonicalConversionStateKey(state) === planning.sourceStateKey
  ) as ProjectedConversionState;
  const before = leechCapacity(root);
  const retained: AfterActionConversionResult["retained"] = [];
  const deferred: AfterActionConversionResult["deferred"] = [];
  for (const plan of planning.reachablePlans) {
    if (plan.steps.length === 0) {
      retained.push({ plan, leechCapacityBefore: before, leechCapacityAfter: before, reason: "wait" });
      continue;
    }
    const destination = planning.reachableStates.find(
      (state) => canonicalConversionStateKey(state) === plan.destinationStateKey
    ) as ProjectedConversionState;
    const after = leechCapacity(destination);
    if (!timing.nextTurnDeferralProven) {
      retained.push({
        plan,
        leechCapacityBefore: before,
        leechCapacityAfter: after,
        reason: "deferral-proof-unavailable",
      });
      continue;
    }
    const lastBowlIndex = plan.steps.reduce((index, step, current) => (step.changesPowerBowls ? current : index), -1);
    if (lastBowlIndex >= 0 && after > before) {
      const trailing = plan.steps.slice(lastBowlIndex + 1);
      if (trailing.length > 0) {
        deferred.push({
          planKey: plan.key,
          moveFragments: trailing.flatMap((step) => step.moveFragments),
          reason: "trailing-non-bowl-conversions-deferred-after-capacity-opening",
        });
      }
      const retainedSteps = plan.steps.slice(0, lastBowlIndex + 1);
      const retainedFragments = retainedSteps.flatMap((step) => step.moveFragments);
      const retainedDestination = retainedSteps[retainedSteps.length - 1].afterStateKey;
      const retainedPlan: OrderedConversionPlan = {
        schemaVersion: CONVERSION_PLAN_SCHEMA,
        sourceStateKey: planning.sourceStateKey,
        destinationStateKey: retainedDestination,
        timing,
        steps: retainedSteps,
        moveFragments: retainedFragments,
        key: canonicalConversionPlanKey({
          sourceStateKey: planning.sourceStateKey,
          destinationStateKey: retainedDestination,
          timing,
        }),
      };
      if (!retained.some((entry) => entry.plan.key === retainedPlan.key)) {
        const retainedState = planning.reachableStates.find(
          (state) => canonicalConversionStateKey(state) === retainedDestination
        ) as ProjectedConversionState;
        retained.push({
          plan: retainedPlan,
          leechCapacityBefore: before,
          leechCapacityAfter: leechCapacity(retainedState),
          reason: "opens-power-bowl-capacity-before-leech",
        });
      }
    } else {
      deferred.push({
        planKey: plan.key,
        moveFragments: plan.moveFragments,
        reason: plan.steps.some((step) => step.changesPowerBowls)
          ? "power-bowl-change-does-not-increase-leech-capacity"
          : "ordinary-resources-unobservable-before-next-before-move",
      });
    }
  }
  retained.sort((a, b) => a.plan.key.localeCompare(b.plan.key));
  deferred.sort((a, b) => a.planKey.localeCompare(b.planKey));
  return {
    status: "planned",
    reason: null,
    mainCandidate,
    retained,
    deferred,
    planning,
  };
}
