import SpaceMap from './map';
import * as assert from 'assert';
import * as _ from 'lodash';
import Player from './player';
import * as shuffleSeed from "shuffle-seed";
import {
  Faction,
  Command,
  Player as PlayerEnum,
  Building,
  ResearchField,
  Planet,
  Round,
  Booster,
  Turn,
  Resource
} from './enums';
import { CubeCoordinates } from 'hexagrid';

const ISOLATED_DISTANCE = 3;

import AvailableCommand, {
  generate as generateAvailableCommands
} from './available-command';
import Reward from './reward';

export default class Engine {
  map: SpaceMap;
  players: Player[];
  roundBoosters:  {
    [key in Booster]?: boolean 
  } = { }; 
  availableCommands: AvailableCommand[] = [];
  round: number = Round.Init;
  turn: number = Turn.Generic;
  /** Order of players in the turn */
  turnOrder: PlayerEnum[] = [];
  roundSubCommands: AvailableCommand[] = [];
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

    if (this.round === Round.Init) {
      const command = split[0] as Command;

      const available = this.availableCommands;
      const commandNames = available.map(cmd => cmd.name);

      assert(
        commandNames.includes(command),
        'Move ' + move + ' not in Available commands: ' + commandNames.join(', ')
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
        'Move ' + move + ' not in Available commands: ' + commandNames.join(', ')
      );

      (this[command] as any)(player as PlayerEnum, ...split.slice(2));

      this.endTurn(command);
    } 
  }

  numberOfPlayersWithFactions(): number {
    return this.players.filter(pl => pl.faction).length;
  }

  static fromData(data: any) {
    const engine = new Engine();
    engine.round = data.round;
    engine.availableCommands = data.availableCommands;
    engine.map = SpaceMap.fromData(data.map);
    for (let player of data.players) {
      engine.players.push(new Player());
    }

    return engine;
  }

  endTurn(command : Command) {
    // subactions :  checks if the player has to do another action
    // build can need tech tile
    // tech tile can need to advance research


    // if not subactions Let the next player move based on the command
    this.moveToNextPlayer(command);

    if (this.turnOrder.length === 0) {
      // If all players have passed
      this.endRound();
    }
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

    switch (this.round) {
      case Round.SetupBuilding: {
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
        break;
      };
      case Round.SetupFaction:
      case Round.Round1: {
        this.turnOrder = this.players.map((pl, i) => i as PlayerEnum);
        this.passedPlayers = [];
        break;
      };
      case Round.SetupRoundBooster:{
        this.turnOrder = this.players.map((pl, i) => i as PlayerEnum).reverse();
        break;
      };
      default: {
        // The players play in the order in which they passed or 
        this.turnOrder = this.passedPlayers;
        this.passedPlayers = [];
      };
    };

    this.currentPlayer = this.turnOrder[0];
    this.currentPlayerTurnOrderPos = 0;
    
    if ( this.round >= 1) {
      this.incomePhase();
      this.gaiaPhase();
    };

  };

  incomePhase(){
    for (const player of this.playersInOrder()) {
      player.receiveIncome();
      //TODO split power actions and request player order
    }
  }

  gaiaPhase(){
    // transform Transdim planets into Gaia if gaiaformed
    for (const hex of this.map.toJSON()) {
      if (hex.data.planet === Planet.Transdim  && hex.data.player !== undefined && hex.data.building === Building.GaiaFormer ) {
        hex.data.planet = Planet.Gaia;
      }
    }
    for (const player of this.playersInOrder()) {
      player.gaiaPhase();
    }
    //TODO manage gaia phase actions for specific factions
  }

  leechingPhase(player: PlayerEnum, location: CubeCoordinates){
    // exclude setiup rounds
    if (this.round <=0) {
      return;
    } 
    // all players excluded leecher
    this.roundSubCommands = [];

    for (const pl of this.players){     
      if ( pl !== this.player(player)){
        let leech = 0;
        for (const loc of pl.data.occupied) {
          if (this.map.grid.distance(loc.q, loc.r, location.q, location.r) < ISOLATED_DISTANCE) {
            leech = Math.max(leech, pl.buildingValue( this.map.grid.get(loc.q, loc.r).data.building, this.map.grid.get(loc.q, loc.r).data.planet))
          }
        }
        leech =  Math.min( leech,  pl.maxLeech());
        if (leech > 0) {
          this.turnOrder.splice( this.currentPlayerTurnOrderPos +1, 0, this.players.indexOf(pl) )
          this.roundSubCommands.push( {
              name: Command.Leech,
              player: this.players.indexOf(pl),
              data: { leech }
            }
          )
        }
        }
      }
  }

  /** Next player to make a move, after current player makes their move */
  moveToNextPlayer(command : Command): PlayerEnum {
    if ( command === Command.Pass || 
      command === Command.Leech || 
      command === Command.DeclineLeech ||
      this.round === Round.SetupFaction || 
      this.round === Round.SetupBuilding || 
      this.round === Round.SetupRoundBooster) {
        // happens in round SetupROundBooster and standard rounds after pass move
        const playerPos = this.currentPlayerTurnOrderPos;
        if ( command !== Command.Leech && command !== Command.DeclineLeech) {
        this.passedPlayers.push(this.currentPlayer);
        }
        this.turnOrder.splice( playerPos, 1); 
        // if latest player is passing
        const newPlayerPos = playerPos + 1 > this.turnOrder.length ? 0 : playerPos;
        this.currentPlayer = this.turnOrder[newPlayerPos];  
        this.currentPlayerTurnOrderPos = newPlayerPos;

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

    // Choose nbPlayers+3 boosters as part of the pool
    const boosters = shuffleSeed.shuffle(Object.values(Booster), this.map.rng()).slice(0, nbPlayers+3);
    for (const booster of boosters) {
      this.roundBoosters[booster] = true;
    }

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

  [Command.ChooseRoundBooster](player: PlayerEnum, booster: Booster, fromCommand: Command = Command.ChooseRoundBooster ) {
    const { boosters } = this.availableCommand(player, fromCommand).data;
    
    assert(boosters.includes(booster),
      `${booster} is not in the available boosters`
    );
    
    this.roundBoosters[booster] = false;
    this.players[player].getRoundBooster(booster);
  }

  [Command.Build](player: PlayerEnum, building: Building, location: string) {
    const avail = this.availableCommand(player, Command.Build);
    const { buildings } = avail.data;

    for (const elem of buildings) {
      if (elem.building === building && elem.coordinates === location) {
        const {q, r, s} = CubeCoordinates.parse(location);
        
        this.player(player).build(
          elem.upgradedBuilding,
          building,
          Reward.parse(elem.cost),
          {q, r, s}
        );

        const hex = this.map.grid.get(q, r);
        hex.data.building = building;
        hex.data.player = player;

        this.leechingPhase( player, {q, r, s} );
        return;
      }
    }

    throw new Error(`Impossible to execute build command at ${location}`);
  }

  [Command.UpgradeResearch](player: PlayerEnum, field: ResearchField) {
    const { tracks } = this.availableCommand(player, Command.UpgradeResearch).data;
    const track = tracks.find(tr => tr.field === field);

    assert(track, `Impossible to upgrade knowledge for ${field}`);

    this.player(player).data.payCosts(Reward.parse(track.cost));
    this.player(player).data.gainReward(new Reward(`${Command.UpgradeResearch}-${field}`));
  }

  [Command.Pass](player: PlayerEnum, booster: Booster) {
    this.roundBoosters[this.players[player].data.roundBooster] = true;
    this.players[player].pass();
    (this[Command.ChooseRoundBooster] as any)(player, booster, Command.Pass);
  }

  [Command.Leech](player: PlayerEnum, leech: number) {
    const powerLeeched = this.players[player].data.chargePower(leech);
    const victoryPoints = `-${powerLeeched}${Resource.VictoryPoint}`;
    this.player(player).data.payCost( new Reward( victoryPoints ));
  }

  [Command.DeclineLeech](player: PlayerEnum) {
    
  }

}
