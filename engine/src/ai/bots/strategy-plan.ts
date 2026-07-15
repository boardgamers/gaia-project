import Engine from "../../engine";
import { Command, Player, ResearchField } from "../../enums";
import { CommittedTurnMacro } from "../actions/turn-builder";
import { evaluateHeuristic, HeuristicEvaluationOptions, HeuristicEvaluationReport } from "../evaluation";
import {
  assessOpeningPlan,
  evaluateOpeningPlanTransition,
  OpeningPlanAssessment,
  OpeningPlanId,
  OpeningPlanTransitionReport,
  openingPlanApplies,
  rankOpeningPlans,
} from "../strategy/opening-plans";
import {
  assessResearchPlan,
  evaluateResearchPlanTransition,
  rankResearchPlans,
  ResearchPlanAssessment,
  RESEARCH_PLAN_ID,
  ResearchPlanId,
  ResearchPlanTransitionReport,
  researchPlanApplies,
} from "../strategy/research-plan";
import {
  evaluateStrategyTempoTransition,
  StrategyTempoTransitionReport,
  strategyTempoApplies,
} from "../strategy/tempo";
import { applyMacroHostStyle, buildBotMacroSet, chooseFixedFrame } from "./common";
import { MacroBot, MacroBotBuildOptions, MacroBotSelection } from "./types";

export const STRATEGY_PLAN_BOT_SCHEMA = "gaia-ai-strategy-plan-bot/v3" as const;

export interface StrategyPlanMacroBotOptions extends MacroBotBuildOptions {
  evaluation?: Omit<HeuristicEvaluationOptions, "transition">;
  /** Plan switching requires a material priority lead; ordinary fluctuations keep the plan stable. */
  switchThreshold?: number;
  /** Optional diagnostic opportunity cost for Pass; zero preserves the validated plan policy. */
  productivePassPenalty?: number;
  /** Diagnostic only: gate Advanced Tech goals on a Federation formable this exact turn. */
  federationFeasibilityGate?: boolean;
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
}

interface EvaluatedMacro {
  macro: CommittedTurnMacro;
  destination: Engine;
  heuristic: HeuristicEvaluationReport;
  transition: OpeningPlanTransitionReport | ResearchPlanTransitionReport | null;
  tempo: StrategyTempoTransitionReport | null;
  value: number;
}

interface PlanDecision {
  plan: OpeningPlanId | ResearchPlanId | null;
  researchTarget: ResearchField | null;
  reason: string;
  candidates: readonly (OpeningPlanAssessment | ResearchPlanAssessment)[];
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
      return { macro, destination, heuristic, transition: null, tempo: null, value: heuristic.value };
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
      },
    };
  }
}
