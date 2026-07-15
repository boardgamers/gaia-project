import Engine from "../../engine";
import {
  AdvTechTile,
  AdvTechTilePos,
  Command,
  Faction,
  Operator,
  Phase,
  Player as PlayerEnum,
  ResearchField,
  Resource,
} from "../../enums";
import Player from "../../player";
import Reward from "../../reward";
import { isAdvanced, techTileEventWithSource } from "../../tiles/techs";

export const RESEARCH_PLAN_SCHEMA = "gaia-ai-research-plan/v1" as const;
export const RESEARCH_PLAN_ID = "research-advanced-tech" as const;
export type ResearchPlanId = typeof RESEARCH_PLAN_ID;

export interface ResearchPlanContext {
  /** Whether the current committed macro set contains an enumerable Federation action. */
  federationActionAvailable?: boolean;
}

export interface ResearchPlanAssessment {
  schemaVersion: typeof RESEARCH_PLAN_SCHEMA;
  id: ResearchPlanId;
  target: ResearchField;
  currentLevel: number;
  progress: number;
  complete: boolean;
  viable: boolean;
  knowledgeReserve: number;
  reserveAffordability: number;
  advancedTech: AdvTechTile | null;
  advancedTechAvailable: boolean;
  advancedTechAccessFactor: number;
  federationBridgeAvailable: boolean;
  greenFederation: boolean;
  priority: number;
  reasons: readonly string[];
}

export interface ResearchPlanTransitionReport {
  schemaVersion: typeof RESEARCH_PLAN_SCHEMA;
  plan: ResearchPlanId;
  target: ResearchField;
  command: Command;
  targetLevelBefore: number;
  targetLevelAfter: number;
  targetProgressDelta: number;
  totalResearchDelta: number;
  standardTechDelta: number;
  advancedTechDelta: number;
  federationReadinessDelta: number;
  reserveShortfallBefore: number;
  reserveShortfallAfter: number;
  reserveViolation: number;
  reserveGain: number;
  completionBonus: number;
  passPenalty: number;
  score: number;
}

/**
 * These weights express the doctrine rather than hiding it inside the general evaluator: focused
 * track progress is worth more than shallow spread, an Advanced Tech is the main threshold, four
 * knowledge is protected until it can be spent productively, and a useful plan action blocks Pass.
 */
export const RESEARCH_PLAN_TRANSITION_WEIGHTS = {
  targetResearch: 5,
  otherResearch: 1,
  standardTech: 2.5,
  advancedTech: 8,
  federationReadiness: 4,
  reserveGain: 0.7,
  reserveViolation: 1.6,
  completion: 4,
  productivePass: 8,
} as const;

function advancedTechAt(engine: Engine, field: ResearchField): { tile: AdvTechTile; count: number } | null {
  const seeded = engine.tiles.techs[`adv-${field}` as AdvTechTilePos];
  if (!seeded) {
    return null;
  }
  return { tile: seeded.tile as AdvTechTile, count: seeded.count };
}

function ownsTargetAdvancedTech(player: Player, field: ResearchField): boolean {
  return player.data.tiles.techs.some((tech) => tech.pos === `adv-${field}`);
}

function standardTechCount(player: Player): number {
  return player.data.tiles.techs.filter((tech) => !isAdvanced(tech.pos)).length;
}

function advancedTechCount(player: Player): number {
  return player.data.tiles.techs.filter((tech) => isAdvanced(tech.pos)).length;
}

function totalResearch(player: Player, engine: Engine): number {
  return ResearchField.values(engine.expansions).reduce((sum, field) => sum + player.data.research[field], 0);
}

function factionTrackModifier(faction: Faction, field: ResearchField): number {
  if (faction === Faction.Xenos) {
    if (field === ResearchField.Intelligence) {
      return 0.75;
    }
    if (field === ResearchField.Navigation || field === ResearchField.Terraforming) {
      return 0.3;
    }
  }
  if (faction === Faction.HadschHallas) {
    if (field === ResearchField.GaiaProject) {
      return 0.75;
    }
    if (field === ResearchField.Navigation || field === ResearchField.Terraforming) {
      return 0.3;
    }
  }
  return 0;
}

function remainingUseFactor(engine: Engine): number {
  return Math.max(7 - engine.round, 1) / 6;
}

