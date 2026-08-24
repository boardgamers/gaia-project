import Engine from "../../engine";
import { Building, Command, Player, ResearchField, Resource } from "../../enums";
import PlayerInstance from "../../player";
import { CommittedTurnMacro } from "../actions/turn-builder";
import { evaluateHeuristic, HeuristicEvaluationOptions, HeuristicEvaluationReport } from "../evaluation";
import {
  economyPlanApplies,
  EconomyPlanTransitionReport,
  EconomyReserveBundle,
  evaluateEconomyPlanTransition,
} from "../strategy/economy-plan";
import {
  assessOpeningPlan,
  evaluateOpeningPlanTransition,
  openingPlanApplies,
  OpeningPlanAssessment,
  OpeningPlanId,
  OpeningPlanTransitionReport,
  rankOpeningPlans,
} from "../strategy/opening-plans";
import {
  assessResearchPlan,
  evaluateResearchPlanTransition,
  rankResearchPlans,
  RESEARCH_PLAN_ID,
  researchPlanApplies,
  ResearchPlanAssessment,
  ResearchPlanId,
  ResearchPlanTransitionReport,
} from "../strategy/research-plan";
import {
  evaluateStrategyTempoTransition,
  strategyTempoApplies,
  StrategyTempoTransitionReport,
} from "../strategy/tempo";
import { applyMacroHostStyle, buildBotMacroSet, chooseFixedFrame } from "./common";
import { MacroBot, MacroBotBuildOptions, MacroBotSelection } from "./types";

export const STRATEGY_PLAN_BOT_SCHEMA = "gaia-ai-strategy-plan-bot/v4" as const;

export interface StrategyPlanMacroBotOptions extends MacroBotBuildOptions {
  evaluation?: Omit<HeuristicEvaluationOptions, "transition">;
  /** Plan switching requires a material priority lead; ordinary fluctuations keep the plan stable. */
  switchThreshold?: number;
  /** Optional diagnostic opportunity cost for Pass; zero preserves the validated plan policy. */
  productivePassPenalty?: number;
  /** Diagnostic only: gate Advanced Tech goals on a Federation formable this exact turn. */
  federationFeasibilityGate?: boolean;
  /**
   * Opt-in compatible-income / action-budget economic plan. When enabled it scores each macro
   * against the active plan's reserved cost bundle (combination coverage, cap waste, stranded
   * surplus, wasteful spend, resource-preserving Pass). Default false preserves the frozen policy
   * exactly.
   */
  economyPlanning?: boolean;
}

export interface StrategyPlanSelectionReport {
  schemaVersion: typeof STRATEGY_PLAN_BOT_SCHEMA;
  value: number;
  heuristic: HeuristicEvaluationReport;
  activePlan: OpeningPlanId | ResearchPlanId | null;
  researchTarget: ResearchField | null;
  planDecision: string;
  planCandidates: readonly (OpeningPlanAssessment | ResearchPlanAssessment)[];
  transition: OpeningPlanTransitionReport | ResearchPlanTransitionReport | null;
  tempo: StrategyTempoTransitionReport | null;
  economy: EconomyPlanTransitionReport | null;
}

interface EvaluatedMacro {
  macro: CommittedTurnMacro;
  destination: Engine;
  heuristic: HeuristicEvaluationReport;
  transition: OpeningPlanTransitionReport | ResearchPlanTransitionReport | null;
  tempo: StrategyTempoTransitionReport | null;
  economy: EconomyPlanTransitionReport | null;
  value: number;
}

interface PlanDecision {
  plan: OpeningPlanId | ResearchPlanId | null;
  researchTarget: ResearchField | null;
  reason: string;
  candidates: readonly (OpeningPlanAssessment | ResearchPlanAssessment)[];
}

function emptyBundle(): EconomyReserveBundle {
  return { credits: 0, ores: 0, knowledge: 0, qics: 0 };
}

function addBuildingCost(bundle: EconomyReserveBundle, player: PlayerInstance, building: Building): void {
  for (const cost of player.board.cost(building, false)) {
    switch (cost.type) {
      case Resource.Credit:
        bundle.credits += cost.count;
        break;
      case Resource.Ore:
        bundle.ores += cost.count;
        break;
      case Resource.Knowledge:
        bundle.knowledge += cost.count;
        break;
      case Resource.Qic:
        bundle.qics += cost.count;
        break;
    }
  }
}

