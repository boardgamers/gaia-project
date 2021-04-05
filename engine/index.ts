import { finalRankings, gainFinalScoringVictoryPoints } from "./src/algorithms/scoring";
import AvailableCommand from "./src/available-command";
import Engine from "./src/engine";
import Event, { EventSource } from "./src/events";
import factionBoards from "./src/faction-boards";
import factions from "./src/factions";
import SpaceMap from "./src/map";
import Player from "./src/player";
import PlayerData from "./src/player-data";
import researchTracks from "./src/research-tracks";
import Reward from "./src/reward";
import tiles from "./src/tiles";
import federations from "./src/tiles/federations";

export { boardActions } from "./src/actions";
export { canResearchField, canTakeAdvancedTechTile } from "./src/available-command";
export { EngineOptions, LogEntry } from "./src/engine";
export {
  AdvTechTile,
  AdvTechTilePos,
  BoardAction,
  Booster,
  BrainstoneArea,
  Building,
  Command,
  Condition,
  Expansion,
  Faction,
  Federation,
  FinalTile,
  Operator,
  Phase,
  Planet,
  Player as PlayerEnum,
  ResearchField,
  Resource,
  Round,
  RoundScoring,
  ScoringTile,
  TechPos,
  TechTile,
  TechTilePos,
} from "./src/enums";
export { FactionBoard, factionBoard } from "./src/faction-boards";
export { GaiaHex, GaiaHexData } from "./src/gaia-hex";
export { planetNames, terraformingStepsRequired } from "./src/planets";
export { finalScorings, roundScorings } from "./src/tiles/scoring";
export {
  Player,
  PlayerData,
  Event,
  factions,
  AvailableCommand,
  tiles,
  Reward,
  SpaceMap,
  researchTracks,
  factionBoards,
  EventSource,
  gainFinalScoringVictoryPoints,
  finalRankings,
  federations,
};

export default Engine;
