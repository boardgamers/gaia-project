import SpaceMap from "./map";
import * as assert from "assert";
import * as _ from 'lodash';
import Player from "./player";
import { Faction, Command, Player as PlayerEnum, Operator } from "./enums";
import Event from "./events";

import AvailableCommand from "./available-command";
import { getEvents } from "./faction-boards/util";
import factionBoards from "./faction-boards";

export default class Engine {
  map: SpaceMap;
  players: Player[];
  availableCommands: AvailableCommand[] = [];

  constructor(moves: string [] = []) {
    this.generateAvailableCommands();
    this.loadMoves(moves);
  }

  loadMoves(moves: string[]) {
    for (let move of moves) {
      this.move(move);
      this.generateAvailableCommands();
    }
  }

  generateAvailableCommands(): AvailableCommand[] {
    if (!this.map) {
      return this.availableCommands = [{name: Command.Init}];
    }

    return this.availableCommands = [{
      name: Command.ChooseFaction, 
      player: this.numberOfPlayersWithFactions(), 
      data: _.difference(Object.values(Faction), this.players.map(pl => pl.faction))
    }];
  }

  availableCommand(player: PlayerEnum, command: Command) {
    return this.availableCommands.find(
      availableCommand => availableCommand.name === command && (!(player in availableCommand) || availableCommand.player === player)
    );
  }

  move(move: string) {
    const split = move.trim().split(" ");

    if (!this.map) {
      const command = split[0] as Command;

      const available = this.availableCommands;
      const commandNames = available.map(cmd => cmd.name);

      assert(commandNames.includes(command), "Available commands: " + commandNames.join(", "));

      (this[command] as any)(...split.slice(1));
    } else {
      const playerS = split[0];

      assert(/^p[0-4]$/.test(playerS), "Wrong player format, expected p1, p2, ...");
      const player = +playerS[1];

      const command = split[1] as Command;

      const available = this.availableCommands;
      const commandNames = available.map(cmd => cmd.name);
  
      assert(this.availableCommand(player, command), "Available commands: " + commandNames.join(", "));
  
      (this[command] as any)(player as PlayerEnum, ...split.slice(2));
    }
  }

  numberOfPlayersWithFactions(): number {
    return this.players.filter(pl => pl.faction).length;
  }

  data(): Object {
    return {
      map: this.map.toJSON(),
      players: this.players.map(pl => pl.toJSON())
    };
  }

  /** Commands */
  [Command.Init](players: string, seed: string) {
    const nbPlayers = +players || 2;
    seed = seed || "defaultSeed";

    this.map = new SpaceMap(nbPlayers, seed);

    this.players = [];

    for (let i = 0; i < nbPlayers; i++) {
      this.players.push(new Player());
    }
  }

  [Command.ChooseFaction](player: PlayerEnum, faction: string) {
    const avail = this.availableCommand(player, Command.ChooseFaction);

    assert(avail.data.includes(faction), `${faction} is not in the available factions`);

    this.players[player].loadFaction(faction as Faction);
  }
}