function availableAcademy(player: PlayerInstance): Building {
  return player.data.buildings[Building.Academy1] < player.maxBuildings(Building.Academy1)
    ? Building.Academy1
    : Building.Academy2;
}

/** The plan's remaining building chain from the current stage, in build order. */
function openingChain(player: PlayerInstance, plan: OpeningPlanId): Building[] {
  const buildings = player.data.buildings;
  if (plan === "academy-engine") {
    if (buildings[Building.Academy1] + buildings[Building.Academy2] > 0) {
      return [];
    }
    if (buildings[Building.ResearchLab] > 0) {
      return [availableAcademy(player)];
    }
    if (buildings[Building.TradingStation] > 0) {
      return [Building.ResearchLab, availableAcademy(player)];
    }
    return [Building.TradingStation, Building.ResearchLab, availableAcademy(player)];
  }
  if (plan === "planetary-institute-engine") {
    if (buildings[Building.PlanetaryInstitute] > 0) {
      return [];
    }
    if (buildings[Building.TradingStation] > 0) {
      return [Building.PlanetaryInstitute];
    }
    return [Building.TradingStation, Building.PlanetaryInstitute];
  }
  const target = Math.min(5, player.maxBuildings(Building.Mine));
  const remaining = Math.max(0, Math.min(3, target - buildings[Building.Mine]));
  return new Array<Building>(remaining).fill(Building.Mine);
}

/**
 * The action budget for the current round: the summed cost bundle of the plan's next few meaningful
 * actions, not just the single immediate prerequisite. Coverage and stranded-surplus are measured
 * against this so the economy is judged compatible with executing a whole round, which is what the
 * diagnosed zero-action middle rounds lacked. An absent plan yields an empty budget.
 */
export function roundActionBudget(
  engine: Engine,
  actor: Player,
  plan: OpeningPlanId | ResearchPlanId | null,
  researchTarget: ResearchField | null
): EconomyReserveBundle {
  const bundle = emptyBundle();
  const player = engine.player(actor);
  if (plan && plan !== RESEARCH_PLAN_ID) {
    for (const building of openingChain(player, plan as OpeningPlanId)) {
      addBuildingCost(bundle, player, building);
    }
  } else if (plan === RESEARCH_PLAN_ID && researchTarget) {
    const level = player.data.research[researchTarget];
    const steps = Math.max(1, Math.min(2, 5 - level));
    bundle.knowledge = 4 * steps;
  }
  return bundle;
}

/**
 * AI-7 candidate: persistent opening and research plans over the inspectable heuristic baseline.
 * It does not script actions. It rewards state progress, protects the next plan cost, penalizes
 * passing while a productive plan transition exists, and reports every term.
 */
export class StrategyPlanMacroBot implements MacroBot<StrategyPlanSelectionReport> {
  readonly name = "strategy-plan-macro";
  private readonly activePlans = new Map<Player, OpeningPlanId>();
  private readonly researchTargets = new Map<Player, ResearchField>();
  private readonly switchThreshold: number;

  constructor(private readonly options: StrategyPlanMacroBotOptions = {}) {
    this.switchThreshold = options.switchThreshold ?? 1.25;
  }

  private decideOpeningPlan(engine: Engine, actor: Player): PlanDecision {
    const candidates = rankOpeningPlans(engine, actor);
    const best = candidates.find((candidate) => candidate.viable && !candidate.complete) ?? null;
    const retainedId = this.activePlans.get(actor);
    if (!retainedId) {
      if (best) {
        this.activePlans.set(actor, best.id);
        return { plan: best.id, researchTarget: null, reason: `selected:${best.id}`, candidates };
      }
      return { plan: null, researchTarget: null, reason: "no-viable-opening-plan", candidates };
    }

    const retained = assessOpeningPlan(engine, actor, retainedId);
    if (retained.complete) {
      if (best) {
        this.activePlans.set(actor, best.id);
        return {
          plan: best.id,
          researchTarget: null,
          reason: `completed:${retainedId}->${best.id}`,
          candidates,
        };
      }
      return { plan: null, researchTarget: null, reason: `completed:${retainedId}`, candidates };
    }
    if (!retained.viable) {
      if (best) {
        this.activePlans.set(actor, best.id);
        return {
          plan: best.id,
          researchTarget: null,
          reason: `aborted:${retainedId}->${best.id}`,
          candidates,
        };
      }
      return { plan: null, researchTarget: null, reason: `aborted:${retainedId}`, candidates };
    }
    if (best && best.id !== retainedId && best.priority >= retained.priority + this.switchThreshold) {
      this.activePlans.set(actor, best.id);
      return {
        plan: best.id,
        researchTarget: null,
        reason: `material-switch:${retainedId}->${best.id}:${(best.priority - retained.priority).toFixed(3)}`,
        candidates,
      };
    }
    return { plan: retainedId, researchTarget: null, reason: `retained:${retainedId}`, candidates };
  }

