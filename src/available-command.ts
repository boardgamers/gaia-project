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
          building: Building.Mine,
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

  return [];
}
