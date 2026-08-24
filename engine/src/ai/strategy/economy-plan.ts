import Engine from "../../engine";
import { Building, Command, Phase, Player as PlayerEnum, ResearchField, Resource } from "../../enums";
import Player from "../../player";

/**
 * Compatible-income / action-budget economic plan.
 *
 * The diagnosed AI-7 failure is not that the bot cannot afford actions; it is that its economy is
 * *incompatible* with the actions it wants. Retained games end at 15 ore / 4 credits with capped
 * wallets and stranded surplus, because the evaluator values each resource independently and never
 * asks whether the wallet actually covers the *combination* the active plan needs next.
 *
 * This module scores a transition against the reserved cost bundle of the plan's next meaningful
 * action. It rewards moving the wallet toward covering that combination, penalizes overflow past the
 * hard resource caps and stranded surplus that ongoing income keeps feeding, penalizes spending that
 * produces no durable progress, and — crucially — does not punish Pass when every alternative is only
 * such a wasteful conversion. It is inspectable and ablatable; every term is reported.
 */
export const ECONOMY_PLAN_SCHEMA = "gaia-ai-economy-plan/v1" as const;

/** Hard engine storage caps (player-data.ts MAX_CREDIT / MAX_ORE / MAX_KNOWLEDGE). */
const RESOURCE_CAP = { credits: 30, ores: 15, knowledge: 15 } as const;

/** Shared marginal resource valuation, matching evaluation.ts RESOURCE_STOCK_VALUES / tempo.ts. */
const RESOURCE_WEIGHT = { credits: 0.22, ores: 0.8, knowledge: 1, qics: 1.2 } as const;

const RESOURCE_ENUM = {
  credits: Resource.Credit,
  ores: Resource.Ore,
  knowledge: Resource.Knowledge,
  qics: Resource.Qic,
} as const;

/**
 * A modest operating buffer above a plan's declared need. Resources held beyond need + buffer, while
 * income keeps arriving, are treated as stranded surplus rather than useful liquidity.
 */
const STRANDED_BUFFER = { credits: 6, ores: 4, knowledge: 4, qics: 2 } as const;

export interface EconomyReserveBundle {
  credits: number;
  ores: number;
  knowledge: number;
  qics: number;
}

export interface EconomyPlanAssessment {
  schemaVersion: typeof ECONOMY_PLAN_SCHEMA;
  bundle: EconomyReserveBundle;
  /** Fraction of the required resource *combination* the current wallet covers (0..1). */
  bundleCoverage: number;
  /** Fraction of the budget's recurring resource needs that per-round income can refill (0..1). */
  incomeCoverage: number;
  /** Overflow value lost past the caps after the next income phase. */
  capWaste: number;
  /** Value of wallet held far above plan need while income keeps feeding it. */
  strandedSurplus: number;
  reasons: readonly string[];
}

export interface EconomyPlanTransitionReport {
  schemaVersion: typeof ECONOMY_PLAN_SCHEMA;
  command: Command;
  bundleCoverageBefore: number;
  bundleCoverageAfter: number;
  bundleCoverageDelta: number;
  incomeCoverageBefore: number;
  incomeCoverageAfter: number;
  incomeCoverageDelta: number;
  capWasteBefore: number;
  capWasteAfter: number;
  capWasteReduction: number;
  strandedSurplusBefore: number;
  strandedSurplusAfter: number;
  strandedSurplusReduction: number;
  durableProgress: boolean;
  resourceValueDelta: number;
  wastefulSpend: boolean;
  productiveAlternative: boolean;
  passPreservesResources: boolean;
  score: number;
}

/**
 * Initial doctrine-aligned weights, deliberately not swept: covering the needed combination is the
 * dominant term, cap waste and wasteful spend are real penalties, stranded surplus is a soft nudge,
 * and Pass earns a small credit only when it is the resource-preserving choice.
 */
export const ECONOMY_PLAN_TRANSITION_WEIGHTS = {
  coverage: 6,
  incomeCoverage: 5,
  capWasteReduction: 1,
  strandedSurplusReduction: 0.4,
  wastefulSpend: 4,
  passPreserves: 1.5,
} as const;

function wallet(player: Player): EconomyReserveBundle {
  return {
    credits: player.data.credits,
    ores: player.data.ores,
    knowledge: player.data.knowledge,
    qics: player.data.qics,
  };
}

