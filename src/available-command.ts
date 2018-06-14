import { Command, Faction, Building } from "./enums";
import Engine from "./engine";
import * as _ from 'lodash';
import factions from "./factions";

export default interface AvailableCommand {
  name: Command,
  data?: any,
  player?: number
}

export function generate(engine: Engine): AvailableCommand[] {
  if (!engine.map) {
    return [{name: Command.Init}];
  }

  if (engine.numberOfPlayersWithFactions() < engine.players.length) {
    return [{
      name: Command.ChooseFaction, 
      player: engine.numberOfPlayersWithFactions(), 
      data: _.difference(Object.values(Faction), engine.players.map(pl => pl.faction), engine.players.map(pl => factions.opposite(pl.faction)))
    }];
  }

  if (engine.nextPlayerToSetup() !== undefined) {
    const player = engine.nextPlayerToSetup();
    const planet = engine.player(player).planet;
    const buildings = [];
    
    for (const hex of engine.map.toJSON()) {
      if (hex.data.planet === planet && !hex.data.building) {
        buildings.push({
          building: (engine.player(player).faction !== Faction.Ivits ? Building.Mine : Building.PlanetaryInstitute),
          coordinates: hex.toString(),
          cost: "~"
        });
      }
    }

    return [{
      name: Command.Build, 
      player, 
      data: {buildings}
    }];
  }

  // We are in a regular round
  const commands = [];
  const player = engine.currentPlayer;
  const data = engine.player(player).data;
  const board = engine.player(player).board;

  // Add building moves
  for (const hex of engine.map.toJSON()) {
    const planet = engine.player(player).planet;
    const buildings = [];

    for (const hex of engine.map.toJSON()) {
      if (hex.data.planet !== planet) {
        continue;
      }

      if (hex.data.building) {
        if (hex.data.player !== player) {
          // Existing building belongs to another player
          continue;
        }
        // Todo: See if current building can be upgraded
      } else {
        if (board.mines.income.length <= data.mines + 1) {
          // There are already too many mines
          continue;
        }

        if (!data.canPay(board.mines.cost)) {
          continue;
        }

        buildings.push({
          building: Building.Mine,
          coordinates: hex.toString(),
          cost: board.mines.cost.map(c => c.toString()).join(',')
        });
      }
    }

    commands.push({
      name: Command.Build, 
      player, 
      data: {buildings}
    });
  }

  commands.push({
    name: Command.Pass,
    player
  });

  return [];
}
