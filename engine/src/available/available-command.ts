import Engine from "../engine";
import { Building, Command, Faction, Phase, SubPhase } from "../enums";
import { possibleSetupBoardActions } from "../setup";
import {
  possibleBoardActions,
  possibleFreeActions,
  possibleGaiaFreeActions,
  possiblePowerRingPlacements,
  possibleSpecialActions,
  possibleTinkeringTiles,
} from "./actions";
import { possibleArtifactTokens, possibleExamineArtifact } from "./artifacts";
import {
  possibleBuildings,
  possibleLabDowngrades,
  possibleMineBuildings,
  possiblePISwaps,
  possibleSpaceLostPlanet,
  possibleSpaceStations,
} from "./buildings";
import { possibleExplorations } from "./exploration";
import {
  possibleFederations,
  possibleFederationTiles,
  possibleFederationTokenBuildMine,
  possibleSpaceshipTechTileBuildMine,
} from "./federations";
import { possibleLeech } from "./leech";
import { possibleCoverTechTiles, possibleResearchAreas, possibleTechTiles } from "./research";
import { possibleIncomes, possibleRoundBoosters } from "./round";
import {
  chooseFactionOrBid,
  possibleBids,
  possibleFactionBans,
  possiblePreferenceBids,
  possibleSilentBids,
} from "./setup";
import { possibleShipMovements } from "./ships";
import {
  possibleInstantGaiaforming,
  possibleSpaceshipActions,
  possibleSpaceshipBuildMine,
  possibleSpaceshipUpgradeBuilding,
} from "./spaceship-actions";
import { AvailableCommand, UPGRADE_RESEARCH_COST } from "./types";

export function generate(engine: Engine, subPhase: SubPhase = null, data?: any): AvailableCommand[] {
  const player = engine.playerToMove;

  if (engine.phase === Phase.RoundMove && !subPhase) {
    subPhase = SubPhase.BeforeMove;
  }

  switch (subPhase) {
    case SubPhase.ChooseTechTile:
      return possibleTechTiles(engine, player);
    case SubPhase.CoverTechTile:
      return possibleCoverTechTiles(engine, player);
    case SubPhase.UpgradeResearch:
      return possibleResearchAreas(engine, player, null, data);
    case SubPhase.PlaceLostPlanet:
      return possibleSpaceLostPlanet(engine, player);
    case SubPhase.InstantGaiaforming:
      return possibleInstantGaiaforming(engine, player);
    case SubPhase.SpaceshipBuildMine:
      return possibleSpaceshipBuildMine(engine, player, data);
    case SubPhase.SpaceshipUpgradeBuilding:
      return possibleSpaceshipUpgradeBuilding(engine, player, data);
    case SubPhase.FederationTokenBuildMine:
      return possibleFederationTokenBuildMine(engine, player, data);
    case SubPhase.SpaceshipTechTileBuildMine:
      return possibleSpaceshipTechTileBuildMine(engine, player);
    case SubPhase.ChooseFederationTile:
      return possibleFederationTiles(engine, player, "pool");
    case SubPhase.RescoreFederationTile:
      return possibleFederationTiles(engine, player, "player");
    case SubPhase.ChooseArtifactToken:
      return possibleArtifactTokens(engine, player);
    case SubPhase.PlacePowerRing:
      return possiblePowerRingPlacements(engine, player);
    case SubPhase.BuildMine:
      return [...possibleMineBuildings(engine, player, false), ...possibleShipMovements(engine, player, true)];
    case SubPhase.BuildMineOrGaiaFormer:
      return [...possibleMineBuildings(engine, player, true, data), ...possibleExplorations(engine, player)];
    case SubPhase.SpaceStation:
      return possibleSpaceStations(engine, player);
    case SubPhase.PISwap:
      return possiblePISwaps(engine, player);
    case SubPhase.DowngradeLab:
      return possibleLabDowngrades(engine, player);
    case SubPhase.BrainStone:
      return [{ name: Command.BrainStone, player, data }];
    // case SubPhase.MoveShip:
    //   return possibleShipMovements(engine, player);
    case SubPhase.BeforeMove: {
      return [
        ...possibleBuildings(engine, player),
        ...possibleExplorations(engine, player),
        ...possibleShipMovements(engine, player, false),
        ...possibleFederations(engine, player),
        ...possibleResearchAreas(engine, player, UPGRADE_RESEARCH_COST),
        ...possibleBoardActions(engine.boardActions, engine.player(player), engine.replay),
        ...possibleSpecialActions(engine, player),
        ...possibleFreeActions(engine.player(player)),
        ...possibleRoundBoosters(engine, player),
        ...possibleSpaceshipActions(engine, player),
        ...possibleExamineArtifact(engine, player),
      ];
    }
    case SubPhase.AfterMove:
      return [...possibleFreeActions(engine.player(player)), { name: Command.EndTurn, player }];
    default:
      break;
  }

  switch (engine.phase) {
    case Phase.SetupInit:
      return [{ name: Command.Init } as AvailableCommand]; //doesn't have player
    case Phase.SetupBoard:
      return possibleSetupBoardActions(engine, player);
    case Phase.SetupFactionBan:
      return possibleFactionBans(engine, player);
    case Phase.SetupFaction:
      return chooseFactionOrBid(engine, player);
    case Phase.SetupAuction:
      return possibleBids(engine, player);
    case Phase.SetupSilentBid:
      return possibleSilentBids(engine, player);
    case Phase.SetupPreferenceBid:
      return possiblePreferenceBids(engine, player);
    case Phase.SetupBuilding: {
      const planet = engine.player(player).planet;
      const faction = engine.player(player).faction;
      const buildings = [];

      for (const hex of engine.map.toJSON()) {
        if (hex.data.planet === planet && !hex.data.building) {
          buildings.push({
            building:
              faction === Faction.Ivits || faction === Faction.Tinkeroids ? Building.PlanetaryInstitute : Building.Mine,
            coordinates: hex.toString(),
            cost: "~",
            // §B1/§B2: starting buildings are placed, not built via the "Build a Mine" action —
            // no Gaiaformer is consumed on a home Asteroid (factions own 0 Gaiaformers at setup).
            consumesAsteroidGaiaformer: false,
          });
        }
      }

      return [{ name: Command.Build, player, data: { buildings } }];
    }
    case Phase.SetupBooster:
      return possibleRoundBoosters(engine, player);
    case Phase.RoundIncome:
      if (engine.player(player).needsTinkeringTileChoice(engine.round)) {
        return possibleTinkeringTiles(engine, player);
      }
      return possibleIncomes(engine, player);
    case Phase.RoundGaia:
      return possibleGaiaFreeActions(engine, player);
    case Phase.RoundLeech:
      return possibleLeech(engine, player);
  }

  return [];
}
