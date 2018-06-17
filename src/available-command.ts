import { Command, Faction, Building } from './enums';
import Engine from './engine';
import * as _ from 'lodash';
import factions from './factions';
import * as assert from "assert";

export default interface AvailableCommand {
  name: Command;
  data?: any;
  player?: number;
}

export function generate(engine: Engine): AvailableCommand[] {
  if (!engine.map) {
    return [{ name: Command.Init }];
  }

  if (engine.numberOfPlayersWithFactions() < engine.players.length) {
    return [
      {
        name: Command.ChooseFaction,
        player: engine.numberOfPlayersWithFactions(),
        data: _.difference(
          Object.values(Faction),
          engine.players.map(pl => pl.faction),
          engine.players.map(pl => factions.opposite(pl.faction))
        )
      }
    ];
  }

  if (engine.nextPlayerToSetup() !== undefined) {
    const player = engine.nextPlayerToSetup();
    const planet = engine.player(player).planet;
    const buildings = [];

    for (const hex of engine.map.toJSON()) {
      if (hex.data.planet === planet && !hex.data.building) {
        buildings.push({
          building:
            engine.player(player).faction !== Faction.Ivits
              ? Building.Mine
              : Building.PlanetaryInstitute,
          coordinates: hex.toString(),
          cost: '~'
        });
      }
    }

    return [
      {
        name: Command.Build,
        player,
        data: { buildings }
      }
    ];
  }

  // We are in a regular round
  const commands = [];
  const player = engine.currentPlayer;

  assert(player !== undefined, "Problem with the engine, player to play is unknown");

  const data = engine.player(player).data;
  const board = engine.player(player).board;

  // Add building moves
  {
    const planet = engine.player(player).planet;
    const buildings = [];

    for (const hex of engine.map.toJSON()) {
      // Not a planet or Existing building belongs to another player
      if (hex.data.planet !== planet || hex.data.player !== player) {
        continue;
      }

      if (hex.data.building) {
        // See if current building is a mine and can be upgraded to a TS
        if (hex.data.building === Building.Mine) {
          //TODO :check if mine is isolated
          let mineIsIsolated = true;
          const upgCost = mineIsIsolated
            ? board.tradingStations.isolatedCost
            : board.tradingStations.cost;

          if (
            board.tradingStations.income.length <= data.tradingStations + 1 ||
            !data.canPay(upgCost)
          ) {
            // There are already too many tradingStations or not enough to pay
            continue;
          }

          buildings.push({
            upgradedBuilding: Building.Mine,
            building: Building.TradingStation,
            coordinates: hex.toString(),
            cost: upgCost.map(c => c.toString()).join(',')
          });
        }

        if (hex.data.building === Building.TradingStation) {
          if (
            board.researchLabs.income.length > data.researchLabs + 1 &&
            data.canPay(board.researchLabs.cost)
          ) {
            buildings.push({
              upgradedBuilding: Building.TradingStation,
              building: Building.ResearchLab,
              coordinates: hex.toString(),
              cost: board.researchLabs.cost.map(c => c.toString()).join(',')
            });
          }
        }

        // tradingStation to PI or Bescods' researchLabs to PI
        if (
          hex.data.building === Building.TradingStation ||
          (hex.data.building === Building.ResearchLab &&
            engine.player(player).faction == Faction.Bescods)
        ) {
          if (
            !data.platenaryInstitute &&
            data.canPay(board.planetaryInstitute.cost)
          ) {
            buildings.push({
              upgradedBuilding:
                hex.data.building === Building.TradingStation
                  ? Building.TradingStation
                  : Building.ResearchLab,
              building: Building.PlanetaryInstitute,
              coordinates: hex.toString(),
              cost: board.planetaryInstitute.cost
                .map(c => c.toString())
                .join(',')
            });
          }
        }

        // researchLab to AC or Bescods' tradingStation to AC
        if (
          (hex.data.building === Building.TradingStation &&
            engine.player(player).faction == Faction.Bescods) ||
          hex.data.building === Building.ResearchLab
        ) {
          let upgBuild =
            hex.data.building === Building.ResearchLab
              ? Building.ResearchLab
              : Building.TradingStation;

          if (!data.academy1 && data.canPay(board.academy1.cost)) {
            buildings.push({
              upgradedBuilding: upgBuild,
              building: Building.Academy1,
              coordinates: hex.toString(),
              cost: board.academy1.cost.map(c => c.toString()).join(',')
            });
          }
          if (!data.academy2 && data.canPay(board.academy2.cost)) {
            buildings.push({
              upgradedBuilding: upgBuild,
              building: Building.Academy2,
              coordinates: hex.toString(),
              cost: board.academy2.cost.map(c => c.toString()).join(',')
            });
          }
        }
      } else {
        // empty faction planet
        if (
          board.mines.income.length <= data.mines + 1 ||
          !data.canPay(board.mines.cost)
        ) {
          // There are already too many mines
          continue;
        }

        // TODO check if planet is accessable (distance from hex<= player.data.range)

        buildings.push({
          building: Building.Mine,
          coordinates: hex.toString(),
          cost: board.mines.cost.map(c => c.toString()).join(',')
        });
      }
    } //end for hex

    commands.push({
      name: Command.Build,
      player,
      data: { buildings }
    });
  } // end add buildings

  // Give the player the ability to pass
  commands.push({
    name: Command.Pass,
    player
  });

  return commands;
}