function rewardUtility(reward: Reward): number {
  switch (reward.type) {
    case Resource.VictoryPoint:
      return reward.count;
    case Resource.Ore:
      return reward.count * 1.2;
    case Resource.Credit:
      return reward.count * 0.3;
    case Resource.Knowledge:
      return reward.count * 1.4;
    case Resource.Qic:
      return reward.count * 1.6;
    case Resource.ChargePower:
    case Resource.GainToken:
    case Resource.GainTokenArea3:
      return reward.count * 0.35;
    default:
      return reward.count * 0.5;
  }
}

/**
 * Tile value is recomputed from the seeded tile's real event, current infrastructure, and remaining
 * uses. This intentionally avoids a permanent Advanced Tech tier list.
 */
function advancedTechContextUtility(engine: Engine, player: Player, tile: AdvTechTile): number {
  const remainingRounds = Math.max(7 - engine.round, 1);
  return techTileEventWithSource(tile, null).reduce((total, event) => {
    const rewards = event.rewards.reduce((sum, reward) => sum + rewardUtility(reward), 0);
    const conditionCount = Math.max(player.eventConditionCount(event.condition), 1);
    switch (event.operator) {
      case Operator.Once:
        return total + rewards * conditionCount;
      case Operator.Income:
        return total + rewards * Math.max(remainingRounds - 1, 1) * 0.65;
      case Operator.Activate:
        return total + rewards * remainingRounds * 0.75;
      case Operator.Pass:
        return total + rewards * conditionCount * remainingRounds * 0.45;
      case Operator.Trigger:
        return total + rewards * Math.min(conditionCount, 3) * remainingRounds * 0.35;
      default:
        return total + rewards;
    }
  }, 0);
}

export function assessResearchPlan(
  engine: Engine,
  actor: PlayerEnum,
  target: ResearchField,
  context: ResearchPlanContext = {}
): ResearchPlanAssessment {
  const player = engine.player(actor);
  const currentLevel = player.data.research[target];
  const seeded = advancedTechAt(engine, target);
  const advancedTechAvailable = seeded !== null && seeded.count > 0;
  const complete = ownsTargetAdvancedTech(player, target) || currentLevel >= 5;
  const greenFederation = player.data.hasGreenFederation();
  const federationBridgeAvailable = greenFederation || (context.federationActionAvailable ?? true);
  const advancedTechAccessFactor = federationBridgeAvailable ? 1 : currentLevel >= 4 ? 0 : 0.25;
  const knowledgeReserve = complete ? 0 : 4;
  const reserveAffordability = knowledgeReserve === 0 ? 1 : Math.min(player.data.knowledge / knowledgeReserve, 1);
  const levelProgress = Math.min(currentLevel / 4, 1);
  const federationGatePenalty = currentLevel >= 4 && !greenFederation ? 0.75 : 0;
  const tileUtility = seeded ? advancedTechContextUtility(engine, player, seeded.tile) * advancedTechAccessFactor : 0;
  const factionModifier = factionTrackModifier(player.faction, target);
  const viable =
    complete ||
    (engine.round <= 6 &&
      currentLevel < 5 &&
      advancedTechAvailable &&
      !(currentLevel >= 4 && !federationBridgeAvailable));
  const priority =
    tileUtility +
    levelProgress * 3.2 +
    reserveAffordability * 1.15 +
    factionModifier -
    federationGatePenalty -
    (advancedTechAvailable ? 0 : 5);

  return {
    schemaVersion: RESEARCH_PLAN_SCHEMA,
    id: RESEARCH_PLAN_ID,
    target,
    currentLevel,
    progress: complete ? 1 : levelProgress * 0.8 + (greenFederation ? 0.1 : 0),
    complete,
    viable,
    knowledgeReserve,
    reserveAffordability,
    advancedTech: seeded ? seeded.tile : null,
    advancedTechAvailable,
    advancedTechAccessFactor,
    federationBridgeAvailable,
    greenFederation,
    priority,
    reasons: [
      `track-level:${currentLevel}`,
      `advanced-tech:${seeded ? seeded.tile : "none"}`,
      `advanced-tech-available:${advancedTechAvailable}`,
      `advanced-tech-access-factor:${advancedTechAccessFactor.toFixed(3)}`,
      `advanced-tech-context-utility:${tileUtility.toFixed(3)}`,
      `remaining-use-factor:${remainingUseFactor(engine).toFixed(3)}`,
      `knowledge-affordability:${reserveAffordability.toFixed(3)}`,
      `green-federation:${greenFederation}`,
      `federation-bridge-available:${federationBridgeAvailable}`,
      `faction-modifier:${factionModifier.toFixed(3)}`,
    ],
  };
}

