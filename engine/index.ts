import { finalRankings, gainFinalScoringVictoryPoints } from "./src/algorithms/scoring";
import { stdBuildingValue } from "./src/buildings";
import Engine from "./src/engine";
import Event, { EventSource } from "./src/events";
import SpaceMap, { parseLocation } from "./src/map";
import Player, { BuildWarning, MAX_SATELLITES } from "./src/player";
import PlayerData, { BrainstoneDest, MaxLeech, Power } from "./src/player-data";
import Reward from "./src/reward";
import tiles from "./src/tiles";
import federations from "./src/tiles/federations";

export { boardActions, FreeAction, freeActionConversions, ResourceConversion } from "./src/actions";
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
  BoardAction,
  Booster,
  Building,
  Command,
  Condition,
  Expansion,
  Faction,
  Federation,
  FinalTile,
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
  ScoringTile,
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
export { leechPossible } from "./src/move/phase";
export { planetNames, terraformingStepsRequired } from "./src/planets";
export { lastTile, researchEvents } from "./src/research-tracks";
export { AvailableSetupOption, SetupType } from "./src/setup";
export { finalScorings, roundScorings } from "./src/tiles/scoring";
export {
  BrainstoneDest,
  MaxLeech,
  BuildWarning,
  Player,
  PlayerData,
  Event,
  tiles,
  Reward,
  SpaceMap,
  EventSource,
  gainFinalScoringVictoryPoints,
  finalRankings,
  parseLocation,
  federations,
  stdBuildingValue,
  Power,
  MAX_SATELLITES,
};

export default Engine;
