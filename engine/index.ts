import { finalRankings, gainFinalScoringVictoryPoints } from "./src/algorithms/scoring";
import { stdBuildingValue } from "./src/buildings";
import Engine from "./src/engine";
import Event, { EventSource } from "./src/events";
import SpaceMap, { parseLocation } from "./src/map";
import Player, { BuildWarning, MAX_SATELLITES } from "./src/player";
import PlayerData, { BrainstoneDest, effectiveRange, MaxLeech, Power } from "./src/player-data";
import Reward from "./src/reward";

export { boardActions, FreeAction, freeActionConversions, ResourceConversion } from "./src/actions";
export {
  MAX_PREFERENCE_SPLIT_BUDGET,
  MIN_PREFERENCE_SPLIT_BUDGET,
  MIN_PREFERENCE_SPLIT_PLAYERS,
  PreferenceSplitAllocation,
  PreferenceSplitBid,
  PreferenceSplitFactionSummary,
  PreferenceSplitResult,
  PREFERENCE_SPLIT_BUDGET_PER_PLAYER,
  defaultPreferenceSplitBudget,
  isValidPreferenceSplitBudget,
  preferenceSplitBidError,
  resolvePreferenceSplitAuction,
  roundVictoryPoints,
} from "./src/algorithms/preference-split-auction";
export {
  MAX_SILENT_BID,
  SilentAuctionBid,
  SilentAuctionResult,
  SilentAuctionStep,
  resolveSilentAuction,
  silentAuctionBidError,
} from "./src/algorithms/silent-auction";
export { conversionToFreeAction } from "./src/available/actions";
export { canResearchField, canTakeAdvancedTechTile } from "./src/available/research";
export { shipsInHex } from "./src/available/ships";
export {
  AvailableBoardAction,
  AvailableBoardActionData,
  AvailableBuilding,
  AvailableCommand,
  AvailableFederation,
  AvailableFreeAction,
  AvailableFreeActionData,
  AvailableHex,
  AvailableMoveShipData,
  AvailableResearchData,
  AvailableResearchTrack,
  BrainstoneActionData,
  BrainstoneWarning,
  ChooseTechTile,
  ShipAction,
} from "./src/available/types";
export {
  AuctionVariant,
  EngineOptions,
  FactionCustomization,
  FactionVariant,
  LogEntry,
  LogEntryChanges,
} from "./src/engine";
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
  isShip,
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
export { federationCost, FederationInfo, parseFederationLocation } from "./src/federation";
export { GaiaHex, GaiaHexData } from "./src/gaia-hex";
export { applyChargePowers } from "./src/income";
export { classifySectorId, LostFleetSectorType } from "./src/lost-fleet-map";
export { leechPossible } from "./src/move/phase";
export { planetNames, terraformingStepsRequired } from "./src/planets";
export { lastTile, researchEvents } from "./src/research-tracks";
export { AvailableSetupOption, SetupType } from "./src/setup";
export { artifactSlotCount, shipsInPlay, spaceshipBoards } from "./src/spaceships";
export { artifactTokenRewards, artifactTokenSpec } from "./src/tiles/artifacts";
export { finalScorings } from "./src/tiles/scoring";
export {
  BrainstoneDest,
  effectiveRange,
  MaxLeech,
  BuildWarning,
  Player,
  PlayerData,
  Event,
  Reward,
  SpaceMap,
  EventSource,
  gainFinalScoringVictoryPoints,
  finalRankings,
  parseLocation,
  stdBuildingValue,
  Power,
  MAX_SATELLITES,
};

export default Engine;
