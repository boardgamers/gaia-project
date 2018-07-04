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
  Resource,
  TechTile,
  TechTilePos,
  AdvTechTile,
  AdvTechTilePos,
  Federation,
  BoardAction

} from './enums';
import { CubeCoordinates } from 'hexagrid';
import Event from './events';
import techs from './tiles/techs';
import federations from './tiles/federations';
import * as researchTracks from './research-tracks'
import AvailableCommand, {
  generate as generateAvailableCommands
} from './available-command';
import Reward from './reward';
import { boardActions, freeActions } from './actions';
import { GaiaHex } from '..';
import { stdBuildingValue } from './buildings';



const ISOLATED_DISTANCE = 3;


export default class Engine {
  map: SpaceMap;
  players: Player[];
  roundBoosters:  {
    [key in Booster]?: boolean 
  } = { }; 
  techTiles: {
    [key in TechTilePos]?: {tile: TechTile; numTiles: number}
  } = {};
  advTechTiles: {
    [key in AdvTechTilePos]?: {tile: AdvTechTile; numTiles: number}
  } = {};
  boardActions: {
    [key in BoardAction]?: boolean  } = {};
  federations: {
    [key in Federation]?: number
  } = {};
  terraformingFederation: Federation;
  availableCommands: AvailableCommand[] = [];
  round: number = Round.Init;
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

  playerToMove(): PlayerEnum {
    if (this.availableCommands.length > 0) {
      return this.availableCommands[0].player;
    }

    return this.currentPlayer;
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

      assert(this.playerToMove() === (player as PlayerEnum), "Wrong turn order in move " + move + ", expected "+ this.currentPlayer +' found '+player);

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

    this.generateAvailableCommands();
  }

  numberOfPlayersWithFactions(): number {
    return this.players.filter(pl => pl.faction).length;
  }

  static fromData(data: any) {
    const engine = new Engine();
    engine.round = data.round;
    engine.availableCommands = data.availableCommands;
    engine.map = SpaceMap.fromData(data.map);
    for (const player of data.players) {
      engine.players.push(Player.fromData(player));
    }

    return engine;
  }

