import SpaceMap from "./map";
import * as assert from "assert";
import * as _ from 'lodash';
import Player from "./player";
import { Faction, Command, Player as PlayerEnum, Operator, Building } from "./enums";
import Event from "./events";
import { CubeCoordinates} from "hexagrid";

import AvailableCommand, { generate as generateAvailableCommands } from "./available-command";
import factions from "./factions";
import Reward from "./reward";

export default class Engine {
  map: SpaceMap;
  players: Player[];
  availableCommands: AvailableCommand[] = [];
  turn: number = 0;

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
    return this.availableCommands = generateAvailableCommands(this);
  }

  availableCommand(player: PlayerEnum, command: Command) {
    return this.availableCommands.find(
      availableCommand => availableCommand.name === command && (!(player in availableCommand) || availableCommand.player === player)
    );
  }

  nextPlayerToSetup() {
    if (this.turn > 0) {
      return undefined;
    }

    // Find the first player with zero mine
    let player = this.players.findIndex(pl => pl.data.mines === 0);

    if (player !== -1) {
      return player;
    }

    // Find the last player with one mine
    player = _.findLastIndex(this.players, pl => pl.data.mines === 1);

    if (player !== -1) {
      return player;
    }

    // Todo: if the faction with three mines, return corresponding player

    return undefined;
  }

  player(player: number): Player {
    return this.players[player];
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

      assert(/^p[1-5]$/.test(playerS), "Wrong player format, expected p1, p2, ...");
      const player = +playerS[1] - 1;

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

  static fromData(data: any) {
    const engine = new Engine();
    engine.turn = data.turn;
    engine.availableCommands = data.availableCommands;
    engine.map = SpaceMap.fromData(data.map);
    for (let player of data.players) {
      engine.players.push(new Player())
    }

    return engine;
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

  [Command.Build](player: PlayerEnum, building: Building, location: string) {
    const avail = this.availableCommand(player, Command.Build);
    const { buildings } = avail.data;

    for (const elem of buildings) {
      if (elem.building === building && elem.coordinates === location) {
        const {q, r} = CubeCoordinates.parse(location);

        this.player(player).build(Building.Mine, Reward.parse(elem.cost));
        
        const hex = this.map.grid.get(q, r);
        hex.data.building = building;
        hex.data.player = player;

        if (this.turn === 0 && this.nextPlayerToSetup() === undefined) {
          this.turn = 1;
        }
      }
    }
  }
}
