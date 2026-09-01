import { EngineOptions } from "../engine";
import { Faction, Player } from "../enums";
import { ChallengeDefinition } from "./types";

const CHALLENGE_OPTIONS: EngineOptions = {
  lostFleet: true,
  officialCenterSectors: false,
  advancedRules: false,
  customBoardSetup: false,
  noFedCheck: false,
  flexibleFederations: false,
  banPhase: false,
  factionVariant: "standard",
  factionVariantVersion: 0,
  layout: "standard",
  randomFactions: false,
};

/**
 * Immutable Phase 0 challenge definition. Pass `challengeEngineOptions()` to Engine because Engine
 * intentionally mutates the options object it receives while initializing a game.
 */
export const LOST_FLEET_CHALLENGE: ChallengeDefinition = {
  id: "lost-fleet-xenos-hadsch-hallas-lf-mrj5exuu-c680",
  version: "1.0.0",
  schemas: {
    challenge: "gaia-ai-challenge/v1",
    model: "gaia-ai-model/v1",
    engine: "gaia-engine-state/v1",
    feature: "gaia-ai-features/v1",
    manifest: "gaia-ai-challenge-manifest/v1",
  },
  seed: "lf-mrj5exuu-c680",
  playerCount: 2,
  options: CHALLENGE_OPTIONS,
  seats: [
    { seat: 0, player: Player.Player1, playerId: "p1", faction: Faction.Xenos },
    { seat: 1, player: Player.Player2, playerId: "p2", faction: Faction.HadschHallas },
  ],
  fixedTurnOrder: [Player.Player1, Player.Player2],
  scriptedPrefix: ["init 2 lf-mrj5exuu-c680", "p1 faction xenos", "p2 faction hadsch-hallas"],
  scriptedPrefixScope: "initialization-and-faction-choice-only",
  strategicSetupDecisions: ["starting-buildings", "round-boosters"],
};

export function challengeEngineOptions(): EngineOptions {
  return JSON.parse(JSON.stringify(LOST_FLEET_CHALLENGE.options));
}
