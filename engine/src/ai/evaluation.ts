import { boardActions } from "../actions";
import { ISOLATED_DISTANCE } from "../available/types";
import Engine from "../engine";
import {
  ArtifactToken,
  BoardAction,
  Building,
  Command,
  Condition,
  Operator,
  Phase,
  Player as PlayerEnum,
  PowerArea,
  ResearchField,
  Resource,
} from "../enums";
import Player from "../player";
import Reward from "../reward";
import { EXPLORATION_CHARGE_TRACK, shipsInPlay, spaceshipBoards } from "../spaceships";
import { boosterEvents } from "../tiles/boosters";
import { finalScoringNeutralPlayer, roundScoringEvents } from "../tiles/scoring";
import { isAdvanced, isSpaceshipTechTile } from "../tiles/techs";
import { CommittedTurnMacro } from "./actions/turn-builder";
import { scoreSetupMinePlacement, scoreSetupPlacements } from "./setup-placement";

export const HEURISTIC_EVALUATION_SCHEMA = "gaia-ai-heuristic-evaluation/v1" as const;

/**
 * Public, stable feature names are the ablation surface. A feature is disabled by name, with no
 * hidden coupling to the other terms. Values are always oriented once at the report boundary as
 * seat 0 minus seat 1; callers never negate a value merely because the actor changed.
 */
export const HEURISTIC_FEATURES = [
  "current-score",
  "resource-stock",
  "projected-income-credit",
  "projected-income-ore",
  "projected-income-knowledge",
  "projected-income-qic",
  "projected-income-power",
  "building-supply-uncovered-income",
  "setup-placement-opportunity",
  "round-tile-timing",
  "space-sector-progress",
  "deep-space-sector-progress",
  "gaia-pipeline",
  "research-level-3-5-races",
  "advanced-tech-prerequisites",
  "standard-tech-cover-opportunity-cost",
  "shared-power-ship-action-availability",
  "booster-value-pass-order",
  "power-bowl-capacity",
  "leech-marginal",
  "trading-station-adjacency-charge",
  "federation-current-option-value",
  "lost-planet-value",
  "ship-exploration-value",
  "artifact-value",
  "ship-tech-value",
  "ship-federation-value",
  "final-scoring-projection",
  "endgame-leftover-conversion",
] as const;

export type HeuristicFeature = (typeof HEURISTIC_FEATURES)[number];

export interface HeuristicEvaluationOptions {
  disabledFeatures?: readonly HeuristicFeature[];
  weights?: Partial<Record<HeuristicFeature, number>>;
  /** Optional committed edge context for exact leech and Trading Station marginal terms. */
  transition?: {
    source: Engine;
    macro: CommittedTurnMacro;
  };
}

export interface HeuristicFeatureContribution {
  feature: HeuristicFeature;
  enabled: boolean;
  weight: number;
  seat0: number;
  seat1: number;
  rawMargin: number;
  contribution: number;
  details?: Record<string, number | string | boolean | null>;
}

export interface HeuristicEvaluationReport {
  schemaVersion: typeof HEURISTIC_EVALUATION_SCHEMA;
  terminal: boolean;
  terminalScoreMargin: number | null;
  heuristicValue: number;
  /** Exact final margin at EndGame; otherwise the sum of enabled feature contributions. */
  value: number;
  features: HeuristicFeatureContribution[];
}

interface FeatureMeasurement {
  seats: [number, number];
  details?: Record<string, number | string | boolean | null>;
}

