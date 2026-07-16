import Engine from "../../engine";
import { Building, Command, Condition, Faction, Phase, Player as PlayerEnum, Resource } from "../../enums";
import Player from "../../player";
import { roundScoringEvents } from "../../tiles/scoring";

export const OPENING_PLAN_SCHEMA = "gaia-ai-opening-plan/v1" as const;

export const OPENING_PLAN_IDS = ["academy-engine", "planetary-institute-engine", "mine-spread"] as const;
export type OpeningPlanId = (typeof OPENING_PLAN_IDS)[number];

export interface OpeningPlanReserve {
  credits: number;
  ores: number;
  knowledge: number;
  qics: number;
}

export interface OpeningPlanAssessment {
  schemaVersion: typeof OPENING_PLAN_SCHEMA;
  id: OpeningPlanId;
  stage: string;
  nextBuilding: Building | null;
  progress: number;
  complete: boolean;
  viable: boolean;
  reserve: OpeningPlanReserve;
  reserveAffordability: number;
  priority: number;
  reasons: readonly string[];
}

export interface OpeningPlanTransitionReport {
  schemaVersion: typeof OPENING_PLAN_SCHEMA;
  plan: OpeningPlanId;
  command: Command;
  beforeProgress: number;
  afterProgress: number;
  progressDelta: number;
  reserveShortfallBefore: number;
  reserveShortfallAfter: number;
  reserveViolation: number;
  reserveGain: number;
  completionBonus: number;
  passPenalty: number;
  score: number;
}

export const OPENING_PLAN_TRANSITION_WEIGHTS = {
  progress: 14,
  reserveGain: 0.8,
  reserveViolation: 1.6,
  completion: 4,
  productivePass: 8,
} as const;

function emptyReserve(): OpeningPlanReserve {
  return { credits: 0, ores: 0, knowledge: 0, qics: 0 };
}

function buildingReserve(player: Player, building: Building | null): OpeningPlanReserve {
  const reserve = emptyReserve();
  if (building === null) {
    return reserve;
  }
  for (const cost of player.board.cost(building, false)) {
    switch (cost.type) {
      case Resource.Credit:
        reserve.credits += cost.count;
        break;
      case Resource.Ore:
        reserve.ores += cost.count;
        break;
      case Resource.Knowledge:
        reserve.knowledge += cost.count;
        break;
      case Resource.Qic:
        reserve.qics += cost.count;
        break;
    }
  }
  return reserve;
}

function wallet(player: Player): OpeningPlanReserve {
  return {
    credits: player.data.credits,
    ores: player.data.ores,
    knowledge: player.data.knowledge,
    qics: player.data.qics,
  };
}

function reserveAffordability(reserve: OpeningPlanReserve, available: OpeningPlanReserve): number {
  const required = (Object.keys(reserve) as Array<keyof OpeningPlanReserve>).filter((key) => reserve[key] > 0);
  if (required.length === 0) {
    return 1;
  }
  return Math.min(...required.map((key) => Math.min(available[key] / reserve[key], 1)));
}

function reserveShortfall(reserve: OpeningPlanReserve, available: OpeningPlanReserve): number {
  return (
    Math.max(reserve.credits - available.credits, 0) * 0.22 +
    Math.max(reserve.ores - available.ores, 0) * 0.8 +
    Math.max(reserve.knowledge - available.knowledge, 0) +
    Math.max(reserve.qics - available.qics, 0) * 1.2
  );
}

function availableAcademy(player: Player): Building | null {
  if (player.data.buildings[Building.Academy1] < player.maxBuildings(Building.Academy1)) {
    return Building.Academy1;
  }
  if (player.data.buildings[Building.Academy2] < player.maxBuildings(Building.Academy2)) {
    return Building.Academy2;
  }
  return null;
}

function currentRoundScoringBoost(engine: Engine, conditions: readonly Condition[]): number {
  if (engine.round < 1 || engine.round > engine.tiles.scorings.round.length) {
    return 0;
  }
  const tile = engine.tiles.scorings.round[engine.round - 1];
  return roundScoringEvents(tile, engine.round)
    .filter((event) => conditions.includes(event.condition))
    .flatMap((event) => event.rewards)
    .filter((reward) => reward.type === Resource.VictoryPoint)
    .reduce((sum, reward) => sum + reward.count * 0.15, 0);
}

