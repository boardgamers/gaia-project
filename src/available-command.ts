import { Command, Faction, Building } from "./enums";
import Engine from "..";
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
      player: this.numberOfPlayersWithFactions(), 
      data: _.difference(Object.values(Faction), this.players.map(pl => pl.faction), this.players.map(pl => factions.opposite(pl.faction)))
    }];
  }

  if (this.nextPlayerToSetup() !== undefined) {
    return [{
      name: Command.Build, 
      player: this.nextPlayerToSetup(), 
      data: {buildings: [Building.Mine]}
    }];
  }
}