export const DEFAULT_HEURISTIC_WEIGHTS: Readonly<Record<HeuristicFeature, number>> = {
  "current-score": 1,
  "resource-stock": 1,
  "projected-income-credit": 0.22,
  "projected-income-ore": 0.8,
  "projected-income-knowledge": 1,
  "projected-income-qic": 1.2,
  "projected-income-power": 0.13,
  "building-supply-uncovered-income": 0.55,
  "setup-placement-opportunity": 1,
  "round-tile-timing": 0.7,
  "space-sector-progress": 1.25,
  "deep-space-sector-progress": 1.5,
  "gaia-pipeline": 0.75,
  "research-level-3-5-races": 0.65,
  "advanced-tech-prerequisites": 0.8,
  "standard-tech-cover-opportunity-cost": 0.7,
  "shared-power-ship-action-availability": 0.45,
  "booster-value-pass-order": 0.65,
  "power-bowl-capacity": 0.18,
  "leech-marginal": 1,
  "trading-station-adjacency-charge": 1,
  "federation-current-option-value": 0.7,
  "lost-planet-value": 2.5,
  "ship-exploration-value": 0.9,
  "artifact-value": 1,
  "ship-tech-value": 1.2,
  "ship-federation-value": 1.4,
  "final-scoring-projection": 0.45,
  "endgame-leftover-conversion": 0.85,
};

const RESOURCE_STOCK_VALUES: Record<string, number> = {
  [Resource.Credit]: 0.22,
  [Resource.Ore]: 0.8,
  [Resource.Knowledge]: 1,
  [Resource.Qic]: 1.2,
};

function players(engine: Engine): [Player, Player] {
  return [engine.player(PlayerEnum.Player1), engine.player(PlayerEnum.Player2)];
}

function paired(engine: Engine, measure: (player: Player) => number): [number, number] {
  const pair = players(engine);
  return [measure(pair[0]), measure(pair[1])];
}

/** Fixed-frame orientation helper, exported so sign behavior can be locked independently. */
export function orientSeatValues(seat0: number, seat1: number): number {
  return seat0 - seat1;
}