function factionPlanModifier(faction: Faction, plan: OpeningPlanId): number {
  if (faction === Faction.Xenos) {
    return plan === "mine-spread" ? 0.35 : plan === "planetary-institute-engine" ? 0.25 : 0.15;
  }
  if (faction === Faction.HadschHallas) {
    return plan === "planetary-institute-engine" ? 0.35 : plan === "academy-engine" ? 0.15 : 0.1;
  }
  return 0;
}

function academyAssessment(engine: Engine, player: Player): OpeningPlanAssessment {
  const academyCount = player.data.buildings[Building.Academy1] + player.data.buildings[Building.Academy2];
  const complete = academyCount > 0;
  let stage = "mine-to-trading-station";
  let nextBuilding: Building | null = Building.TradingStation;
  let progress = 0;
  if (complete) {
    stage = "complete";
    nextBuilding = null;
    progress = 1;
  } else if (player.data.buildings[Building.ResearchLab] > 0) {
    stage = "research-lab-to-academy";
    nextBuilding = availableAcademy(player);
    progress = 0.67;
  } else if (player.data.buildings[Building.TradingStation] > 0) {
    stage = "trading-station-to-research-lab";
    nextBuilding = Building.ResearchLab;
    progress = 0.33;
  }
  const reserve = buildingReserve(player, nextBuilding);
  const affordability = reserveAffordability(reserve, wallet(player));
  const viable =
    complete ||
    (engine.round <= 2 &&
      player.data.buildings[Building.Mine] +
        player.data.buildings[Building.TradingStation] +
        player.data.buildings[Building.ResearchLab] >
        0 &&
      nextBuilding !== null &&
      player.data.buildings[nextBuilding] < player.maxBuildings(nextBuilding));
  const scoring = currentRoundScoringBoost(engine, [Condition.BigBuilding, Condition.ResearchLab]);
  return {
    schemaVersion: OPENING_PLAN_SCHEMA,
    id: "academy-engine",
    stage,
    nextBuilding,
    progress,
    complete,
    viable,
    reserve,
    reserveAffordability: affordability,
    priority:
      3.1 + progress * 1.2 + affordability * 1.4 + scoring + factionPlanModifier(player.faction, "academy-engine"),
    reasons: [
      `stage:${stage}`,
      `reserve-affordability:${affordability.toFixed(3)}`,
      `round-scoring:${scoring.toFixed(3)}`,
      `faction-modifier:${factionPlanModifier(player.faction, "academy-engine").toFixed(3)}`,
    ],
  };
}

function planetaryInstituteAssessment(engine: Engine, player: Player): OpeningPlanAssessment {
  const complete = player.data.buildings[Building.PlanetaryInstitute] > 0;
  let stage = "mine-to-trading-station";
  let nextBuilding: Building | null = Building.TradingStation;
  let progress = 0;
  if (complete) {
    stage = "complete";
    nextBuilding = null;
    progress = 1;
  } else if (player.data.buildings[Building.TradingStation] > 0) {
    stage = "trading-station-to-planetary-institute";
    nextBuilding = Building.PlanetaryInstitute;
    progress = 0.4;
  }
  const reserve = buildingReserve(player, nextBuilding);
  const affordability = reserveAffordability(reserve, wallet(player));
  const viable =
    complete ||
    (engine.round <= 2 &&
      player.data.buildings[Building.Mine] + player.data.buildings[Building.TradingStation] > 0 &&
      nextBuilding !== null &&
      player.data.buildings[nextBuilding] < player.maxBuildings(nextBuilding));
  const scoring = currentRoundScoringBoost(engine, [Condition.BigBuilding]);
  return {
    schemaVersion: OPENING_PLAN_SCHEMA,
    id: "planetary-institute-engine",
    stage,
    nextBuilding,
    progress,
    complete,
    viable,
    reserve,
    reserveAffordability: affordability,
    priority:
      2.8 +
      progress * 1.2 +
      affordability * 1.35 +
      scoring +
      factionPlanModifier(player.faction, "planetary-institute-engine"),
    reasons: [
      `stage:${stage}`,
      `reserve-affordability:${affordability.toFixed(3)}`,
      `round-scoring:${scoring.toFixed(3)}`,
      `faction-modifier:${factionPlanModifier(player.faction, "planetary-institute-engine").toFixed(3)}`,
    ],
  };
}

