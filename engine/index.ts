import { finalRankings, gainFinalScoringVictoryPoints } from "./src/algorithms/scoring";
import { stdBuildingValue } from "./src/buildings";
import Engine from "./src/engine";
import Event from "./src/events";
import SpaceMap, { parseLocation } from "./src/map";
import Player, { BuildWarning, MAX_SATELLITES } from "./src/player";
import PlayerData, { effectiveRange, Power } from "./src/player-data";
import Reward from "./src/reward";

export { boardActions, FreeAction, freeActionConversions } from "./src/actions";
export type { ResourceConversion } from "./src/actions";
export {
  defaultPreferenceSplitBudget,
  isValidPreferenceSplitBudget,
  MAX_PREFERENCE_SPLIT_BUDGET,
  MIN_PREFERENCE_SPLIT_BUDGET,
  MIN_PREFERENCE_SPLIT_PLAYERS,
  PREFERENCE_SPLIT_BUDGET_PER_PLAYER,
  preferenceSplitBidError,
  resolvePreferenceSplitAuction,
  roundVictoryPoints,
} from "./src/algorithms/preference-split-auction";
export type {
  PreferenceSplitAllocation,
  PreferenceSplitBid,
  PreferenceSplitFactionSummary,
  PreferenceSplitResult,
} from "./src/algorithms/preference-split-auction";
export { MAX_SILENT_BID, resolveSilentAuction, silentAuctionBidError } from "./src/algorithms/silent-auction";
export type { SilentAuctionBid, SilentAuctionResult, SilentAuctionStep } from "./src/algorithms/silent-auction";
export { conversionToFreeAction } from "./src/available/actions";
export { canResearchField, canTakeAdvancedTechTile } from "./src/available/research";
// BrainstoneWarning is an enum (runtime value); everything else in this block is type-only, so
// it must re-export via `export type` for per-file ESM transformers (vite dev / rolldown).
export { BrainstoneWarning } from "./src/available/types";
export type {
  AvailableBoardAction,
  AvailableBoardActionData,
  AvailableBuilding,
  AvailableCommand,
  AvailableFederation,
  AvailableFreeAction,
  AvailableFreeActionData,
  AvailableHex,
  AvailableResearchData,
  AvailableResearchTrack,
  BrainstoneActionData,
  ChooseTechTile,
} from "./src/available/types";
export { AuctionVariant } from "./src/engine";
export type { EngineOptions, FactionCustomization, FactionVariant, LogEntry, LogEntryChanges } from "./src/engine";
export {
  AdvTechTile,
  AdvTechTilePos,
  ArtifactToken,
  BoardAction,
  Booster,
  Building,
  Command,
  Condition,
  Expansion,
  Faction,
  Federation,
  FinalTile,
  hasExpansion,
  Operator,
  Phase,
  Planet,
  Player as PlayerEnum,
  PowerArea,
  ResearchField,
  Resource,
  Round,
  RoundScoring,
  ScoringBoardExtensionSide,
  ScoringTile,
  Spaceship,
  SpaceshipFederation,
  SpaceshipTechTile,
  SubPhase,
  TechPos,
  TechTile,
  TechTilePos,
} from "./src/enums";
export { FactionBoard, factionBoard, factionVariantBoard } from "./src/faction-boards";
export { factionPlanet } from "./src/factions";
export { federationCost, parseFederationLocation } from "./src/federation";
export type { FederationInfo } from "./src/federation";
export { GaiaHex } from "./src/gaia-hex";
export type { GaiaHexData } from "./src/gaia-hex";
export { applyChargePowers } from "./src/income";
export { classifySectorId, LostFleetSectorType } from "./src/lost-fleet-map";
export { moveAI } from "./src/move/ai";
export { ANALYSIS_CHEAP_BUILD } from "./src/move/buildings";
export { endSetupFactionPhase, leechPossible } from "./src/move/phase";
export { planetNames, terraformingStepsRequired } from "./src/planets";
export { lastTile, researchEvents } from "./src/research-tracks";
export { SetupType } from "./src/setup";
export type { AvailableSetupOption } from "./src/setup";
export { artifactSlotCount, shipsInPlay, spaceshipBoards } from "./src/spaceships";
export { artifactTokenRewards, artifactTokenSpec } from "./src/tiles/artifacts";
export { finalScorings } from "./src/tiles/scoring";
// Type re-exports must be `export type` for per-file ESM transformers (vite dev / rolldown):
// a plain re-export of a type-only binding becomes a runtime import of a non-existent export.
export type { EventSource } from "./src/events";
export type { BrainstoneDest, MaxLeech } from "./src/player-data";
export {
  BuildWarning,
  effectiveRange,
  Event,
  finalRankings,
  gainFinalScoringVictoryPoints,
  MAX_SATELLITES,
  parseLocation,
  Player,
  PlayerData,
  Power,
  Reward,
  SpaceMap,
  stdBuildingValue,
};

export default Engine;