function remainingIncomePhases(engine: Engine): number {
  if (engine.phase === Phase.EndGame) {
    return 0;
  }
  if (engine.round <= 0) {
    return 6;
  }
  if (engine.phase === Phase.RoundStart || engine.phase === Phase.RoundIncome) {
    return Math.max(7 - engine.round, 0);
  }
  return Math.max(6 - engine.round, 0);
}

/** Whether at least one more income phase can still overflow the caps. */
function nextIncomeActive(engine: Engine): boolean {
  return remainingIncomePhases(engine) > 0;
}

function resourceValue(player: Player): number {
  const w = wallet(player);
  return (
    w.credits * RESOURCE_WEIGHT.credits +
    w.ores * RESOURCE_WEIGHT.ores +
    w.knowledge * RESOURCE_WEIGHT.knowledge +
    w.qics * RESOURCE_WEIGHT.qics
  );
}

/**
 * Coverage of the *combination*: the fraction of each required resource the wallet holds, averaged
 * over required resources. Piling on a resource already at 100% cannot raise coverage, so the term
 * rewards buying what the plan is short of rather than more of what it already has.
 */
function bundleCoverage(available: EconomyReserveBundle, bundle: EconomyReserveBundle): number {
  const keys = (Object.keys(bundle) as Array<keyof EconomyReserveBundle>).filter((key) => bundle[key] > 0);
  if (keys.length === 0) {
    return 1;
  }
  const total = keys.reduce((sum, key) => sum + Math.min(available[key] / bundle[key], 1), 0);
  return total / keys.length;
}

/**
 * Fraction of the budget's recurring needs that per-round income can refill. A flat mine economy
 * has ore income but no credit/knowledge income, so a budget that needs credits/knowledge scores low
 * here — rewarding the Trading Station / Lab income the diagnosed under-built engine never grew.
 */
function incomeCoverage(player: Player, bundle: EconomyReserveBundle): number {
  const keys = (Object.keys(bundle) as Array<keyof EconomyReserveBundle>).filter((key) => bundle[key] > 0);
  if (keys.length === 0) {
    return 1;
  }
  const total = keys.reduce((sum, key) => {
    const income = player.resourceIncome(RESOURCE_ENUM[key]);
    const targetRate = Math.max(1, bundle[key] / 3);
    return sum + Math.min(income / targetRate, 1);
  }, 0);
  return total / keys.length;
}

/** Value lost past the caps once the next income phase arrives (credits/ore/knowledge only). */
function capWaste(player: Player, engine: Engine): number {
  if (!nextIncomeActive(engine)) {
    return 0;
  }
  const w = wallet(player);
  let waste = 0;
  for (const key of ["credits", "ores", "knowledge"] as const) {
    const resource = key === "credits" ? Resource.Credit : key === "ores" ? Resource.Ore : Resource.Knowledge;
    const income = player.resourceIncome(resource);
    waste += Math.max(w[key] + income - RESOURCE_CAP[key], 0) * RESOURCE_WEIGHT[key];
  }
  return waste;
}

/** Value held above plan need + buffer while income keeps feeding that resource (below the cap). */
function strandedSurplus(player: Player, engine: Engine, bundle: EconomyReserveBundle): number {
  const w = wallet(player);
  let stranded = 0;
  for (const key of ["credits", "ores", "knowledge", "qics"] as const) {
    const resource =
      key === "credits"
        ? Resource.Credit
        : key === "ores"
          ? Resource.Ore
          : key === "knowledge"
            ? Resource.Knowledge
            : Resource.Qic;
    const income = key === "qics" ? player.resourceIncome(resource) : Math.min(player.resourceIncome(resource), 1);
    if (income <= 0 && !nextIncomeActive(engine)) {
      continue;
    }
    const excess = Math.max(w[key] - bundle[key] - STRANDED_BUFFER[key], 0);
    stranded += excess * RESOURCE_WEIGHT[key];
  }
  return stranded;
}

