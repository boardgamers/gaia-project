import {
  AnyTechTile,
  AnyTechTilePos,
  ArtifactToken,
  BoardAction,
  Booster,
  Building,
  Command,
  Faction,
  Federation,
  Phase,
  Planet,
  Player,
  ResearchField,
  Resource,
  Spaceship,
  SpaceshipFederation,
  SpaceshipTechTile,
  SubPhase,
  TinkeringTile,
} from "../../enums";
import { BrainstoneDest } from "../../player-data";
import { SpaceshipActionType } from "../../spaceships";

export const ATOMIC_CANDIDATE_SCHEMA = "gaia-ai-atomic-candidate/v1" as const;

export interface ResourceAmount {
  resource: Resource;
  amount: number;
}

/**
 * Fixed resource changes are projected into cost/reward vectors. Event grammar whose amount is
 * conditional or deferred (for example `pt > vp`, `>fed`, or recurring income) remains explicit
 * in `effects` instead of being guessed by the Phase 1.2 layer.
 */
export interface CandidateResourceFlow {
  cost: ResourceAmount[];
  reward: ResourceAmount[];
  effects: string[];
}

export interface CandidateRangeMetadata {
  distance: number | null;
  baseRange: number | null;
  temporaryRange: number;
  qic: number;
  adjustments: string[];
}

export interface CandidateTerraformMetadata {
  steps: number;
  temporarySteps: number;
  consumesAsteroidGaiaformer: boolean;
}

export interface CandidateSatelliteMetadata {
  allHexes: string[];
  satelliteHexes: string[];
  newSatelliteHexes: string[];
  existingFederationHexes: string[];
}

export interface AtomicCandidateBase<C extends Command, T> {
  schemaVersion: typeof ATOMIC_CANDIDATE_SCHEMA;
  key: string;
  command: C;
  actor: Player;
  phase: Phase;
  subphase: SubPhase | null;
  target: T;
  resources: CandidateResourceFlow;
  warnings: string[];
  /** Executable command part without the actor prefix or preceding dot-separated parts. */
  moveFragment: string;
}

export type ActionCandidate = AtomicCandidateBase<Command.Action, { boardAction: BoardAction }>;

export type BrainStoneCandidate = AtomicCandidateBase<Command.BrainStone, { destination: BrainstoneDest }>;

export type BuildCandidate = AtomicCandidateBase<
  Command.Build,
  {
    building: Building;
    coordinates: string;
    planet: Planet | null;
    upgrade: boolean;
    downgrade: boolean;
    range: CandidateRangeMetadata;
    terraform: CandidateTerraformMetadata;
  }
>;

export type BurnPowerCandidate = AtomicCandidateBase<Command.BurnPower, { amount: number }>;

export type ChargePowerCandidate = AtomicCandidateBase<Command.ChargePower, { offer: string }>;

export type ChooseArtifactTokenCandidate = AtomicCandidateBase<
  Command.ChooseArtifactToken,
  { artifact: ArtifactToken; noEffect: boolean }
>;

export type ChooseCoverTechTileCandidate = AtomicCandidateBase<
  Command.ChooseCoverTechTile,
  { position: AnyTechTilePos | Spaceship; tile: AnyTechTile | SpaceshipTechTile }
>;

export type ChooseFactionCandidate = AtomicCandidateBase<Command.ChooseFaction, { faction: Faction }>;

export type ChooseFederationTileCandidate = AtomicCandidateBase<
  Command.ChooseFederationTile,
  { federation: Federation | SpaceshipFederation; rescore: boolean }
>;

export type ChooseIncomeCandidate = AtomicCandidateBase<Command.ChooseIncome, { income: string }>;

export type ChooseRoundBoosterCandidate = AtomicCandidateBase<Command.ChooseRoundBooster, { booster: Booster }>;

export type ChooseTechTileCandidate = AtomicCandidateBase<
  Command.ChooseTechTile,
  { position: AnyTechTilePos | Spaceship; tile: AnyTechTile | SpaceshipTechTile }