/** Exact utility contract for a finished two-player challenge game. */
export function terminalUtility(engine: Engine): number {
  return orientSeatValues(
    engine.player(PlayerEnum.Player1).data.victoryPoints,
    engine.player(PlayerEnum.Player2).data.victoryPoints
  );
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

function projectedIncome(player: Player, engine: Engine, resource: Resource): number {
  return player.resourceIncome(resource) * remainingIncomePhases(engine);
}

function resourceStock(player: Player): number {
  const data = player.data;
  return (
    data.credits * RESOURCE_STOCK_VALUES[Resource.Credit] +
    data.ores * RESOURCE_STOCK_VALUES[Resource.Ore] +
    data.knowledge * RESOURCE_STOCK_VALUES[Resource.Knowledge] +
    data.qics * RESOURCE_STOCK_VALUES[Resource.Qic] +
    data.power.area1 * 0.05 +
    data.power.area2 * 0.12 +
    data.power.area3 * 0.3 +
    data.power.gaia * 0.08
  );
}

function buildingSupplyAndIncome(player: Player): number {
  const data = player.data;
  const placed =
    data.buildings[Building.Mine] * 0.8 +
    data.buildings[Building.TradingStation] * 1.3 +
    data.buildings[Building.ResearchLab] * 1.6 +
    data.buildings[Building.PlanetaryInstitute] * 2.4 +
    (data.buildings[Building.Academy1] + data.buildings[Building.Academy2]) * 2.2;
  const minesLeft = player.maxBuildings(Building.Mine) - data.buildings[Building.Mine];
  const tradingStationsLeft = player.maxBuildings(Building.TradingStation) - data.buildings[Building.TradingStation];
  const labsLeft = player.maxBuildings(Building.ResearchLab) - data.buildings[Building.ResearchLab];
  const supplyFlexibility =
    (minesLeft > 0 ? Math.min(minesLeft, 2) * 0.35 : -2) +
    (tradingStationsLeft > 0 ? 0.4 : -0.8) +
    (labsLeft > 0 ? 0.3 : -0.6);
  return placed + supplyFlexibility;
}

function setupPlacementOpportunity(
  engine: Engine,
  transition?: HeuristicEvaluationOptions["transition"]
): FeatureMeasurement {
  if (engine.round > 0) {
    return { seats: [0, 0] };
  }
  const placementScores = players(engine).map((player) => scoreSetupPlacements(engine, player));
  const seats: [number, number] = [placementScores[0].total, placementScores[1].total];
  if (
    !transition ||
    transition.source.phase !== Phase.SetupBuilding ||
    transition.macro.mainCommand !== Command.Build
  ) {
    return { seats };
  }

  const actor = transition.macro.actor;
  const priorCoordinates = new Set(transition.source.player(actor).data.occupied.map((hex) => hex.toString()));
  const placed = engine.player(actor).data.occupied.find((hex) => !priorCoordinates.has(hex.toString()));
  if (!placed) {
    return { seats };
  }
  const score = scoreSetupMinePlacement(engine, engine.player(actor), placed.toString());
  return {
    seats,
    details: {
      actor,
      coordinates: placed.toString(),
      shipAccess: score.shipAccess,
      opponentColorAccess: score.opponentColorAccess,
      gaiaAccess: score.gaiaAccess,
      asteroidAccess: score.asteroidAccess,
      oneStepColorAccess: score.oneStepColorAccess,
      nearbyPlanetDensity: score.nearbyPlanetDensity,
      placementTotal: score.total,
    },
  };
}

function conditionPotential(player: Player, condition: Condition): number {
  const data = player.data;
  switch (condition) {
    case Condition.Mine:
    case Condition.NewSector:
    case Condition.NewPlanetType:
      return Math.min(Math.max(player.maxBuildings(Building.Mine) - data.buildings[Building.Mine], 0), 2);
    case Condition.MineOnGaia:
      return Math.min(data.buildings[Building.GaiaFormer] + data.gaiaformersInGaia + 1, 2);
    case Condition.TradingStation:
      return Math.min(data.buildings[Building.Mine], 2);
    case Condition.ResearchLab:
      return Math.min(data.buildings[Building.TradingStation], 2);
    case Condition.BigBuilding:
      return Math.min(data.buildings[Building.TradingStation] + data.buildings[Building.ResearchLab], 1);
    case Condition.AdvanceResearch:
      return Math.min(Math.floor(data.knowledge / 4) + 1, 2);
    case Condition.TerraformStep:
      return Math.min(Math.floor(data.ores / 2) + data.temporaryStep, 3);
    default:
      return player.eventConditionCount(condition);
  }
}

function scoringTilePotential(player: Player, engine: Engine): number {
  if (engine.round <= 0 || engine.round > engine.tiles.scorings.round.length) {
    return 0;
  }
  let value = 0;
  for (let round = engine.round; round <= engine.tiles.scorings.round.length; round += 1) {
    const tile = engine.tiles.scorings.round[round - 1];
    const distance = round - engine.round;
    const timing = distance === 0 ? 1 : 0.18 / distance;
    for (const event of roundScoringEvents(tile, round)) {
      const victoryPoints = event.rewards
        .filter((reward) => reward.type === Resource.VictoryPoint)
        .reduce((sum, reward) => sum + reward.count, 0);
      value += victoryPoints * conditionPotential(player, event.condition) * timing;
    }
  }
  return value;
}

function gaiaPipeline(player: Player): number {
  const data = player.data;
  const available = Math.max(
    data.gaiaformers - data.gaiaformersInGaia - data.buildings[Building.GaiaFormer] - data.gaiaformersUsedForAsteroid,
    0
  );
  return (
    player.eventConditionCount(Condition.Gaia) * 2 +
    data.buildings[Building.GaiaFormer] * 1.7 +
    data.gaiaformersInGaia * 1.1 +
    available * 0.6 +
    data.research[ResearchField.GaiaProject] * 0.45
  );
}

function researchRace(player: Player, engine: Engine): number {
  let value = 0;
  for (const field of ResearchField.values(engine.expansions)) {
    const level = player.data.research[field] ?? 0;
    value += level * 0.5;
    value += Math.max(level - 2, 0) * 4;
    if (level === 2) {
      value += 0.8;
    }
    if (level === 4 && player.data.hasGreenFederation()) {
      value += 2.5;
    } else if (level === 5) {
      value += 5;
    }
  }
  return value;
}

function advancedTechPrerequisites(player: Player, engine: Engine): number {
  const green = player.data.hasGreenFederation() ? 1 : 0;
  const enabledStandard = player.data.tiles.techs.filter(
    (tile) => tile.enabled && !isAdvanced(tile.pos) && !isSpaceshipTechTile(tile.tile)
  ).length;
  const eligibleTracks = ResearchField.values(engine.expansions).filter(
    (field) => player.data.research[field] >= 4 && (engine.tiles.techs[`adv-${field}`] as any)?.count !== 0
  ).length;
  return green * (eligibleTracks * 2 + Math.min(enabledStandard, 2) * 0.75) + eligibleTracks * 0.35;
}

function standardTechOpportunity(player: Player): number {
  const penaltyByTile: Record<string, number> = {
    tech1: 1.4,
    tech2: 1.8,
    tech3: 1.2,
    tech4: 0.3,
    tech5: 2.4,
    tech6: 2.6,
    tech7: 1.8,
    tech8: 1.9,
    tech9: 1.1,
    "ship-tech-range": 2.4,
    "ship-tech-terraform": 1.3,
    "ship-tech-resource": 0.3,
  };
  let value = 0;
  for (const tile of player.data.tiles.techs) {
    if (isAdvanced(tile.pos)) {
      continue;
    }
    const tileValue = penaltyByTile[String(tile.tile)] ?? 1;
    value += tile.enabled ? Math.min(tileValue, 1) * 0.15 : -tileValue;
  }
  return value;
}

function sharedActionAvailability(player: Player, engine: Engine): number {
  const boardAccess = BoardAction.values(engine.expansions).reduce((value, action) => {
    if (engine.boardActions[action] !== null && engine.boardActions[action] !== undefined) {
      return value;
    }
    return value + (player.data.canPay(Reward.parse(boardActions[action].cost)) ? 1 : 0);
  }, 0);
  let shipAccess = 0;
  for (const ship of shipsInPlay(engine.expansions, engine.players.length)) {
    if (!player.data.hasExplored(ship)) {
      continue;
    }
    for (const action of spaceshipBoards[ship].actions) {
      const unclaimed =
        engine.spaceshipActions[ship]?.[action.type] === null ||
        engine.spaceshipActions[ship]?.[action.type] === undefined;
      if (unclaimed && player.data.canPay(Reward.parse(action.cost))) {
        shipAccess += 0.6;
      }
    }
  }
  return boardAccess + shipAccess;
}

function boosterAndPassValue(player: Player, engine: Engine): number {
  let value = 0;
  const booster = player.data.tiles.booster;
  if (booster) {
    for (const event of boosterEvents(booster)) {
      if (event.operator === Operator.Pass) {
        const points = event.rewards
          .filter((reward) => reward.type === Resource.VictoryPoint)
          .reduce((sum, reward) => sum + reward.count, 0);
        value += points * player.eventConditionCount(event.condition);
      } else if (event.operator === Operator.Activate) {
        value += 1.2;
      }
    }
  }
  const passIndex = (engine.passedPlayers ?? []).indexOf(player.player);
  if (passIndex >= 0) {
    value += (engine.players.length - passIndex) * 0.7;
  }
  return value;
}

function bowlCapacity(player: Player): number {
  const brainstone = player.data.brainstone;
  const brainstoneCapacity = brainstone === PowerArea.Area1 ? 2 : brainstone === PowerArea.Area2 ? 1 : 0;
  return player.data.power.area1 * 2 + player.data.power.area2 + brainstoneCapacity;
}

function powerChargeProgress(player: Player): number {
  const brainstone = player.data.brainstone;
  const brainstoneProgress = brainstone === PowerArea.Area2 ? 1 : brainstone === PowerArea.Area3 ? 2 : 0;
  return player.data.power.area2 + player.data.power.area3 * 2 + brainstoneProgress;
}

function challengeSeat(player: PlayerEnum): 0 | 1 {
  if (player !== PlayerEnum.Player1 && player !== PlayerEnum.Player2) {
    throw new Error(`AI-6 evaluator supports only the fixed two-player challenge, got player ${player}`);
  }
  return player as 0 | 1;
}

function leechMarginal(engine: Engine, transition?: HeuristicEvaluationOptions["transition"]): FeatureMeasurement {
  const seats: [number, number] = [0, 0];
  if (!transition || transition.source.phase !== Phase.RoundLeech) {
    return { seats };
  }
  const actor = transition.macro.actor;
  const sourcePlayer = transition.source.player(actor);
  const destinationPlayer = engine.player(actor);
  const charged = Math.max(powerChargeProgress(destinationPlayer) - powerChargeProgress(sourcePlayer), 0);
  const victoryPointCost = Math.max(sourcePlayer.data.victoryPoints - destinationPlayer.data.victoryPoints, 0);
  // The exact VP cost is already present in current-score. This term adds only the measured bowl
  // benefit, while reporting both sides of the marginal explicitly for audit.
  seats[challengeSeat(actor)] = charged * 0.45;
  return {
    seats,
    details: {
      actor,
      command: transition.macro.mainCommand,
      offered: sourcePlayer.data.leechPossible ?? 0,
      charged,
      victoryPointCost,
      netPointEquivalentIncludingScore: charged * 0.45 - victoryPointCost,
    },
  };
}

function tradingStationMarginal(
  engine: Engine,
  transition?: HeuristicEvaluationOptions["transition"]
): FeatureMeasurement {
  const seats: [number, number] = [0, 0];
  if (!transition || transition.macro.mainCommand !== Command.Build) {
    return { seats };
  }
  const actor = transition.macro.actor;
  const sourcePlayer = transition.source.player(actor);
  const destinationPlayer = engine.player(actor);
  const upgraded = sourcePlayer.data.occupied.find((hex) => {
    const destination = engine.map.getS(hex.toString());
    return hex.buildingOf(actor) === Building.Mine && destination.buildingOf(actor) === Building.TradingStation;
  });
  if (!upgraded) {
    return { seats };
  }
  const opponent = actor === PlayerEnum.Player1 ? PlayerEnum.Player2 : PlayerEnum.Player1;
  const adjacentOpponent = transition.source
    .player(opponent)
    .data.occupied.some(
      (hex) => hex.hasStructure() && transition.source.map.distance(hex, upgraded) < ISOLATED_DISTANCE
    );
  const discountCredits = adjacentOpponent ? 3 : 0;
  const opponentChargeOffer = engine.player(opponent).data.leechPossible ?? 0;
  seats[challengeSeat(actor)] = discountCredits * RESOURCE_STOCK_VALUES[Resource.Credit] - opponentChargeOffer * 0.18;
  return {
    seats,
    details: {
      actor,
      coordinates: upgraded.toString(),
      adjacentOpponent,
      discountCredits,
      opponentChargeOffer,
      destinationCredits: destinationPlayer.data.credits,
    },
  };
}

function federationValue(player: Player): number {
  const data = player.data;
  const current = (data.tiles.federations.length + data.spaceshipFederations.length) * 3;
  const green =
    data.tiles.federations.filter((tile) => tile.green).length +
    data.spaceshipFederations.filter((tile) => tile.green).length;
  const target = player.federationCost;
  const progress = target > 0 ? Math.min(player.fedValue / target, 1) : 0;
  const unfederatedStructureValue = Math.max(player.structureValue - player.fedValue, 0);
  return current + green * 1.5 + progress * 3 + Math.min(unfederatedStructureValue / Math.max(target, 1), 1.5);
}

function shipExplorationValue(player: Player, engine: Engine): number {
  let value = 0;
  for (const ship of shipsInPlay(engine.expansions, engine.players.length)) {
    const slot = player.data.explorationShips[ship];
    if (slot !== undefined) {
      value += 3 + (EXPLORATION_CHARGE_TRACK[slot - 1] ?? 0) * 0.45;
    }
  }
  return value;
}

function artifactValue(player: Player): number {
  const dynamic: Record<string, number> = {
    [ArtifactToken.Power]: 2.5,
    [ArtifactToken.Asteroid]: 2,
    [ArtifactToken.Protoplanet]: 2,
    [ArtifactToken.ResearchLevel]: 2.5,
    [ArtifactToken.ResearchTracks]: 2.5,
    [ArtifactToken.Federation]: 2.5,
    [ArtifactToken.GaiaProject]: 2.2,
    [ArtifactToken.PlanetTypes]: 2.2,
    [ArtifactToken.DeepSpace]: 2.2,
  };
  return (
    player.data.artifacts.reduce((sum, artifact) => sum + (dynamic[artifact] ?? 0.7), 0) +
    player.data.artifactPlanetTypes.length
  );
}

function projectedFinalScoring(engine: Engine): [number, number] {
  const pair = players(engine);
  const scores: [number, number] = [0, 0];
  const victoryPoints = [18, 12, 6, 0, 0, 0];
  for (const tile of engine.tiles.scorings.final) {
    const counts = pair.map((player) => player.finalCount(tile));
    const ranking = counts.map((count, index) => ({ index, count }));
    if (engine.players.length === 2) {
      ranking.push({ index: -1, count: finalScoringNeutralPlayer(tile, engine.expansions) });
    }
    ranking.sort((left, right) => right.count - left.count || left.index - right.index);
    for (let seat = 0; seat < pair.length; seat += 1) {
      const count = counts[seat];
      if (count <= 0) {
        continue;
      }
      const first = ranking.findIndex((entry) => entry.count === count);
      const ties = ranking.filter((entry) => entry.count === count).length;
      const points = victoryPoints.slice(first, first + ties).reduce((sum, value) => sum + value, 0);
      scores[seat] += Math.floor(points / ties);
    }
  }
  return scores;
}

/** Exact projection of PlayerData.finalResourceHandling() without mutating the evaluated state. */
export function projectedEndgameResourceVictoryPoints(player: Player): number {
  const data = player.data;
  const burnable = data.burnablePower();
  let area3 = data.power.area3;
  let brainstone = data.brainstone;
  if (burnable > 0) {
    if (brainstone === PowerArea.Area2) {
      brainstone = PowerArea.Area3;
      area3 += burnable - 1;
    } else {
      area3 += burnable;
    }
  }
  const spendable = Math.floor(area3 * data.tokenModifier) + (brainstone === PowerArea.Area3 ? 3 : 0);
  const credits = Math.min(30, data.credits + spendable);
  const ores = Math.min(15, data.ores + data.qics);
  return Math.floor((credits + ores + data.knowledge) / 3);
}

function featureMeasurement(
  feature: HeuristicFeature,
  engine: Engine,
  transition?: HeuristicEvaluationOptions["transition"]
): FeatureMeasurement {
  switch (feature) {
    case "current-score":
      return { seats: paired(engine, (player) => player.data.victoryPoints) };
    case "resource-stock":
      return { seats: paired(engine, resourceStock) };
    case "projected-income-credit":
      return { seats: paired(engine, (player) => projectedIncome(player, engine, Resource.Credit)) };
    case "projected-income-ore":
      return { seats: paired(engine, (player) => projectedIncome(player, engine, Resource.Ore)) };
    case "projected-income-knowledge":
      return { seats: paired(engine, (player) => projectedIncome(player, engine, Resource.Knowledge)) };
    case "projected-income-qic":
      return { seats: paired(engine, (player) => projectedIncome(player, engine, Resource.Qic)) };
    case "projected-income-power":
      return {
        seats: paired(
          engine,
          (player) =>
            (player.resourceIncome(Resource.ChargePower) +
              player.resourceIncome(Resource.GainToken) +
              player.resourceIncome(Resource.GainTokenArea3)) *
            remainingIncomePhases(engine)
        ),
      };
    case "building-supply-uncovered-income":
      return { seats: paired(engine, buildingSupplyAndIncome) };
    case "setup-placement-opportunity":
      return setupPlacementOpportunity(engine, transition);
    case "round-tile-timing":
      return { seats: paired(engine, (player) => scoringTilePotential(player, engine)) };
    case "space-sector-progress":
      return { seats: paired(engine, (player) => player.eventConditionCount(Condition.Sector)) };
    case "deep-space-sector-progress":
      return { seats: paired(engine, (player) => player.eventConditionCount(Condition.DeepSpaceSector)) };
    case "gaia-pipeline":
      return { seats: paired(engine, gaiaPipeline) };
    case "research-level-3-5-races":
      return { seats: paired(engine, (player) => researchRace(player, engine)) };
    case "advanced-tech-prerequisites":
      return { seats: paired(engine, (player) => advancedTechPrerequisites(player, engine)) };
    case "standard-tech-cover-opportunity-cost":
      return { seats: paired(engine, standardTechOpportunity) };
    case "shared-power-ship-action-availability":
      return { seats: paired(engine, (player) => sharedActionAvailability(player, engine)) };
    case "booster-value-pass-order":
      return { seats: paired(engine, (player) => boosterAndPassValue(player, engine)) };
    case "power-bowl-capacity":
      return { seats: paired(engine, bowlCapacity) };
    case "leech-marginal":
      return leechMarginal(engine, transition);
    case "trading-station-adjacency-charge":
      return tradingStationMarginal(engine, transition);
    case "federation-current-option-value":
      return { seats: paired(engine, federationValue) };
    case "lost-planet-value":
      return { seats: paired(engine, (player) => player.data.lostPlanet) };
    case "ship-exploration-value":
      return { seats: paired(engine, (player) => shipExplorationValue(player, engine)) };
    case "artifact-value":
      return { seats: paired(engine, artifactValue) };
    case "ship-tech-value":
      return {
        seats: paired(
          engine,
          (player) => player.data.tiles.techs.filter((tile) => isSpaceshipTechTile(tile.tile)).length
        ),
      };
    case "ship-federation-value":
      return { seats: paired(engine, (player) => player.data.spaceshipFederations.length) };
    case "final-scoring-projection":
      return { seats: projectedFinalScoring(engine) };
    case "endgame-leftover-conversion":
      return { seats: paired(engine, projectedEndgameResourceVictoryPoints) };
  }
}

export function evaluateHeuristic(engine: Engine, options: HeuristicEvaluationOptions = {}): HeuristicEvaluationReport {
  const disabled = new Set(options.disabledFeatures ?? []);
  const features = HEURISTIC_FEATURES.map((feature): HeuristicFeatureContribution => {
    const measurement = featureMeasurement(feature, engine, options.transition);
    const weight = options.weights?.[feature] ?? DEFAULT_HEURISTIC_WEIGHTS[feature];
    const rawMargin = orientSeatValues(measurement.seats[0], measurement.seats[1]);
    const enabled = !disabled.has(feature);
    return {
      feature,
      enabled,
      weight,
      seat0: measurement.seats[0],
      seat1: measurement.seats[1],
      rawMargin,
      contribution: enabled ? rawMargin * weight : 0,
      details: measurement.details,
    };
  });
  const heuristicValue = features.reduce((sum, feature) => sum + feature.contribution, 0);
  const terminalScoreMargin = engine.ended ? terminalUtility(engine) : null;
  return {
    schemaVersion: HEURISTIC_EVALUATION_SCHEMA,
    terminal: engine.ended,
    terminalScoreMargin,
    heuristicValue,
    value: terminalScoreMargin === null ? heuristicValue : terminalScoreMargin,
    features,
  };
}