  endTurn(command : Command) {
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

        const posIvits = this.players.findIndex(
          pl => pl.faction === Faction.Ivits
        );

        const setupTurnOrder = this.players
          .map((pl, i) => i as PlayerEnum)
          .filter(i => i !==  posIvits);
        const reverseSetupTurnOrder = setupTurnOrder.slice().reverse();
        this.turnOrder = setupTurnOrder.concat(reverseSetupTurnOrder);

        const posXenos = this.players.findIndex(
          pl => pl.faction === Faction.Xenos
        );
        if (posXenos !== -1) {
          this.turnOrder.push(posXenos as PlayerEnum);
        }

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

  leechingPhase(player: PlayerEnum, hex: GaiaHex) {
    // exclude setup rounds
    if (this.round <= 0) {
      return;
    }
    // Gaia-formers & space stations don't trigger leech
    if (stdBuildingValue(hex.buildingOf(player)) === 0) {
      return;
    }
    // From rules, this is in clockwise order. We assume the order of players in this.players is the
    // clockwise order
    for (const pl of this.players) {
      // Exclude the one whould made the building from the leech
      if (pl !== this.player(player)) {
        let leech = 0;
        for (const loc of pl.data.occupied) {
          if (this.map.distance(loc, hex) < ISOLATED_DISTANCE) {
            leech = Math.max(leech, pl.buildingValue(this.map.grid.get(loc.q, loc.r).buildingOf(pl.player), this.map.grid.get(loc.q, loc.r).data.planet))
          }
        }
        leech = pl.maxLeech(leech);
        if (leech > 0) {
          this.roundSubCommands.push({
            name: Command.Leech,
            player: this.players.indexOf(pl),
            data: leech
          });
        }
      }
    }
  }

  techTilePhase(player: PlayerEnum) {
    const tiles = [];
    const data = this.players[player].data;

    //  tech tiles that player doesn't already have  
    for (const tilePos of Object.values(TechTilePos)) {
      if (!data.techTiles.includes(tilePos)) {
        tiles.push({
          tile: this.techTiles[tilePos].tile,
          tilePos: tilePos,
          type: "std"
        });
      }
    }

    // adv tech tiles where player has lev 4/5, free federation tokens,
    // and available std tech tiles to cover
    for (const tilePos of Object.values(AdvTechTilePos)) {
      if (this.advTechTiles[tilePos].numTiles > 0  &&
          data.greenFederations > 0 &&
          data.research[tilePos] >=4 && 
          data.techTiles.filter(tech => tech.enabled).length>0 ) {
            tiles.push({
              tile: this.advTechTiles[tilePos].tile,
              tilePos: tilePos,
              type: "adv"
            });
      }
    }

    if (tiles.length>0) {
      this.roundSubCommands.unshift({
        name: Command.ChooseTechTile,
        player: player,
        data: { tiles } 
    })
    }
  }

  coverTechTilePhase(player: PlayerEnum) {
    this.roundSubCommands.unshift({
      name: Command.ChooseCoverTechTile,
      player: player,
      data: {}
    })
  }

  lostPlanetPhase(player: PlayerEnum) {
    this.roundSubCommands.unshift({
      name: Command.PlaceLostPlanet,
      player: player,
      data: {}
    })
  }

  advanceResearchAreaPhase(player: PlayerEnum, pos: TechTilePos) {
    // if stdTech in a free position or advTech, any researchArea
    let destResearchArea = "";
    if (![TechTilePos.Free1, TechTilePos.Free2, TechTilePos.Free3].includes(pos) && Object.values(TechTilePos).includes(pos)) {
      // There's only one track to advance, so no need to give the player a choice
      this.player(player).gainRewards(Reward.parse(`up-${pos}`));
      return;
    }

    this.roundSubCommands.unshift({
      name: Command.UpgradeResearch,
      player: player,
      data: destResearchArea
    });
  }

  selectFederationTilePhase(player: PlayerEnum, fromCommand: Command){
    const possibleTiles = Object.keys(this.federations).filter(key => this.federations[key] > 0);
    const playerTiles = Object.keys(this.player(player).data.federations);

    this.roundSubCommands.unshift({
      name: Command.ChooseFederationTile,
      player: player,
      data: fromCommand === Command.Action ? playerTiles : possibleTiles
    });
  }

  endTurnPhase(player: PlayerEnum, fromCommand: Command){
    this.roundSubCommands.unshift({
      name: Command.EndTurn,
      player: player,
      data: fromCommand
    });
  }

  possibleResearchAreas(player: PlayerEnum, cost: string, destResearchArea?: ResearchField) {
    const tracks = [];
    const data = this.players[player].data;

    if (this.players[player].canPay(Reward.parse(cost))) {
      for (const field of Object.values(ResearchField)) {

        // up in a specific research area
        if (destResearchArea && destResearchArea !== field) {
          continue;
        }

        //already on top
        if (data.research[field] === researchTracks.lastTile(field)) {
          continue;
        }

        // end of the track reached
        const destTile = data.research[field] + 1;

        // To go from 4 to 5, we need to flip a federation and nobody inside
        if (researchTracks.keyNeeded(field, destTile) && data.greenFederations === 0) {
          continue;
        }

        if (this.playersInOrder().some(pl => pl.data.research[field] === researchTracks.lastTile(field))) {
          continue;
        };

        tracks.push({
          field,
          to: destTile,
          cost: cost
        });

      }
    }

    return tracks;
  }

  possibleSpaceLostPlanet(player: PlayerEnum) {
    const data = this.player(player).data;
    const spaces = [];

    for (const hex of this.map.toJSON()) {
      // exclude existing planets, satellites and space stations
      if (hex.data.planet !== Planet.Empty || hex.data.federations || hex.data.building) {
        continue;
      }
      const distance = _.min(data.occupied.map(loc => this.map.distance(hex, loc)));
      //TODO posible to extened? check rules const qicNeeded = Math.max(Math.ceil( (distance - data.range) / QIC_RANGE_UPGRADE), 0);
      if (distance > data.range) {
        continue;
      }

      spaces.push({
        building: Building.Mine,
        coordinates: hex.toString(),
      });
    }

    return spaces;
  }

  possibleBoardActions(player: PlayerEnum) {
    const commands = [];

    let poweracts = Object.values(BoardAction).filter(pwract => this.boardActions[pwract] && this.player(player).canPay(Reward.parse(boardActions[pwract].cost)));
    if (poweracts.length > 0) {
      commands.push({
        name: Command.Action,
        player,
        data: { poweracts }
      });
    };

    return commands;

  }

  possibleFreeActions(player: PlayerEnum) {

    // free action - spend
    const acts = [];
    const commands = [];
    for (let i = 0; i < freeActions.length; i++) {
      if (this.player(player).canPay(Reward.parse(freeActions[i].cost))) {
        acts.push({ 
          cost: freeActions[i].cost,
          income: freeActions[i].income  
        });
      };
    };

    if (acts.length > 0) {
      commands.push({
        name: Command.Spend,
        player,
        data: { acts }
      });
    }

    //free action - burn
    //TODO generate burn actions based on  Math.ceil( engine.player(player).data.power.area2 / 2)
    if (this.player(player).data.power.area2 >= 2) {
      commands.push({
        name: Command.BurnPower,
        player,
        data: 1
      });
    }
    return commands;

  }

  /** Next player to make a move, after current player makes their move */
  moveToNextPlayer(command: Command): PlayerEnum {
    const subPhaseTurn = this.roundSubCommands.length > 0;
    
    if (subPhaseTurn) {
      // This is a sub command, wait until they are all done
      return;
    } 

    // if freeAction current player stays current player
    if (command === Command.Spend || command === Command.BurnPower) {
      return;
    }

    if (this.round <= 0) {
      const playerPos = this.currentPlayerTurnOrderPos;
      if (command === Command.Pass) {
        this.passedPlayers.push(this.currentPlayer);
      }
      this.turnOrder.splice(playerPos, 1);
      this.currentPlayerTurnOrderPos = playerPos % this.turnOrder.length;
      this.currentPlayer = this.turnOrder[this.currentPlayerTurnOrderPos];

      return;
    }

    const playerPos = this.turnOrder.indexOf(this.currentPlayer);

    if (command === Command.Pass) {
      this.passedPlayers.push(this.currentPlayer);
      this.turnOrder.splice(playerPos, 1);
      this.currentPlayer = this.turnOrder[playerPos % this.turnOrder.length];
      return;
    }
    
    this.currentPlayer = this.turnOrder[(playerPos + 1) % this.turnOrder.length];
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

    // Shuffle tech tiles 
    const techtiles = shuffleSeed.shuffle(Object.values(TechTile), this.map.rng());
    Object.values(TechTilePos).forEach( (pos, i) => {
      this.techTiles[pos] = {tile: techtiles[i], numTiles: 4};
    });
 
    // Choose adv tech tiles as part of the pool
    const advtechtiles = shuffleSeed.shuffle(Object.values(AdvTechTile), this.map.rng()).slice(0, 6);
    Object.values(AdvTechTilePos).forEach( (pos, i) => {
      this.advTechTiles[pos] = {tile: advtechtiles[i], numTiles: 1};
    });

    //powerActions
    Object.values(BoardAction).forEach( pos => {
      this.boardActions[pos] = true;
    });

    this.terraformingFederation = shuffleSeed.shuffle(Object.values(Federation), this.map.rng())[0];
    for (const federation of Object.values(Federation) as Federation[]) {
      if (federation !== Federation.FederationGleens) {
        this.federations[federation] = federation === this.terraformingFederation ? 2: 3;
      }
    }
  
    this.players = [];
    
    for (let i = 0; i < nbPlayers; i++) {
      this.players.push(new Player(i));
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
        const hex = this.map.grid.get(q, r);
        const pl = this.player(player);

        pl.build(
          building,
          hex,
          Reward.parse(elem.cost),
          this.map
        );

        this.leechingPhase(player, hex);

        if ( pl.faction === Faction.Gleens && building === Building.PlanetaryInstitute){
          pl.gainFederationToken(Federation.FederationGleens);
        }

        if ( building === Building.ResearchLab || building === Building.Academy1 || building === Building.Academy2) {
          this.techTilePhase(player);
        }

        this.endTurnPhase(player, Command.Build);
       
        return;
      }
    }

    throw new Error(`Impossible to execute build command at ${location}`);
  }

