import { Command, Faction, Building } from './enums';
import Engine from './engine';
import * as _ from 'lodash';
import factions from './factions';
import * as assert from "assert";
import { upgradedBuildings } from './buildings';

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
      if (hex.data.planet !== planet || (hex.data.player !== undefined && hex.data.player !== player)) {
        continue;
      }

      if (hex.data.building) {
        // Todo: check if mine is isolated
        const isolated = hex.data.building === Building.Mine && true; 
        const upgraded = upgradedBuildings(hex.data.building, engine.player(player).faction);

        for (const upgrade of upgraded) {
          if (!engine.player(player).canBuild(upgrade, isolated)) {
            continue;
          }

          buildings.push({
            upgradedBuilding: hex.data.building,
            building: upgrade,
            cost: board.cost(upgrade, isolated).map(c => c.toString()).join(','),
            coordinates: hex.toString()
          });
        }
      } else {
        // empty faction planet
        if (!engine.player(player).canBuild(Building.Mine)) {
          continue;
        }

        // TODO check if planet is accessable (distance from hex<= player.data.range)

        buildings.push({
          building: Building.Mine,
          coordinates: hex.toString(),
          cost: board.cost(Building.Mine).map(c => c.toString()).join(',')
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