export function assessEconomyPlan(
  engine: Engine,
  actor: PlayerEnum,
  bundle: EconomyReserveBundle
): EconomyPlanAssessment {
  const player = engine.player(actor);
  const coverage = bundleCoverage(wallet(player), bundle);
  const income = incomeCoverage(player, bundle);
  const waste = capWaste(player, engine);
  const stranded = strandedSurplus(player, engine, bundle);
  return {
    schemaVersion: ECONOMY_PLAN_SCHEMA,
    bundle,
    bundleCoverage: coverage,
    incomeCoverage: income,
    capWaste: waste,
    strandedSurplus: stranded,
    reasons: [
      `bundle:c${bundle.credits}/o${bundle.ores}/k${bundle.knowledge}/q${bundle.qics}`,
      `coverage:${coverage.toFixed(3)}`,
      `income-coverage:${income.toFixed(3)}`,
      `cap-waste:${waste.toFixed(3)}`,
      `stranded-surplus:${stranded.toFixed(3)}`,
    ],
  };
}

function buildingCount(player: Player, engine: Engine): number {
  return Building.values(engine.expansions).reduce((sum, building) => sum + player.data.buildings[building], 0);
}

function researchCount(player: Player, engine: Engine): number {
  return ResearchField.values(engine.expansions).reduce((sum, field) => sum + player.data.research[field], 0);
}

function federationCount(player: Player): number {
  return player.data.tiles.federations.length + player.data.spaceshipFederations.length;
}

/**
 * Durable progress is any gain in board/track/federation/exploration/Gaia development or score. It is
 * intentionally independent of resource value: paying resources to advance the board is not waste.
 */
function durableProgress(source: Engine, destination: Engine, actor: PlayerEnum): boolean {
  const before = source.player(actor);
  const after = destination.player(actor);
  return (
    buildingCount(after, destination) > buildingCount(before, source) ||
    researchCount(after, destination) > researchCount(before, source) ||
    federationCount(after) > federationCount(before) ||
    Object.keys(after.data.explorationShips).length > Object.keys(before.data.explorationShips).length ||
    after.data.buildings[Building.GaiaFormer] + after.data.gaiaformersInGaia >
      before.data.buildings[Building.GaiaFormer] + before.data.gaiaformersInGaia ||
    after.data.victoryPoints > before.data.victoryPoints
  );
}

export function economyPlanApplies(engine: Engine): boolean {
  return engine.phase === Phase.RoundMove;
}

export function evaluateEconomyPlanTransition(
  source: Engine,
  destination: Engine,
  actor: PlayerEnum,
  command: Command,
  bundle: EconomyReserveBundle,
  productiveAlternative: boolean,
  weights: typeof ECONOMY_PLAN_TRANSITION_WEIGHTS = ECONOMY_PLAN_TRANSITION_WEIGHTS
): EconomyPlanTransitionReport {
  const before = assessEconomyPlan(source, actor, bundle);
  const after = assessEconomyPlan(destination, actor, bundle);
  const bundleCoverageDelta = after.bundleCoverage - before.bundleCoverage;
  const incomeCoverageDelta = after.incomeCoverage - before.incomeCoverage;
  const capWasteReduction = before.capWaste - after.capWaste;
  const strandedSurplusReduction = before.strandedSurplus - after.strandedSurplus;
  const progress = durableProgress(source, destination, actor);
  const resourceValueDelta = resourceValue(destination.player(actor)) - resourceValue(source.player(actor));
  const wastefulSpend = command !== Command.Pass && !progress && resourceValueDelta < -0.25;
  const passPreservesResources = command === Command.Pass && !productiveAlternative;

  const score =
    bundleCoverageDelta * weights.coverage +
    incomeCoverageDelta * weights.incomeCoverage +
    capWasteReduction * weights.capWasteReduction +
    strandedSurplusReduction * weights.strandedSurplusReduction -
    (wastefulSpend ? weights.wastefulSpend : 0) +
    (passPreservesResources ? weights.passPreserves : 0);

  return {
    schemaVersion: ECONOMY_PLAN_SCHEMA,
    command,
    bundleCoverageBefore: before.bundleCoverage,
    bundleCoverageAfter: after.bundleCoverage,
    bundleCoverageDelta,
    incomeCoverageBefore: before.incomeCoverage,
    incomeCoverageAfter: after.incomeCoverage,
    incomeCoverageDelta,
    capWasteBefore: before.capWaste,
    capWasteAfter: after.capWaste,
    capWasteReduction,
    strandedSurplusBefore: before.strandedSurplus,
    strandedSurplusAfter: after.strandedSurplus,
    strandedSurplusReduction,
    durableProgress: progress,
    resourceValueDelta,
    wastefulSpend,
    productiveAlternative,
    passPreservesResources,
    score,
  };
}
