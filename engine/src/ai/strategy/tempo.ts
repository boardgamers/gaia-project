import Engine from "../../engine";
import { Building, Command, Phase, Player as PlayerEnum, ResearchField } from "../../enums";
import Player from "../../player";

export const STRATEGY_TEMPO_SCHEMA = "gaia-ai-strategy-tempo/v1" as const;

export interface StrategyTempoTransitionReport {
  schemaVersion: typeof STRATEGY_TEMPO_SCHEMA;
  command: Command;
  buildingDelta: number;
  researchDelta: number;
  federationDelta: number;
  explorationDelta: number;
  gaiaProjectDelta: number;
  victoryPointDelta: number;
  resourceValueDelta: number;
  productive: boolean;
  productiveAlternative: boolean;
  passPenalty: number;
  score: number;
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

function explorationCount(player: Player): number {
  return Object.keys(player.data.explorationShips).length;
}

function gaiaProjectCount(player: Player): number {
  return player.data.buildings[Building.GaiaFormer] + player.data.gaiaformersInGaia;
}

function resourceValue(player: Player): number {
  const data = player.data;
  return (
    data.credits * 0.22 +
    data.ores * 0.8 +
    data.knowledge +
    data.qics * 1.2 +
    data.power.area1 * 0.05 +
    data.power.area2 * 0.12 +
    data.power.area3 * 0.3
  );
}

export function strategyTempoApplies(engine: Engine): boolean {
  return engine.phase === Phase.RoundMove;
}

/**
 * A transition is productive only when it advances durable board state, scores, or gains a
 * meaningful net resource bundle. Free conversions and no-op stalls do not qualify. The report
 * never rewards an action merely for existing; it only prevents Pass from beating such an action.
 */
export function evaluateStrategyTempoTransition(
  source: Engine,
  destination: Engine,
  actor: PlayerEnum,
  command: Command,
  productiveAlternative: boolean,
  productivePassPenalty = 0
): StrategyTempoTransitionReport {
  const before = source.player(actor);
  const after = destination.player(actor);
  const buildingDelta = Math.max(buildingCount(after, destination) - buildingCount(before, source), 0);
  const researchDelta = Math.max(researchCount(after, destination) - researchCount(before, source), 0);
  const federationDelta = Math.max(federationCount(after) - federationCount(before), 0);
  const explorationDelta = Math.max(explorationCount(after) - explorationCount(before), 0);
  const gaiaProjectDelta = Math.max(gaiaProjectCount(after) - gaiaProjectCount(before), 0);
  const victoryPointDelta = Math.max(after.data.victoryPoints - before.data.victoryPoints, 0);
  const resourceValueDelta = resourceValue(after) - resourceValue(before);
  const productive =
    command !== Command.Pass &&
    (buildingDelta > 0 ||
      researchDelta > 0 ||
      federationDelta > 0 ||
      explorationDelta > 0 ||
      gaiaProjectDelta > 0 ||
      victoryPointDelta > 0 ||
      resourceValueDelta > 0.25);
  const passPenalty = command === Command.Pass && productiveAlternative ? productivePassPenalty : 0;
  return {
    schemaVersion: STRATEGY_TEMPO_SCHEMA,
    command,
    buildingDelta,
    researchDelta,
    federationDelta,
    explorationDelta,
    gaiaProjectDelta,
    victoryPointDelta,
    resourceValueDelta,
    productive,
    productiveAlternative,
    passPenalty,
    score: -passPenalty,
  };
}