  private decideResearchPlan(engine: Engine, actor: Player, federationActionAvailable: boolean): PlanDecision {
    const researchContext = { federationActionAvailable };
    const candidates = rankResearchPlans(engine, actor, researchContext);
    const best = candidates.find((candidate) => candidate.viable && !candidate.complete) ?? null;
    const retainedTarget = this.researchTargets.get(actor);
    if (!retainedTarget) {
      if (best) {
        this.researchTargets.set(actor, best.target);
        return {
          plan: RESEARCH_PLAN_ID,
          researchTarget: best.target,
          reason: `selected:${RESEARCH_PLAN_ID}:${best.target}`,
          candidates,
        };
      }
      return { plan: null, researchTarget: null, reason: "no-viable-research-plan", candidates };
    }

    const retained = assessResearchPlan(engine, actor, retainedTarget, researchContext);
    if (retained.complete || !retained.viable) {
      if (best) {
        this.researchTargets.set(actor, best.target);
        return {
          plan: RESEARCH_PLAN_ID,
          researchTarget: best.target,
          reason: `${retained.complete ? "completed" : "aborted"}:${retainedTarget}->${best.target}`,
          candidates,
        };
      }
      return {
        plan: null,
        researchTarget: null,
        reason: `${retained.complete ? "completed" : "aborted"}:${retainedTarget}`,
        candidates,
      };
    }
    if (best && best.target !== retainedTarget && best.priority >= retained.priority + this.switchThreshold) {
      this.researchTargets.set(actor, best.target);
      return {
        plan: RESEARCH_PLAN_ID,
        researchTarget: best.target,
        reason: `material-switch:${retainedTarget}->${best.target}:${(best.priority - retained.priority).toFixed(3)}`,
        candidates,
      };
    }
    return {
      plan: RESEARCH_PLAN_ID,
      researchTarget: retainedTarget,
      reason: `retained:${RESEARCH_PLAN_ID}:${retainedTarget}`,
      candidates,
    };
  }

  private decidePlan(engine: Engine, actor: Player, federationActionAvailable: boolean): PlanDecision {
    if (openingPlanApplies(engine)) {
      return this.decideOpeningPlan(engine, actor);
    }
    if (researchPlanApplies(engine)) {
      return this.decideResearchPlan(engine, actor, federationActionAvailable);
    }
    return { plan: null, researchTarget: null, reason: "outside-plan-horizon", candidates: [] };
  }

