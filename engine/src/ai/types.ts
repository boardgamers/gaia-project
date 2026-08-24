import { EngineOptions } from "../engine";
import { Faction, Player } from "../enums";

export interface AiSchemaVersions {
  challenge: "gaia-ai-challenge/v1";
  model: "gaia-ai-model/v1";
  engine: "gaia-engine-state/v1";
  feature: "gaia-ai-features/v1";
  manifest: "gaia-ai-challenge-manifest/v1";
}

export interface ChallengeSeat {
  seat: 0 | 1;
  player: Player;
  playerId: "p1" | "p2";
  faction: Faction;
}

export interface ChallengeDefinition {
  id: string;
  version: string;
  schemas: AiSchemaVersions;
  seed: string;
  playerCount: 2;
  options: EngineOptions;
  seats: readonly [ChallengeSeat, ChallengeSeat];
  fixedTurnOrder: readonly [Player, Player];
  scriptedPrefix: readonly string[];
  scriptedPrefixScope: "initialization-and-faction-choice-only";
  strategicSetupDecisions: readonly ["starting-buildings", "round-boosters"];
}

export interface BenchmarkConfig {
  warmupIterations: number;
  iterations: number;
  randomGameWarmupIterations: number;
  randomGameIterations: number;
  memoryCloneCount: number;
}