function mineSpreadAssessment(engine: Engine, player: Player): OpeningPlanAssessment {
  const mineCount = player.data.buildings[Building.Mine];
  const target = Math.min(5, player.maxBuildings(Building.Mine));
  const complete = mineCount >= target;
  const nextBuilding = complete ? null : Building.Mine;
  const progress = target > 0 ? Math.min(mineCount / target, 1) : 1;
  const reserve = buildingReserve(player, nextBuilding);
  const affordability = reserveAffordability(reserve, wallet(player));
  const viable = complete || (engine.round <= 2 && mineCount < player.maxBuildings(Building.Mine));
  const scoring = currentRoundScoringBoost(engine, [
    Condition.Mine,
    Condition.NewSector,
    Condition.NewPlanetType,
    Condition.MineOnGaia,
  ]);
  return {
    schemaVersion: OPENING_PLAN_SCHEMA,
    id: "mine-spread",
    stage: complete ? "complete" : `mines-${mineCount}-of-${target}`,
    nextBuilding,
    progress,
    complete,
    viable,
    reserve,
    reserveAffordability: affordability,
    priority: 2.7 + progress + affordability * 1.25 + scoring + factionPlanModifier(player.faction, "mine-spread"),
    reasons: [
      `stage:mines-${mineCount}-of-${target}`,
      `reserve-affordability:${affordability.toFixed(3)}`,
      `round-scoring:${scoring.toFixed(3)}`,
      `faction-modifier:${factionPlanModifier(player.faction, "mine-spread").toFixed(3)}`,
    ],
  };
}

export function assessOpeningPlans(engine: Engine, actor: PlayerEnum): readonly OpeningPlanAssessment[] {
  const player = engine.player(actor);
  return [
    academyAssessment(engine, player),
    planetaryInstituteAssessment(engine, player),
    mineSpreadAssessment(engine, player),
  ];
}

export function assessOpeningPlan(engine: Engine, actor: PlayerEnum, plan: OpeningPlanId): OpeningPlanAssessment {
  const assessment = assessOpeningPlans(engine, actor).find((candidate) => candidate.id === plan);
  if (!assessment) {
    throw new Error(`Unknown opening plan ${plan}`);
  }
  return assessment;
}

export function rankOpeningPlans(engine: Engine, actor: PlayerEnum): readonly OpeningPlanAssessment[] {
  return [...assessOpeningPlans(engine, actor)].sort(
    (left, right) => right.priority - left.priority || left.id.localeCompare(right.id)
  );
}

export function openingPlanApplies(engine: Engine): boolean {
  return engine.phase === Phase.RoundMove && engine.round >= 1 && engine.round <= 2;
}

export function evaluateOpeningPlanTransition(
  source: Engine,
  destination: Engine,
  actor: PlayerEnum,
  plan: OpeningPlanId,
  command: Command,
  productiveAlternative: boolean
): OpeningPlanTransitionReport {
  const before = assessOpeningPlan(source, actor, plan);
  const after = assessOpeningPlan(destination, actor, plan);
  const progressDelta = Math.max(after.progress - before.progress, 0);
  const shortfallBefore = reserveShortfall(before.reserve, wallet(source.player(actor)));
  const shortfallAfter = reserveShortfall(before.reserve, wallet(destination.player(actor)));
  const reserveViolation = progressDelta > 0 ? 0 : Math.max(shortfallAfter - shortfallBefore, 0);
  const reserveGain = Math.max(shortfallBefore - shortfallAfter, 0);
  const completionBonus = !before.complete && after.complete ? OPENING_PLAN_TRANSITION_WEIGHTS.completion : 0;
  const passPenalty =
    command === Command.Pass && productiveAlternative ? OPENING_PLAN_TRANSITION_WEIGHTS.productivePass : 0;
  const score =
    progressDelta * OPENING_PLAN_TRANSITION_WEIGHTS.progress +
    reserveGain * OPENING_PLAN_TRANSITION_WEIGHTS.reserveGain -
    reserveViolation * OPENING_PLAN_TRANSITION_WEIGHTS.reserveViolation +
    completionBonus -
    passPenalty;
  return {
    schemaVersion: OPENING_PLAN_SCHEMA,
    plan,
    command,
    beforeProgress: before.progress,
    afterProgress: after.progress,
    progressDelta,
    reserveShortfallBefore: shortfallBefore,
    reserveShortfallAfter: shortfallAfter,
    reserveViolation,
    reserveGain,
    completionBonus,
    passPenalty,
    score,
  };
}
