import SpaceMap from './map';
import * as assert from 'assert';
import * as _ from 'lodash';
import Player from './player';
import {
  Faction,
  Command,
  Player as PlayerEnum,
  Operator,
  Building
} from './enums';
import Event from './events';
import { CubeCoordinates } from 'hexagrid';

import AvailableCommand, {
  generate as generateAvailableCommands
} from './available-command';
import factions from './factions';
import Reward from './reward';

export default class Engine {
  map: SpaceMap;
  players: Player[];
  availableCommands: AvailableCommand[] = [];
  round: number = -2;
  turn: number = 0;
  /** Order of players in the turn */
  turnOrder: PlayerEnum[] = [];
  /**
   * Players who have passed, in order. Will be used to determine next round's
   * order
   */
  passedPlayers: PlayerEnum[] = [];
  /** Current player to make a move */
  currentPlayer: PlayerEnum;
  /** position of the current player in turn order */
  currentPlayerTurnOrderPos: number = 0;

  constructor(moves: string[] = []) {
    this.generateAvailableCommands();
    this.loadMoves(moves);
  }

  loadMoves(moves: string[]) {
    for (const move of moves) {
      this.move(move);
      this.generateAvailableCommands();
    }
  }

  generateAvailableCommands(): AvailableCommand[] {
    return (this.availableCommands = generateAvailableCommands(this));
  }

  availableCommand(player: PlayerEnum, command: Command) {
    return this.availableCommands.find(
      availableCommand => {
        if (availableCommand.name !== command) {
          return false;
        } 
        if (availableCommand.player === undefined) {
          return false;
        }
        return availableCommand.player === player;
      }
    );
  }

  player(player: number): Player {
    return this.players[player];
  }

  move(move: string) {
    const split = move.trim().split(' ');

    if (this.round === -2) {
      const command = split[0] as Command;

      const available = this.availableCommands;
      const commandNames = available.map(cmd => cmd.name);

      assert(
        commandNames.includes(command),
        'Available commands: ' + commandNames.join(', ')
      );

      (this[command] as any)(...split.slice(1));
      this.endRound();
    } else {
      const playerS = split[0];

      assert(
        /^p[1-5]$/.test(playerS),
        'Wrong player format, expected p1, p2, ...'
      );
      const player = +playerS[1] - 1;

      assert(  this.currentPlayer === (player as PlayerEnum), "Wrong turn order, expected "+ this.currentPlayer +' found '+player);

      const command = split[1] as Command;

      const available = this.availableCommands;
      const commandNames = available.map(cmd => cmd.name);

      assert(
        this.availableCommand(player, command),
        'Available commands: ' + commandNames.join(', ')
      );

      (this[command] as any)(player as PlayerEnum, ...split.slice(2));

      if (this.turnOrder.length === 0) {
        // If all players have passed
        this.endRound();
      } else {
        // Let the next player move
        this.moveToNextPlayer();
        if (this.currentPlayer === undefined) {
          this.endRound();
        }
      }
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
      engine.players.push(new Player());
    }

    return engine;
  }

  endRound() {
  
    if ( this.round < 6 ) {
      this.beginRound();

    } else
    {
      //TODO end game
    }
  };

  beginRound() {
    this.round += 1;
    if (this.round === 0) {
      // Setup round - add Ivits to the end, before third Xenos
      const setupTurnOrder = this.players
        .filter(pl => pl.faction !== Faction.Ivits)
        .map((pl, i) => i as PlayerEnum);
      const reverseSetupTurnOrder = setupTurnOrder.slice().reverse();
      this.turnOrder = setupTurnOrder.concat(reverseSetupTurnOrder);

      const posXenos = this.players.findIndex(
        pl => pl.faction === Faction.Xenos
      );
      if (posXenos !== -1) {
        this.turnOrder.push(posXenos as PlayerEnum);
      }

      const posIvits = this.players.findIndex(
        pl => pl.faction === Faction.Ivits
      );
      if (posIvits !== -1) {
        this.turnOrder.push(posIvits as PlayerEnum);
      }
    } else {
      // The players play in the order in which they passed or 
      // First round or faction selection the players are in regular order
      this.turnOrder = (this.round === 1 || this.round === -1) ? this.players.map((pl, i) => i as PlayerEnum) :
      this.passedPlayers;
      this.passedPlayers = [];
      for (const player of this.playersInOrder()) {
        player.receiveIncome();
      }
    }

    this.currentPlayer = this.turnOrder[0];
    this.currentPlayerTurnOrderPos = 0;
  }

  /** Next player to make a move, after current player makes their move */
  moveToNextPlayer(): PlayerEnum {
    if (
      this.round <= 0 &&
      this.currentPlayerTurnOrderPos + 1 === this.turnOrder.length
    ) {
      // all players played a one round only turn (faction selection and initial buildings)
      this.currentPlayerTurnOrderPos = undefined;
      this.currentPlayer = undefined;
      return;
    } else {
      const next = (this.currentPlayerTurnOrderPos + 1) % this.turnOrder.length;
      this.currentPlayerTurnOrderPos = next;
      this.currentPlayer = this.turnOrder[next];
      return;
    }
  }

  playersInOrder(): Player[] {
    return this.turnOrder.map(i => this.players[i]);
  }

  /** Commands */
  [Command.Init](players: string, seed: string) {
    const nbPlayers = +players || 2;
    seed = seed || 'defaultSeed';

    this.map = new SpaceMap(nbPlayers, seed);

    this.players = [];

    for (let i = 0; i < nbPlayers; i++) {
      this.players.push(new Player());
    }
  }

  [Command.ChooseFaction](player: PlayerEnum, faction: string) {
    const avail = this.availableCommand(player, Command.ChooseFaction);

    assert(
      avail.data.includes(faction),
      `${faction} is not in the available factions`
    );

    this.players[player].loadFaction(faction as Faction);
  }

  [Command.Build](player: PlayerEnum, building: Building, location: string) {
    const avail = this.availableCommand(player, Command.Build);
    const { buildings } = avail.data;

    for (const elem of buildings) {
      if (elem.building === building && elem.coordinates === location) {
        const { q, r } = CubeCoordinates.parse(location);

        this.player(player).build(
          elem.upgradedBuilding,
          building,
          Reward.parse(elem.cost)
        );

        const hex = this.map.grid.get(q, r);
        hex.data.building = building;
        hex.data.player = player;

        return;
      }
    }

    throw new Error(`Impossible to execute build command at ${location}`);
  }

  [Command.Pass](player: PlayerEnum) {
    this.passedPlayers.push(player);
    this.turnOrder.splice(this.currentPlayerTurnOrderPos, 1);
  }
}
