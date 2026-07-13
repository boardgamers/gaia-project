import { createHash } from "crypto";
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
      available:
        data.gaiaformers -
        data.gaiaformersInGaia -
        onBoard -
        data.gaiaformersUsedForAsteroid,
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

function emptyPlan(state: ProjectedConversionState): OrderedConversionPlan {
  const stateKey = canonicalConversionStateKey(state);
  return {
    schemaVersion: CONVERSION_PLAN_SCHEMA,
    key: canonicalConversionPlanKey({ sourceStateKey: stateKey, destinationStateKey: stateKey, timing: state.timing }),
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

/** Strict, weight-free dominance under one board/action/timing context. */
export function conversionStateDominates(
  left: ProjectedConversionState,
  right: ProjectedConversionState
): boolean {
  if (stableCandidateJson(exactDimensions(left)) !== stableCandidateJson(exactDimensions(right))) {
    return false;
  }
  const pairs: Array<[number, number]> = [
    [left.credits, right.credits],
    [left.ores, right.ores],
    [left.knowledge, right.knowledge],
    [left.qics, right.qics],
    [left.victoryPoints, right.victoryPoints],
    [left.power.area1, right.power.area1],
    [left.power.area2, right.power.area2],
    [left.power.area3, right.power.area3],
    [left.power.gaia, right.power.gaia],
    [left.gaiaformers.available, right.gaiaformers.available],
  ];
  return pairs.every(([a, b]) => a >= b) && pairs.some(([a, b]) => a > b);
}

function isConversion(candidate: AtomicDecisionCandidate): boolean {
  return candidate.command === Command.Spend || candidate.command === Command.BurnPower;
}

function isMainCandidate(candidate: AtomicDecisionCandidate): boolean {
  return ![
    Command.Spend,
    Command.BurnPower,
    Command.BrainStone,
    Command.EndTurn,
  ].includes(candidate.command);
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
  return [...candidates].sort(
    (a, b) => a.moveFragment.localeCompare(b.moveFragment) || a.key.localeCompare(b.key)
  );
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
    expandInternallySuppliedAtomicCommands(
      engine,
      subphase,
      possibleFreeActions(player)
    ).candidates.filter(isConversion)
  );
  return {
    units: offered.filter(isUnitConversion),
    aliases: offered.filter((candidate) => !isUnitConversion(candidate)),
  };
}

function sameStepMultiset(left: OrderedConversionPlan, rightSteps: ExecutableConversionStep[]): boolean {
  return (
    left.steps.map((step) => step.familyKey).sort().join("\0") ===
    rightSteps.map((step) => step.familyKey).sort().join("\0")
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
  const spendable = Math.floor(state.power.area3 * state.tokenModifier) +
    (state.power.brainstone === PowerArea.Area3 ? 3 : 0);
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

function deduplicatePaymentBranches<T extends { state: ProjectedConversionState }>(branches: T[]): T[] {
  const seen = new Map<string, T>();
  for (const branch of branches) {
    const key = canonicalConversionStateKey(branch.state);
    if (!seen.has(key)) {
      seen.set(key, branch);
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    canonicalConversionStateKey(a.state).localeCompare(canonicalConversionStateKey(b.state))
  );
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
  candidate: AtomicDecisionCandidate
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
  return deduplicatePaymentBranches(branches).map((branch) => ({
    state: branch.state,
    stepFragments: [
      candidate.moveFragment,
      ...(branch.brainstoneChoice
        ? [`${Command.BrainStone} ${branch.brainstoneChoice}`]
        : []),
    ],
  }));
}

function paymentResults(candidate: AtomicDecisionCandidate, plan: OrderedConversionPlan, state: ProjectedConversionState): PaymentResult[] {
  let branches: Array<{ state: ProjectedConversionState; brainstoneChoice: PowerArea | "discard" | null }> = [
    { state: cloneState(state), brainstoneChoice: null },
  ];
  for (const cost of candidate.resources.cost) {
    branches = addPaymentResource(branches, cost);
  }
  return branches.map((branch) => {
    const postPaymentStateKey = canonicalConversionStateKey(branch.state);
    const brainstoneFragment = branch.brainstoneChoice
      ? [`${Command.BrainStone} ${branch.brainstoneChoice}`]
      : [];
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

function paymentFrontier(payments: PaymentResult[]): ParetoFrontierResult<PaymentResult> {
  const byState = new Map<string, PaymentResult>();
  for (const payment of [...payments].sort((a, b) =>
    a.moveFragments.join(". ").localeCompare(b.moveFragments.join(". "))
  )) {
    if (!byState.has(payment.postPaymentStateKey)) {
      byState.set(payment.postPaymentStateKey, payment);
    }
  }
  const unique = Array.from(byState.values()).sort((a, b) =>
    a.postPaymentStateKey.localeCompare(b.postPaymentStateKey)
  );
  let frontier: PaymentResult[] = [];
  const dominated: ParetoFrontierResult<PaymentResult>["dominated"] = [];
  for (const payment of unique) {
    const dominator = frontier.find((other) =>
      conversionStateDominates(other.postPaymentState, payment.postPaymentState)
    );
    if (dominator) {
      dominated.push({
        dominatedKey: payment.postPaymentStateKey,
        dominatingKey: dominator.postPaymentStateKey,
      });
    } else {
      const newlyDominated = frontier.filter((other) =>
        conversionStateDominates(payment.postPaymentState, other.postPaymentState)
      );
      for (const other of newlyDominated) {
        dominated.push({
          dominatedKey: other.postPaymentStateKey,
          dominatingKey: payment.postPaymentStateKey,
        });
      }
      const removed = new Set(newlyDominated.map((entry) => entry.postPaymentStateKey));
      frontier = frontier.filter((entry) => !removed.has(entry.postPaymentStateKey));
      frontier.push(payment);
    }
  }
  frontier.sort((a, b) => a.postPaymentStateKey.localeCompare(b.postPaymentStateKey));
  dominated.sort(
    (a, b) => a.dominatedKey.localeCompare(b.dominatedKey) || a.dominatingKey.localeCompare(b.dominatingKey)
  );
  return { frontier, dominated };
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
  const sourceHash = canonicalStateHash(source);
  const actor = source.playerToMove;
  const rights = conversionRights(source, actor);
  const contextKey = stateContextKey(sourceHash, timing);
  const rootEngine = replayPrefix(source, baseFragments);
  const rootState = projectState(rootEngine, contextKey, timing, rights);
  const rootPlan = emptyPlan(rootState);
  const root: ReachabilityNode = {
    state: rootState,
    stateKey: canonicalConversionStateKey(rootState),
    plan: rootPlan,
    lineageStates: [rootState],
  };
  const nodes = new Map<CanonicalConversionStateKey, ReachabilityNode>([[root.stateKey, root]]);
  const queue: ReachabilityNode[] = [root];
  let activeFrontier: ReachabilityNode[] = [root];
  const activeStateKeys = new Set<CanonicalConversionStateKey>([root.stateKey]);
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
    const unit = alias.command === Command.BurnPower
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

  while (queue.length > 0) {
    const node = queue.shift() as ReachabilityNode;
    if (!activeStateKeys.has(node.stateKey)) {
      continue;
    }
    const unitConversions = catalogue.units;
    for (const conversion of unitConversions) {
      if (conversion.resources.effects.length > 0) {
        diagnostics.unavailableEffects.push(...conversion.resources.effects);
      }
      const resolvedNodes = conversionTransitions(node.state, conversion);
      for (const resolved of resolvedNodes) {
        const stepFragments = resolved.stepFragments;
        const state = resolved.state;
        const stateKey = canonicalConversionStateKey(state);
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
        const cycle = resourceCycle(steps);
        const dominatedAncestor = cycle.length > 0
          ? node.lineageStates.find((ancestor) => conversionStateDominates(ancestor, state))
          : undefined;
        if (dominatedAncestor) {
          diagnostics.lossyCycles.push({
            ancestorStateKey: canonicalConversionStateKey(dominatedAncestor),
            discardedStateKey: stateKey,
            moveFragments,
            resourceCycle: cycle,
            reason: "componentwise-dominated-cycle",
          });
          continue;
        }
        const dominatingNode = activeFrontier.find((entry) =>
          conversionStateDominates(entry.state, state)
        );
        if (dominatingNode) {
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
          diagnostics.merges.push({
            destinationStateKey: stateKey,
            keptPlanKey: existing.plan.key,
            keptMoveFragments: existing.plan.moveFragments,
            mergedMoveFragments: moveFragments,
            reason: sameStepMultiset(existing.plan, steps)
              ? "commutative-order"
              : "equivalent-executable-sequence",
          });
          continue;
        }
        const newlyDominated = activeFrontier.filter((entry) =>
          conversionStateDominates(state, entry.state)
        );
        if (newlyDominated.length > 0) {
          for (const dominated of newlyDominated) {
            activeStateKeys.delete(dominated.stateKey);
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
          key: canonicalConversionPlanKey({
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
        activeStateKeys.add(stateKey);
        queue.push(child);
        largestConversionDepth = Math.max(largestConversionDepth, steps.length);
      }
    }
  }

  diagnostics.unavailableEffects = Array.from(new Set(diagnostics.unavailableEffects)).sort();
  diagnostics.aliases = Array.from(
    new Map(
      diagnostics.aliases.map((entry) => [`${entry.moveFragment}\0${entry.canonicalUnitFragment}`, entry])
    ).values()
  ).sort((a, b) => a.moveFragment.localeCompare(b.moveFragment));
  diagnostics.merges.sort((a, b) =>
    a.destinationStateKey.localeCompare(b.destinationStateKey) ||
    a.mergedMoveFragments.join(". ").localeCompare(b.mergedMoveFragments.join(". "))
  );
  diagnostics.lossyCycles.sort((a, b) =>
    a.discardedStateKey.localeCompare(b.discardedStateKey) ||
    a.moveFragments.join(". ").localeCompare(b.moveFragments.join(". "))
  );
  diagnostics.paretoPruned.sort((a, b) =>
    a.discardedStateKey.localeCompare(b.discardedStateKey) ||
    a.moveFragments.join(". ").localeCompare(b.moveFragments.join(". "))
  );
  const reachable = Array.from(nodes.values()).sort((a, b) => a.stateKey.localeCompare(b.stateKey));
  const reachableStateFrontier: ParetoFrontierResult<ProjectedConversionState> = {
    frontier: activeFrontier
      .map((entry) => entry.state)
      .sort((a, b) => canonicalConversionStateKey(a).localeCompare(canonicalConversionStateKey(b))),
    dominated: Array.from(
      new Map(
        diagnostics.paretoPruned.map((entry) => [
          `${entry.discardedStateKey}\0${entry.dominatingStateKey}`,
          { dominatedKey: entry.discardedStateKey, dominatingKey: entry.dominatingStateKey },
        ])
      ).values()
    ).sort(
      (a, b) => a.dominatedKey.localeCompare(b.dominatedKey) || a.dominatingKey.localeCompare(b.dominatingKey)
    ),
  };
  const frontierKeys = new Set(
    reachableStateFrontier.frontier.map((state) => canonicalConversionStateKey(state))
  );
  const candidates = new Map<string, CandidateAccumulator>();
  for (const node of reachable.filter((entry) => frontierKeys.has(entry.stateKey))) {
    applyProjectedState(availabilityEngine, node.state);
    const expansion = expandInternallyReplayedAtomicDecision(availabilityEngine, timing.subphase);
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
      accumulator.payments.push(...paymentResults(canonicalCandidate, node.plan, node.state));
      candidates.set(candidate.key, accumulator);
    }
  }
  const candidateResults: CandidateConversionPlans[] = Array.from(candidates.values())
    .map((entry) => ({
      candidate: entry.candidate,
      plans: Array.from(entry.plans.values()).sort((a, b) => a.key.localeCompare(b.key)),
      payments: paymentFrontier(entry.payments),
    }))
    .sort((a, b) => a.candidate.key.localeCompare(b.candidate.key));
  return {
    sourceStateKey: root.stateKey,
    timing,
    reachableStates: reachable.map((entry) => entry.state),
    reachablePlans: reachable.map((entry) => entry.plan),
    stateFrontier: reachableStateFrontier,
    candidates: candidateResults,
    diagnostics,
    largestConversionDepth,
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
  const brainstoneCapacity =
    brainstone === PowerArea.Area1 ? 2 : brainstone === PowerArea.Area2 ? 1 : 0;
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
  const brainstone = sortedCandidates(
    expansion.candidates.filter((entry) => entry.command === Command.BrainStone)
  );
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
  const pre = conversionPlan ?? emptyPlan(projectState(
    source,
    stateContextKey(canonicalStateHash(source), {
      kind: "pre-action",
      phase: Phase.RoundMove,
      subphase: SubPhase.BeforeMove,
    }),
    { kind: "pre-action", phase: Phase.RoundMove, subphase: SubPhase.BeforeMove },
    conversionRights(source, source.playerToMove)
  ));
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
  const prefix = prefixes[0];
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
    const lastBowlIndex = plan.steps.reduce(
      (index, step, current) => (step.changesPowerBowls ? current : index),
      -1
    );
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