  [Command.UpgradeResearch](player: PlayerEnum, field: ResearchField) {
    const { tracks } = this.availableCommand(player, Command.UpgradeResearch).data;
    const track = tracks.find(tr => tr.field === field);

    assert(track, `Impossible to upgrade knowledge for ${field}`);

    const pl = this.player(player);
   
    pl.payCosts(Reward.parse(track.cost));
    pl.gainRewards([new Reward(`${Command.UpgradeResearch}-${field}`)]);

    if (pl.data.research[field] === researchTracks.lastTile(field)) {
      if (field === ResearchField.Terraforming) {
        //gets federation token
        if (this.terraformingFederation) {
          pl.gainFederationToken(this.terraformingFederation);
          this.terraformingFederation = undefined;
        }
      } else if (field === ResearchField.Navigation) {
        //gets LostPlanet
        this.lostPlanetPhase(player);
      }
    }
  }

  [Command.Pass](player: PlayerEnum, booster: Booster) {
    this.roundBoosters[this.players[player].data.roundBooster] = true;
    this.players[player].pass();
    (this[Command.ChooseRoundBooster] as any)(player, booster, Command.Pass);
  }

  [Command.Leech](player: PlayerEnum, leech: string) {
    const leechCommand  = this.availableCommand(player, Command.Leech).data;
  
    assert( leechCommand == leech , `Impossible to charge ${leech} power`);

    const powerLeeched = this.players[player].data.chargePower(Number(leech));
    this.player(player).payCosts( [new Reward(Math.max(powerLeeched - 1, 0), Resource.VictoryPoint)]);
  }

  [Command.DeclineLeech](player: PlayerEnum) {
  }

  [Command.EndTurn](player: PlayerEnum){

  }

