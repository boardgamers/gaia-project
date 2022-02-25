import Engine from "../engine";
import { Building, Command, Faction, Phase, SubPhase } from "../enums";
import { possibleSetupBoardActions } from "../setup";
import { possibleBoardActions, possibleFreeActions, possibleGaiaFreeActions, possibleSpecialActions } from "./actions";
import {
  possibleBuildings,
  possibleLabDowngrades,
  possibleMineBuildings,
  possiblePISwaps,
  possibleSpaceLostPlanet,
  possibleSpaceStations,
} from "./buildings";
import { possibleFederations, possibleFederationTiles } from "./federations";
import { possibleLeech } from "./leech";
import { possibleCoverTechTiles, possibleResearchAreas, possibleTechTiles } from "./research";
import { possibleIncomes, possibleRoundBoosters } from "./round";
import { chooseFactionOrBid, possibleBids } from "./setup";
import { possibleShipMovements } from "./ships";
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
    case SubPhase.ChooseFederationTile:
      return possibleFederationTiles(engine, player, "pool");
    case SubPhase.RescoreFederationTile:
      return possibleFederationTiles(engine, player, "player");
    case SubPhase.BuildMine:
      return [...possibleMineBuildings(engine, player, false), ...possibleShipMovements(engine, player, true)];
    case SubPhase.BuildMineOrGaiaFormer:
      return possibleMineBuildings(engine, player, true, data);
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
        ...possibleShipMovements(engine, player, false),
        ...possibleFederations(engine, player),
        ...possibleResearchAreas(engine, player, UPGRADE_RESEARCH_COST),
        ...possibleBoardActions(engine.boardActions, engine.player(player), engine.replay),
        ...possibleSpecialActions(engine, player),
        ...possibleFreeActions(engine.player(player)),
        ...possibleRoundBoosters(engine, player),
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
    case Phase.SetupFaction:
      return chooseFactionOrBid(engine, player);
    case Phase.SetupAuction:
      return possibleBids(engine, player);
    case Phase.SetupBuilding: {
      const planet = engine.player(player).planet;
      const buildings = [];

      for (const hex of engine.map.toJSON()) {
        if (hex.data.planet === planet && !hex.data.building) {
          buildings.push({
            building: engine.player(player).faction !== Faction.Ivits ? Building.Mine : Building.PlanetaryInstitute,
            coordinates: hex.toString(),
            cost: "~",
          });
        }
      }

      return [{ name: Command.Build, player, data: { buildings } }];
    }
    case Phase.SetupBooster:
      return possibleRoundBoosters(engine, player);
    case Phase.RoundIncome:
      return possibleIncomes(engine, player);
    case Phase.RoundGaia:
      return possibleGaiaFreeActions(engine, player);
    case Phase.RoundLeech:
      return possibleLeech(engine, player);
  }

  return [];
}