  select(engine: Engine): MacroBotSelection<StrategyPlanSelectionReport> {
    const macroSet = buildBotMacroSet(engine, this.options.macroBuildOptions);
    const actor = macroSet.actor;
    const federationActionAvailable = this.options.federationFeasibilityGate
      ? macroSet.macros.some((macro) => macro.mainCommand === Command.FormFederation)
      : true;
    const decision = this.decidePlan(engine, actor, federationActionAvailable);
    const evaluated = macroSet.macros.map((macro): EvaluatedMacro => {
      const destination = applyMacroHostStyle(engine, macro);
      const heuristic = evaluateHeuristic(destination, {
        ...this.options.evaluation,
        transition: { source: engine, macro },
      });
      return { macro, destination, heuristic, transition: null, tempo: null, economy: null, value: heuristic.value };
    });

    if (decision.plan && decision.plan !== RESEARCH_PLAN_ID) {
      const preliminary = evaluated.map((candidate) =>
        evaluateOpeningPlanTransition(
          engine,
          candidate.destination,
          actor,
          decision.plan as OpeningPlanId,
          candidate.macro.mainCommand,
          false
        )
      );
      const productiveAlternative = preliminary.some(
        (transition) => transition.progressDelta > 0 || transition.reserveGain > 0
      );
      const orientation = actor === Player.Player1 ? 1 : -1;
      for (let index = 0; index < evaluated.length; index += 1) {
        const transition = evaluateOpeningPlanTransition(
          engine,
          evaluated[index].destination,
          actor,
          decision.plan as OpeningPlanId,
          evaluated[index].macro.mainCommand,
          productiveAlternative
        );
        evaluated[index].transition = transition;
        evaluated[index].value = evaluated[index].heuristic.value + orientation * transition.score;
      }
    } else if (decision.plan === RESEARCH_PLAN_ID && decision.researchTarget) {
      const preliminary = evaluated.map((candidate) =>
        evaluateResearchPlanTransition(
          engine,
          candidate.destination,
          actor,
          decision.researchTarget as ResearchField,
          candidate.macro.mainCommand,
          false,
          { federationActionAvailable }
        )
      );
      const productiveAlternative = preliminary.some(
        (transition) =>
          transition.targetProgressDelta > 0 ||
          transition.standardTechDelta > 0 ||
          transition.advancedTechDelta > 0 ||
          transition.federationReadinessDelta > 0 ||
          transition.reserveGain > 0
      );
      const orientation = actor === Player.Player1 ? 1 : -1;
      for (let index = 0; index < evaluated.length; index += 1) {
        const transition = evaluateResearchPlanTransition(
          engine,
          evaluated[index].destination,
          actor,
          decision.researchTarget,
          evaluated[index].macro.mainCommand,
          productiveAlternative,
          { federationActionAvailable }
        );
        evaluated[index].transition = transition;
        evaluated[index].value = evaluated[index].heuristic.value + orientation * transition.score;
      }
    }

    const productivePassPenalty = this.options.productivePassPenalty ?? 0;
    if (strategyTempoApplies(engine) && productivePassPenalty > 0) {
      const preliminary = evaluated.map((candidate) =>
        evaluateStrategyTempoTransition(
          engine,
          candidate.destination,
          actor,
          candidate.macro.mainCommand,
          false,
          productivePassPenalty
        )
      );
      const productiveAlternative = preliminary.some((transition) => transition.productive);
      const orientation = actor === Player.Player1 ? 1 : -1;
      for (let index = 0; index < evaluated.length; index += 1) {
        const tempo = evaluateStrategyTempoTransition(
          engine,
          evaluated[index].destination,
          actor,
          evaluated[index].macro.mainCommand,
          productiveAlternative,
          productivePassPenalty
        );
        evaluated[index].tempo = tempo;
        evaluated[index].value += orientation * tempo.score;
      }
    }

    if (this.options.economyPlanning && economyPlanApplies(engine)) {
      const bundle = roundActionBudget(engine, actor, decision.plan, decision.researchTarget);
      const productiveAlternative = evaluated.some(
        (candidate) =>
          evaluateEconomyPlanTransition(
            engine,
            candidate.destination,
            actor,
            candidate.macro.mainCommand,
            bundle,
            false
          ).durableProgress
      );
      const orientation = actor === Player.Player1 ? 1 : -1;
      for (let index = 0; index < evaluated.length; index += 1) {
        const economy = evaluateEconomyPlanTransition(
          engine,
          evaluated[index].destination,
          actor,
          evaluated[index].macro.mainCommand,
          bundle,
          productiveAlternative
        );
        evaluated[index].economy = economy;
        evaluated[index].value += orientation * economy.score;
      }
    }

    const best = chooseFixedFrame(actor, evaluated);
    return {
      bot: this.name,
      macroSet,
      macro: best.macro,
      evaluation: {
        schemaVersion: STRATEGY_PLAN_BOT_SCHEMA,
        value: best.value,
        heuristic: best.heuristic,
        activePlan: decision.plan,
        researchTarget: decision.researchTarget,
        planDecision: decision.reason,
        planCandidates: decision.candidates,
        transition: best.transition,
        tempo: best.tempo,
        economy: best.economy,
      },
    };
  }
}