  [Command.ChooseTechTile](player: PlayerEnum, pos: TechTilePos) {
    const { tiles } = this.availableCommand(player, Command.ChooseTechTile).data;
    const tileAvailable = tiles.find(ta => ta.tilePos == pos);

    assert(tileAvailable !== undefined, `Impossible to get ${pos} tile`);

    this.player(player).loadEvents(Event.parse(techs[this.techTiles[pos].tile]));
    this.player(player).data.techTiles.push(
      {
        tile: tileAvailable.tile,
        enabled: true
      }
    );
    this.techTiles[pos].numTiles -= 1;
    if (tileAvailable.type === "adv") {
      this.coverTechTilePhase(player);
    };
    // add advance research area subCommand
    this.advanceResearchAreaPhase(player, pos);
  }

  [Command.ChooseCoverTechTile](player: PlayerEnum, tile: string) {
    const { tiles } = this.availableCommand(player, Command.ChooseCoverTechTile).data;
    const tileAvailable = tiles.find(ta => ta.tile == tile);

    assert(tileAvailable !== undefined, `Impossible to cover ${tile} tile`);
    //remove tile
    const tileIndex = this.player(player).data.techTiles.findIndex(tl => tl.tile = tileAvailable.tile)
    this.player(player).data.techTiles.splice(tileIndex, 1);
    //remove bonus
    this.player(player).removeEvents(Event.parse(techs[tile]));
  }

  [Command.ChooseFederationTile](player: PlayerEnum, federation: Federation, fromCommand: Command = Command.ChooseFederationTile) {
    const { tiles } = this.availableCommand(player, fromCommand).data;
    const tileAvailable = tiles.find(ta => ta.tile == federation);

    assert(tileAvailable !== undefined, `Federation ${federation} is not available`);

    if (fromCommand === Command.Action) {
      //rescore a federation
      this.player(player).gainRewards(Reward.parse(federations[federation]));
    } else {

    }
  }

  [Command.PlaceLostPlanet](player: PlayerEnum, location: string) {
    const avail = this.availableCommand(player, Command.Build);
    const { spaces } = avail.data;

    if (spaces.indexOf(location) === -1) {
      throw new Error(`Impossible to execute build command at ${location}`);
    }

    const { q, r, s } = CubeCoordinates.parse(location);
    const hex = this.map.grid.get(q, r);
    hex.data.planet = Planet.Lost;

    this.player(player).build(Building.Mine, hex, [], this.map);
    this.leechingPhase(player, hex);

    return;
  }

  [Command.Spend](player: PlayerEnum, cost, _: "for", income: string) {
    const { acts: actions } = this.availableCommand(player, Command.Spend).data;

    for (const elem of actions) {
      if (elem.cost === cost && elem.income === income) {
        this.players[player].payCosts([new Reward(cost)]);
        this.players[player].gainRewards([new Reward(income)]);
        return;
      }
    }

    assert(false, `spend ${cost} for ${income} is not allowed`
    );
  }

  [Command.BurnPower](player: PlayerEnum, cost: string) {
    const burn = this.availableCommand(player, Command.BurnPower).data;
    assert(burn.includes(+cost), `Impossible to burn ${cost} power`);

    this.players[player].data.burnPower(+cost);
  }

  [Command.Action](player: PlayerEnum, action: BoardAction) {
    const { poweracts: acts} = this.availableCommand(player, Command.Action).data;

    assert(_.find(acts, {name: action}), `${action} is not in the available power actions`);
  
    const pl = this.player(player);
    this.boardActions[action] = false;

    pl.payCosts(Reward.parse(boardActions[action].cost));
    //rescore 
    if (action === BoardAction.Qic2) {
      // TODO move that to player.gainRewards()
      this.selectFederationTilePhase(player, Command.Action);
    } else {
      pl.loadEvents(Event.parse(boardActions[action].income));
    };
  }

  [Command.FormFederation](player: PlayerEnum, hexes: string, federation: Federation) {
    const avail = this.availableCommand(player, Command.FormFederation);

    if (!avail.data.federations.find(fed => fed.hexes === hexes)) {
      // Todo: allow custom federations which respect the rules (isOutclassedBy)
      throw new Error(`Impossible to form federation at ${hexes}`);
    }
    if (!avail.data.tiles.includes(federation)) {
      throw new Error(`Impossible to form federation ${federation}`);
    }

    const fedInfo = avail.data.federations.find(fed => fed.hexes === hexes);

    const pl = this.player(player);

    pl.gainFederationToken(federation);
    this.federations[federation] -= 1;

    const hexList = hexes.split(',').map(str => this.map.grid.getS(str));
    for (const hex of hexList) {
      hex.addToFederationOf(player);
    }
    pl.payCosts([new Reward(fedInfo.satellites, Resource.GainToken)]);
  }
}