>;

export type ChooseTinkeringTileCandidate = AtomicCandidateBase<Command.ChooseTinkeringTile, { tile: TinkeringTile }>;

export type DeclineCandidate = AtomicCandidateBase<Command.Decline, { offers: string[] }>;

export type EndTurnCandidate = AtomicCandidateBase<Command.EndTurn, Record<string, never>>;

export type ExamineArtifactCandidate = AtomicCandidateBase<Command.ExamineArtifact, { ship: Spaceship.Twilight }>;

export type ExploreCandidate = AtomicCandidateBase<
  Command.Explore,
  {
    ship: Spaceship;
    coordinates: string;
    slot: number;
    charge: number;
    range: CandidateRangeMetadata;
  }
>;

export type FormFederationCandidate = AtomicCandidateBase<
  Command.FormFederation,
  {
    federation: Federation | SpaceshipFederation;
    spaceship: Spaceship | null;
    hexes: string[];
    satellites: CandidateSatelliteMetadata;
  }
>;

export type GaiaFormTransdimCandidate = AtomicCandidateBase<
  Command.GaiaFormTransdim,
  { coordinates: string; planet: Planet.Transdim }
>;

export type PassCandidate = AtomicCandidateBase<Command.Pass, { booster: Booster | null }>;

export type PISwapCandidate = AtomicCandidateBase<
  Command.PISwap,
  { coordinates: string; from: Building.Mine; to: Building.PlanetaryInstitute }
>;

export type PlaceLostPlanetCandidate = AtomicCandidateBase<
  Command.PlaceLostPlanet,
  { coordinates: string; planet: Planet.Lost; range: CandidateRangeMetadata }
>;

export type PlacePowerRingCandidate = AtomicCandidateBase<Command.PlacePowerRing, { coordinates: string }>;

export type SpecialCandidate = AtomicCandidateBase<Command.Special, { income: string; eventSpec: string }>;

export type SpendCandidate = AtomicCandidateBase<
  Command.Spend,
  {
    cost: string;
    income: string;
    multiplier: number;
    allowedMultipliers: number[];
    hidden: boolean;
  }
>;

export type SpaceshipActionCandidate = AtomicCandidateBase<
  Command.SpaceshipAction,
  { ship: Spaceship; action: SpaceshipActionType }
>;

export type UpgradeResearchCandidate = AtomicCandidateBase<
  Command.UpgradeResearch,
  { field: ResearchField; from: number; to: number }
>;

/** Every executable command family in the standard-flow Lost Fleet Phase 1.2 boundary. */
export type AtomicDecisionCandidate =
  | ActionCandidate
  | BrainStoneCandidate
  | BuildCandidate
  | BurnPowerCandidate
  | ChargePowerCandidate
  | ChooseArtifactTokenCandidate
  | ChooseCoverTechTileCandidate
  | ChooseFactionCandidate
  | ChooseFederationTileCandidate
  | ChooseIncomeCandidate
  | ChooseRoundBoosterCandidate
  | ChooseTechTileCandidate
  | ChooseTinkeringTileCandidate
  | DeclineCandidate
  | EndTurnCandidate
  | ExamineArtifactCandidate
  | ExploreCandidate
  | FormFederationCandidate
  | GaiaFormTransdimCandidate
  | PassCandidate
  | PISwapCandidate
  | PlaceLostPlanetCandidate
  | PlacePowerRingCandidate
  | SpecialCandidate
  | SpendCandidate
  | SpaceshipActionCandidate
  | UpgradeResearchCandidate;

export interface CandidateDeduplication {
  key: string;
  command: AtomicDecisionCandidate["command"];
  occurrences: number;
  reason: "identical-semantic-option" | "decline-ignores-offer";
}

export interface AtomicDecisionExpansion {
  candidates: AtomicDecisionCandidate[];
  deduplications: CandidateDeduplication[];
}