export function rankResearchPlans(
  engine: Engine,
  actor: PlayerEnum,
  context: ResearchPlanContext = {}
): readonly ResearchPlanAssessment[] {
  return ResearchField.values(engine.expansions)
    .map((field) => assessResearchPlan(engine, actor, field, context))
    .sort((left, right) => right.priority - left.priority || left.target.localeCompare(right.target));
}

export function researchPlanApplies(engine: Engine): boolean {
  return engine.phase === Phase.RoundMove && engine.round >= 3 && engine.round <= 6;
}

export function evaluateResearchPlanTransition(
  source: Engine,
  destination: Engine,
  actor: PlayerEnum,
  target: ResearchField,
  command: Command,
  productiveAlternative: boolean,
  context: ResearchPlanContext = {}
): ResearchPlanTransitionReport {
  const beforePlayer = source.player(actor);
  const afterPlayer = destination.player(actor);
  const before = assessResearchPlan(source, actor, target, context);
  const after = assessResearchPlan(destination, actor, target, context);
  const targetProgressDelta = Math.max(after.currentLevel - before.currentLevel, 0);
  const totalResearchDelta = Math.max(totalResearch(afterPlayer, destination) - totalResearch(beforePlayer, source), 0);
  const otherResearchDelta = Math.max(totalResearchDelta - targetProgressDelta, 0);
  const standardTechDelta = Math.max(standardTechCount(afterPlayer) - standardTechCount(beforePlayer), 0);
  const advancedTechDelta = Math.max(advancedTechCount(afterPlayer) - advancedTechCount(beforePlayer), 0);
  const federationReadinessDelta = !before.greenFederation && after.greenFederation ? 1 : 0;
  const reserveShortfallBefore = Math.max(before.knowledgeReserve - beforePlayer.data.knowledge, 0);
  const reserveShortfallAfter = Math.max(before.knowledgeReserve - afterPlayer.data.knowledge, 0);
  const planProgress =
    targetProgressDelta > 0 || standardTechDelta > 0 || advancedTechDelta > 0 || federationReadinessDelta > 0;
  const reserveViolation = planProgress ? 0 : Math.max(reserveShortfallAfter - reserveShortfallBefore, 0);
  const reserveGain = Math.max(reserveShortfallBefore - reserveShortfallAfter, 0);
  const completionBonus = !before.complete && after.complete ? RESEARCH_PLAN_TRANSITION_WEIGHTS.completion : 0;
  const passPenalty =
    command === Command.Pass && productiveAlternative ? RESEARCH_PLAN_TRANSITION_WEIGHTS.productivePass : 0;
  const score =
    targetProgressDelta * RESEARCH_PLAN_TRANSITION_WEIGHTS.targetResearch +
    otherResearchDelta * RESEARCH_PLAN_TRANSITION_WEIGHTS.otherResearch +
    standardTechDelta * RESEARCH_PLAN_TRANSITION_WEIGHTS.standardTech +
    advancedTechDelta * RESEARCH_PLAN_TRANSITION_WEIGHTS.advancedTech +
    federationReadinessDelta * RESEARCH_PLAN_TRANSITION_WEIGHTS.federationReadiness +
    reserveGain * RESEARCH_PLAN_TRANSITION_WEIGHTS.reserveGain -
    reserveViolation * RESEARCH_PLAN_TRANSITION_WEIGHTS.reserveViolation +
    completionBonus -
    passPenalty;

  return {
    schemaVersion: RESEARCH_PLAN_SCHEMA,
    plan: RESEARCH_PLAN_ID,
    target,
    command,
    targetLevelBefore: before.currentLevel,
    targetLevelAfter: after.currentLevel,
    targetProgressDelta,
    totalResearchDelta,
    standardTechDelta,
    advancedTechDelta,
    federationReadinessDelta,
    reserveShortfallBefore,
    reserveShortfallAfter,
    reserveViolation,
    reserveGain,
    completionBonus,
    passPenalty,
    score,
  };
}
