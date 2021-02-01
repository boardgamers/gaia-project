import SpaceMap, {MapConfiguration} from './map';
import assert from 'assert';
import { sortBy, uniq, sum, set } from 'lodash';
import Player from './player';
import shuffleSeed from "shuffle-seed";
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
  BoardAction,
  Operator,
  ScoringTile,
  FinalTile,
  Phase,
  SubPhase,
  Expansion
} from './enums';
import Event, {EventSource, RoundScoring} from './events';
import federations from './tiles/federations';
import {roundScorings, finalScorings} from './tiles/scoring';
import * as researchTracks from './research-tracks';
import AvailableCommand, {generate as generateAvailableCommands,} from './available-command';
import Reward from './reward';
import {boardActions} from './actions';
import {stdBuildingValue} from './buildings';
import {isAdvanced} from './tiles/techs';
import { range, isEqual } from 'lodash';

// const ISOLATED_DISTANCE = 3;
const LEECHING_DISTANCE = 2;

export interface EngineOptions {
  /** Allow last player to rotate sector BEFORE faction selection */
  advancedRules?: boolean;
  /** disable Federation check for available commands */
  noFedCheck?: boolean;
  /** Custom map given */
  map?: MapConfiguration;
  /** Are the federations flexible (allows you to avoid planets with buildings to form federation even if it's not the shortest route)? */
  flexibleFederations?: boolean;
  /** Spaceship expansion */
  spaceShips?: boolean;
  /** auction */
  auction?: boolean;
  /** Layout */
  layout?: 'standard' | 'balanced' | 'xshape';
}

/**
 * Example:
 *
 * {
 *   move: 123,
 *   player: 0,
 *   changes: {
 *     eco: {c: 2, pw: 1},
 *     income: {o: 3, k: 1}
 *   }
 * }
 */
export interface LogEntry {
  move?: number;
  player?: PlayerEnum;
  changes?: {
    [source in EventSource]?: {[resource in Resource]?: number}
  };
  // For round changes
  round?: number;
  // For phase change
  phase?: Phase.RoundIncome | Phase.RoundGaia | Phase.EndGame;
}

export default class Engine {
  map: SpaceMap;
  players: Player[] = [];
  setup: Faction[] = [];
  options: EngineOptions = {};
  tiles: {
    boosters: {
      [key in Booster]?: boolean
    };
    techs: {
      [key in TechTilePos | AdvTechTilePos]?: {tile: TechTile | AdvTechTile; count: number}
    };
    scorings: {
      round: ScoringTile[];
      final: FinalTile[];
    };
    federations: {
      [key in Federation]?: number
    };
  } = {boosters: {}, techs: {}, scorings: {round: null, final: null}, federations: {}};
  boardActions: {
    [key in BoardAction]?: boolean
  } = {};

  terraformingFederation: Federation;
  availableCommands: AvailableCommand[] = [];
  availableCommand: AvailableCommand;
  phase: Phase = Phase.SetupInit;
  subPhase: SubPhase = SubPhase.BeforeMove;
  oldPhase: Phase;

  get expansions() {
    return 0 | (this.options.spaceShips ? Expansion.Spaceships : 0);
  }

  round: number = Round.None;
  /** Order of players in the turn */
  turnOrder: PlayerEnum[] = [];
  /**
   * Players who have passed, in order. Will be used to determine next round's
   * order
   */
  passedPlayers: PlayerEnum[];
  /** Current player to make a move */
  currentPlayer: PlayerEnum;
  /** Player of the current command being processed */
  processedPlayer: PlayerEnum;
  // used to transit between phases
  tempTurnOrder: PlayerEnum[] = [];
  tempCurrentPlayer: PlayerEnum;
  leechSources: Array<{player: PlayerEnum; coordinates: string; tradeDelivery?: PlayerEnum}> = [];
  // When ongoing leech, remember the source in case
  lastLeechSource: {player: PlayerEnum; coordinates: string; tradeDelivery?: PlayerEnum};

  // All moves
  moveHistory: string[] = [];
  // Advanced log
  advancedLog: LogEntry[] = [];
  // Current move being processed, separated in phase
  turnMoves: string[] = [];
  // Tells the UI if the new move should be on the same line or not
  newTurn = true;

  constructor(moves: string[] = [], options: EngineOptions = {}) {
    this.options = options;
    this.sanitizeOptions();
    this.loadMoves(moves);
  }

  /** Fix old options passed. To remove when legacy data is no more in database */
  sanitizeOptions() {
    // if (get(this.options, "map.map")) {
    //   this.options.map.sectors = get(this.options, "map.map");
    //   set(this.options, "map.map", undefined);
    // }
  }

  loadMoves(_moves: string[]) {
    const moves = [..._moves];

    while (moves.length > 0) {
      const move = moves.shift().trim();

      this.move(move, moves.length === 0);
    }
  }

  move(_move: string, lastMove = true) {
    this.newTurn = true;

    if (this.playerToMove !== undefined) {
      this.log(this.playerToMove, undefined, 0, undefined);
    }

    const move = _move.trim();

    if (!this.executeMove(move)) {
      assert(lastMove, `Move ${move} (line ${this.moveHistory.length + 1}) is not complete!`);
      this.newTurn = false;
    }

    assert(this.turnMoves.length === 0, "Unnecessary commands at the end of the turn: " + this.turnMoves.join('. '));
    this.moveHistory.push(move);
  }

  log(player: PlayerEnum, resource: Resource, amount: number, source: EventSource) {
    const lastEntry = this.advancedLog[this.advancedLog.length - 1];
    let move = this.moveHistory.length;

    let lastMoveRegistered: number;
    let lastPlayerRegistered: PlayerEnum;
    const playersEncountered: Set<number> = new Set();

    for (let i = this.advancedLog.length - 1; i >= 0; i--) {
      playersEncountered.add(this.advancedLog[i].player);
      if (this.advancedLog[i].move !== undefined) {
        lastMoveRegistered = this.advancedLog[i].move;
        lastPlayerRegistered = this.advancedLog[i].player;
        break;
      }
    }

    // Only add move, if it corresponds to a move played
    if (lastMoveRegistered === move) {
      if (lastPlayerRegistered !== player || playersEncountered.size > 1) {
        move = undefined;
      }
    }

    if (lastEntry && lastEntry.player === player && lastEntry.move === move) {
      // Add to existing log entry
      if (amount) {
        set(lastEntry, `changes.${source}.${resource}`, (lastEntry.changes?.[source]?.[resource] ?? 0) + amount);
      }
    } else {
      // Add new entry
      this.advancedLog.push({
        player,
        move,
        changes: amount ? {
          [source]: {[resource]: amount}
        } : undefined
      });
    }
  }

  generateAvailableCommandsIfNeeded(subphase: SubPhase = null, data?: any): AvailableCommand[] {
    return this.availableCommands || this.generateAvailableCommands(subphase, data);
  }

  generateAvailableCommands(subphase: SubPhase = null, data?: any): AvailableCommand[] {
    return this.availableCommands = generateAvailableCommands(this, subphase, data);
  }

  findAvailableCommand(player: PlayerEnum, command: Command) {
    this.availableCommands = this.availableCommands || this.generateAvailableCommands();
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

  clearAvailableCommands() {
    this.availableCommands = null;
    this.availableCommand = null;
  }

  addPlayer(player: Player) {
    this.players.push(player);

    player.data.on(`gain-${Resource.TechTile}`, () => this.processNextMove(SubPhase.ChooseTechTile));
    player.data.on(`gain-${Resource.SpaceShip}`, (count: number) => {
      player.data.shipsToPlace = count;
      this.processNextMove(SubPhase.PlaceShip);
    });
    player.data.on(`gain-${Resource.AdvancedSpaceShip}`, (count: number) => {
      player.data.shipsToPlace = count;
      this.processNextMove(SubPhase.PlaceShip);
    });
    player.data.on(`gain-${Resource.TemporaryStep}`, () => this.processNextMove(SubPhase.BuildMine));
    player.data.on(`gain-${Resource.TemporaryRange}`, (count: number) => {
      if (this.findAvailableCommand(player.player, Command.MoveShip)) {
        assert(player.data.qicUsedToBoostShip === 0 && count === 2, "Impossible to gain range more than once during move ship phase");
        player.data.qicUsedToBoostShip += 1;
        this.processNextMove(SubPhase.MoveShip);
      } else {
        this.processNextMove(SubPhase.BuildMineOrGaiaFormer);
      }
    });
    player.data.on(`gain-${Resource.RescoreFederation}`, () => this.processNextMove(SubPhase.RescoreFederationTile));
    player.data.on(`gain-${Resource.PISwap}`, () => this.processNextMove(SubPhase.PISwap));
    player.data.on(`gain-${Resource.SpaceStation}`, () => this.processNextMove(SubPhase.SpaceStation));
    player.data.on(`gain-${Resource.DowngradeLab}`, () => {this.processNextMove(SubPhase.DowngradeLab); this.processNextMove(SubPhase.UpgradeResearch); });
    player.data.on(`gain-${Resource.UpgradeLowest}`, () => this.processNextMove(SubPhase.UpgradeResearch, {bescods: true}));
    player.data.on(`gain-${Resource.UpgradeZero}`, (count: number) => {
      for (let i = 0; i < count; i++) {
        this.processNextMove(SubPhase.UpgradeResearch, {zero: true});
      }
    });
    player.data.on(`gain-${Resource.MoveShips}`, () => {
      player.resetTemporaryVariables();
      player.data.movableShips = player.data.movingShips;
      player.data.movableShipLocations = [...player.data.shipLocations];

      this.processNextMove(SubPhase.MoveShip);
    });
    player.data.on(`gain-${Resource.MoveAllShips}`, () => {
      player.resetTemporaryVariables();
      player.data.movableShips = player.data.shipLocations.length;
      player.data.movableShipLocations = [...player.data.shipLocations];

      this.processNextMove(SubPhase.MoveShip);
    });
    player.on(`move-preset-ships`, () => {
      player.resetTemporaryVariables();
      this.processNextMove(SubPhase.MoveShip);
    });
    player.data.on('brainstone', areas => this.processNextMove(SubPhase.BrainStone, areas));
    // Test before upgrading research that it's actually possible. Needed when getting up-int or up-nav in
    // the spaceship expansion
    player.data.on('beforeResearchUpgrade', field => {
      const destTile = player.data.research[field] + 1;
      if (!player.canUpgradeResearch(field)) {
        player.data.canUpgradeResearch = false;
      } else if (destTile === researchTracks.lastTile(field) && this.players.some(pl => pl.data.research[field] === destTile)) {
        player.data.canUpgradeResearch = false;
      }
    });
    player.on('pick-rewards', () => this.processNextMove(SubPhase.PickRewards));

    /* For advanced log */
    for (const resource of [Resource.VictoryPoint, Resource.ChargePower, Resource.Credit, Resource.Qic, Resource.Knowledge, Resource.Ore, Resource.GainToken]) {
      player.data.on(`gain-${resource}`, (amount: number, source: EventSource) => this.log(player.player, resource, amount, source));
      player.data.on(`pay-${resource}`, (amount: number, source: EventSource) => this.log(player.player, resource, -amount, source));
    }
  }

  player(player: number): Player {
    return this.players[player];
  }

  playersInOrder(): Player[] {
    return this.turnOrder.map(i => this.players[i]);
  }

  /**
   * Get next players starting from `player`, finishing to the player before `player`
   * @param player
   */
  playersInTableOrderFrom(player: PlayerEnum): Player[] {

    const pos = this.turnOrderAfterSetupAuction.findIndex(pl => pl === player);
    const turn= [...this.turnOrderAfterSetupAuction.slice(pos), ...this.turnOrderAfterSetupAuction.slice(0, pos)];
    return turn.map(pl => this.players[pl]);
  }

  get turnOrderAfterSetupAuction(): PlayerEnum[] {
    return this.setup.map(faction => this.players.findIndex(pl => pl.faction == faction));
  }

  get playerToMove(): PlayerEnum {
    if (this.tempCurrentPlayer !== undefined) {
      return this.tempCurrentPlayer;
    }

    return this.currentPlayer;
  }

  numberOfPlayersWithFactions(): number {
    return this.players.filter(pl => pl.faction).length;
  }

  getNextPlayer(list: PlayerEnum[] = this.turnOrder) {
    return list[(list.indexOf(this.currentPlayer) + 1) % list.length];
  }

  moveToNextPlayer(list: PlayerEnum[], params: {loop?: boolean} = {loop: true}) {
    if (list.length === 0) {
      return false;
    }
    if (!(params.loop ?? true)) {
      // No loop, we just remove the first element of the list
      this.currentPlayer = list.shift();
    } else {
      this.currentPlayer = this.getNextPlayer(list);
    }

    return true;
  }

  /** Automatically move as a dropped player */
  autoPass() {
    const toMove = this.playerToMove;

    assert(toMove !== undefined, "Can't execute a move when no player can move");

    const pl = this.player(toMove);
    const ps = pl.faction || `p${toMove + 1}`;

    if (this.availableCommands.some(cmd => cmd.name === Command.Decline)) {
      const cmd = this.findAvailableCommand(this.playerToMove, Command.Decline);
      this.move(`${ps} ${Command.Decline} ${cmd.data.offer}`, false);
    } else if (this.availableCommands.some(cmd => cmd.name === Command.Pass)) {
      const cmd = this.findAvailableCommand(this.playerToMove, Command.Pass);
      const boosters = cmd.data.boosters;

      if (boosters.length > 0) {
        this.move(`${ps} ${Command.Pass} ${boosters[0]}`, false);
      } else {
        this.move(`${ps} ${Command.Pass}`, false);
      }
    } else if (this.availableCommands.some(cmd => cmd.name === Command.ChooseIncome)) {
      const cmd = this.findAvailableCommand(this.playerToMove, Command.ChooseIncome);
      this.move(`${ps} ${Command.ChooseIncome} ${cmd.data}`);
    } else if (this.availableCommands.some(cmd => cmd.name === Command.BrainStone)) {
      const cmd = this.findAvailableCommand(this.playerToMove, Command.BrainStone);
      this.move(`${ps} ${Command.BrainStone} ${cmd.data[0]}`);
    } else if (this.availableCommands.some(cmd => cmd.name === Command.PlaceShip)) {
      const cmd = this.findAvailableCommand(this.playerToMove, Command.PlaceShip);
      this.move(`${ps} ${Command.PlaceShip} ${cmd.data.locations[0].coordinates}`);
    } else if (this.availableCommands.some(cmd => cmd.name === Command.Spend && cmd.data.acts[0].cost.includes(Resource.GainTokenGaiaArea))) {
      // Terrans spending power in gaia phase to create resources
      this.move(`${ps} ${Command.Spend} ${pl.data.power.gaia}${Resource.GainTokenGaiaArea} for ${pl.data.power.gaia}${Resource.Credit}`);
    } else {
      assert(false, "Can't automove for player " + (this.playerToMove + 1) + ", available command: " + this.availableCommands[0].name);
    }

    // Again
    if (!this.availableCommands) {
      this.generateAvailableCommands();
    }
    if (this.playerToMove === toMove) {
      this.autoPass();
    }
  }

  /**
   * Automatically leech when there's no cost
   */
  autoChargePower(): boolean {
    if (this.playerToMove === undefined) {
      return false;
    }
    this.generateAvailableCommandsIfNeeded();
    const cmd = this.findAvailableCommand(this.playerToMove, Command.ChargePower);
    if (!cmd) {
      return false;
    }

    const offers = cmd.data.offers;

    const pl = this.player(this.playerToMove);
    const offer = offers[0].offer;
    const power = Reward.parse(offer)[0].count;

    // A passed player in last round should always decline a leech if there's a VP
    // cost associated with it.
    // If this not true, please add an example (or link to) in the comments
    if (this.isLastRound && this.passedPlayers.includes(pl.player)) {
      if (!offers.some(offer => offer.cost === '~')) {
        this.move(`${pl.faction} ${Command.Decline} ${offer}`, false);
        return true;
      }
    }

    // Only leech when only one option and cost is nothing
    if (offers.length > 1 || power > (pl.data.autoChargePower ?? 1) ) {
      return false;
    }

    // Itars may want to burn power instead, but we can safely move to area2
    if (pl.faction === Faction.Itars && !this.autoChargeItars(pl.data.power.area1, power) && !this.isLastRound) {
      return false;
    }

    try {
      this.move(`${pl.faction} ${Command.ChargePower} ${offer}`, false);
      return true;
    } catch (err) {
      /* Restore player data to what it was, like if the taklons cause an incomplete move error requiring brainstone destination */
      // pl.loadPlayerData(jsonData);
      this.generateAvailableCommands();
      return false;
    }
  }

  autoChargeItars(area1: number, power: number) {
    return area1 >= power;
  }

  static fromData(data: any) {
    const engine = new Engine();

    if (!data) {
      return engine;
    }

    for (const key of Object.keys(data)) {
      // Skip map, players, and getters
      if (key === "map" || key === "players" || Object.getOwnPropertyDescriptor(Engine.prototype, key)?.get) {
        continue;
      }

      engine[key] = data[key];
    }

    engine.sanitizeOptions();

    if (data.map) {
      engine.map = SpaceMap.fromData(data.map);
      engine.map.nbPlayers = data.players.length;
      engine.map.layout = engine.options.layout;
      engine.map.placement = engine.options.map;
    }

    for (const player of data.players) {
      engine.addPlayer(Player.fromData(player, engine.map, engine.expansions));
    }

    if (data.map) {
      for (const hex of engine.map.grid.values()) {
        for (const player of hex.occupyingPlayers()) {
          engine.player(player).data.occupied.push(hex);
        }
        // for (const player of (hex.data.ships || [])) {
        //   engine.player(player).data.shipLocations.push(hex);
        // }
      }
    }

    return engine;
  }

  toJSON() {
    // Export getters as well as data
    const proto = Object.getPrototypeOf(this);
    const jsonObj: any = Object.assign({}, this);

    Object.entries(Object.getOwnPropertyDescriptors(proto))
      .filter(([key, descriptor]) => typeof descriptor.get === 'function')
      .map(([key, descriptor]) => {
        if (descriptor && key[0] !== '_') {
          try {
            const val = (this as any)[key];
            jsonObj[key] = val;
          } catch (error) {
            // console.error(`Error calling getter ${key}`, error);
          }
        }
      });

    return jsonObj;
  }

  static slowMotion([first, ...moves]: string[], options: EngineOptions = {}): Engine {
    if (!first) {
      return new Engine([], options);
    }
    let state = JSON.parse(JSON.stringify(new Engine([first], options)));

    for (const move of moves) {
      const tempEngine = Engine.fromData(state);
      tempEngine.move(move);
      state = JSON.parse(JSON.stringify(tempEngine));
    }

    return Engine.fromData(state);
  }

  static parseMoves(moves: string) {
    return moves.trim().split("\n").map(move => move.trim());
  }

  /**
   * Load turn moves.
   *
   * @param move The move string to process. Can contain multiple moves separated by a dot
   * @param params params.processFirst indicates to process the first move. params.split is set to true if leftover commands are allowed
   */
  loadTurnMoves(move: string, params: {split?: boolean; processFirst?: boolean} = {split: true, processFirst: false}) {
    this.oldPhase = this.phase;

    const playerS = move.substr(0, move.indexOf(' '));
    let player: number;

    if (/^p[1-7]$/.test(playerS)) {
      player = +playerS[1] - 1;
    } else {
      const  pl = this.players.find(_pl => _pl.faction === playerS);

      if (pl) {
        player = pl.player;
      }
    }

    assert(this.playerToMove === (player as PlayerEnum), "Wrong turn order in move " + move + ", expected player " + (this.playerToMove + 1));
    this.processedPlayer = player;

    const split = params.split ?? true ;
    const processFirst = params.processFirst ?? true;

    if (!split) {
      assert(processFirst);
    }

    this.turnMoves = move.substr(playerS.length).split('.').map(x => x.trim());

    if (processFirst) {
      this.processNextMove();

      assert(split || this.turnMoves.length === 0, "There is an extra command at the end of the turn: " + this.turnMoves.join('. '));
    }
  }

  /**
   * Return true if it is a full move
   * @param move
   */
  executeMove(move: string) {
    try {
      (this[this.phase])(move);
      this.clearAvailableCommands();
    } catch (err) {
      if (err.availableCommands) {
        this.availableCommands = err.availableCommands;
        return this.playerToMove !== this.processedPlayer || this.phase !== this.oldPhase;
      } else {
        throw err;
      }
    }

    return true;
  }

  parseMove(move: string) {
    const split = move.split(' ');
    return {
      command: (split[0] || Command.EndTurn) as Command,
      args: split.slice(1)
    };
  }

  processNextMove(subphase?: SubPhase, data?: any) {
    if (subphase) {
      this.generateAvailableCommands(subphase, data);
      if (this.availableCommands.length === 0) {
        return;
      }
    }
    if (this.turnMoves.length === 0) {
      throw Object.assign(new Error('Missing command to end turn'), {availableCommands: this.availableCommands});
    }
    const move = this.parseMove(this.turnMoves.shift());

    this.checkCommand(move.command);
    (this[move.command === Command.MoveShip ? "_move" : move.command] as any)(this.playerToMove, ...move.args);

    return move;
  }

  peekNextMove() {
    return this.parseMove(this.turnMoves[0]);
  }

  checkCommand(command: Command) {
    assert(this.availableCommand = this.findAvailableCommand(this.playerToMove, command), `Command ${command} is not in the list of available commands: ${this.availableCommands.map(cmd => cmd.name)}`);
  }

  doFreeActions(subPhase: SubPhase) {
    while (this.turnMoves.length > 0) {
      if (![Command.Spend, Command.BurnPower].includes(this.peekNextMove().command)) {
        return;
      }

      this.processNextMove();
      this.generateAvailableCommands(subPhase);
    }
  }

  handleMainMove() {
    if (this.processNextMove().command === Command.Pass) {
      return Command.Pass;
    } else {
      this.generateAvailableCommands(SubPhase.AfterMove);
    }
  }

  handleEndTurn() {
    this.processNextMove();
  }

  get currentRoundScoringEvents() {
    const roundScoringTile = this.tiles.scorings.round[this.round - 1];
    return Event.parse(roundScorings[roundScoringTile], `round${this.round}` as RoundScoring);
  }

  /**
   * Handle income phase of current player, and the one after that and so on.
   * Pauses if an action is needed from the player.
   */
  handleNextIncome() {
    if (this.player(this.currentPlayer).needIncomeSelection().needed) {
      return false;
    }

    this.player(this.currentPlayer).receiveIncome();

    if (!this.moveToNextPlayer(this.tempTurnOrder, {loop: false})) {
      this.endIncomePhase();
    } else {
      this.handleNextIncome();
    }

    return true;
  }

  handleNextGaia(afterCommand = false) {
    const player = this.player(this.currentPlayer);

    if (!afterCommand) {
      // The player didn't have a chance to decline their gaia action yet
      player.declined = false;
    }

    if (!player.declined && (player.canGaiaTerrans() || player.canGaiaItars())) {
      return false;
    }

    player.gaiaPhase();

    if (!this.moveToNextPlayer(this.tempTurnOrder, {loop: false})) {
      this.endGaiaPhase();
    } else {
      this.handleNextGaia();
    }

    return true;
  }

  // ****************************************
  // ********** PHASE BEGIN / END ***********
  // ****************************************
  changePhase(phase: Phase) {
    this.phase = phase;
  }

  beginSetupBoardPhase() {
    this.changePhase(Phase.SetupBoard);
    // The last player is the one to rotate the sectors
    this.currentPlayer = this.players.slice(-1).pop().player;

    if (!this.options.advancedRules) {
      // No sector rotation
      this.beginSetupFactionPhase();
      return;
    }
  }

  beginSetupFactionPhase() {
    this.changePhase(Phase.SetupFaction);
    this.turnOrder = this.players.map(pl => pl.player as PlayerEnum);
    this.moveToNextPlayer(this.turnOrder, {loop: false});
  }

  beginSetupAuctionPhase() {
    this.changePhase(Phase.SetupAuction);
    this.turnOrder = this.players.map(pl => pl.player as PlayerEnum);

    this.moveToNextPlayer(this.turnOrder, {loop: false});
  }

  endSetupAuctionPhase() {
    for ( const pl of this.players ){
      if (pl.faction) {
        pl.loadFaction(pl.faction, this.expansions);
      } else {
        pl.loadFaction(this.setup[pl.player as PlayerEnum], this.expansions);
      }
    }

    this.beginSetupBuildingPhase();
  }

  beginSetupBuildingPhase() {
    this.changePhase(Phase.SetupBuilding);

    const posIvits = this.players.findIndex(
      player => player.faction === Faction.Ivits
    );

    const setupTurnOrder = this.turnOrderAfterSetupAuction
          .filter(i => i !== posIvits);
    const reverseSetupTurnOrder = setupTurnOrder.slice().reverse();
    this.turnOrder = setupTurnOrder.concat(reverseSetupTurnOrder);

    const posXenos = this.players.findIndex(
      player => player.faction === Faction.Xenos
    );

    if (posXenos !== -1) {
      this.turnOrder.push(posXenos as PlayerEnum);
    }

    if (posIvits !== -1) {
      this.turnOrder.push(posIvits as PlayerEnum);
    }

    this.moveToNextPlayer(this.turnOrder, {loop: false});
  }

  beginSetupBoosterPhase() {
    this.changePhase(Phase.SetupBooster);
    this.turnOrder = this.turnOrderAfterSetupAuction.reverse();
    this.moveToNextPlayer(this.turnOrder, {loop: false});
  }

  beginSetupShipPhase() {
    this.changePhase(Phase.SetupShip);
    this.turnOrder = this.turnOrderAfterSetupAuction;
    this.moveToNextPlayer(this.turnOrder, {loop: false});
  }

  beginRoundStartPhase() {
    this.round += 1;
    this.advancedLog.push({round: this.round});
    this.turnOrder = this.passedPlayers || this.turnOrderAfterSetupAuction;
    this.passedPlayers = [];
    this.currentPlayer = this.turnOrder[0];

    for (const player of this.playersInOrder()) {
      player.loadEvents(this.currentRoundScoringEvents);
    }

    this.beginIncomePhase();
  }

  beginIncomePhase() {
    this.changePhase(Phase.RoundIncome);
    this.advancedLog.push({phase: Phase.RoundIncome});
    this.tempTurnOrder = [...this.turnOrder];

    this.moveToNextPlayer(this.tempTurnOrder, {loop: false});
    this.handleNextIncome();
  }

  endIncomePhase() {
    // remove incomes from roundboosters
    for (const player of this.playersInOrder()) {
      player.removeRoundBoosterEvents( Operator.Income );
    }

    this.beginGaiaPhase();
  }

  beginGaiaPhase() {
    this.changePhase(Phase.RoundGaia);
    this.advancedLog.push({phase: Phase.RoundGaia});
    this.tempTurnOrder = [...this.turnOrder];

    // transform Transdim planets into Gaia if gaiaformed
    for (const hex of this.map.toJSON()) {
      if (hex.data.planet === Planet.Transdim && hex.data.player !== undefined && hex.data.building === Building.GaiaFormer) {
        hex.data.planet = Planet.Gaia;
      }
    }

    this.moveToNextPlayer(this.tempTurnOrder, {loop: false});
    this.handleNextGaia();
  }

  endGaiaPhase() {
    this.currentPlayer = this.turnOrder[0];
    this.beginRoundMovePhase();
  }

  beginRoundMovePhase() {
    this.changePhase(Phase.RoundMove);
  }

  cleanUpPhase() {
    for (const player of this.players) {
      // remove roundScoringTile
      player.removeEvents(this.currentRoundScoringEvents);

      // resets special action
      for (const event of player.events[Operator.Activate]) {
        event.activated = false;
      }
    }
    // resets power and qic actions
    BoardAction.values(this.expansions).forEach((pos: BoardAction) => {
      this.boardActions[pos] = true;
    });

    if (this.isLastRound) {
      this.finalScoringPhase();
    } else {
      this.beginRoundStartPhase();
    }
  }

  get ended() {
    return this.phase === Phase.EndGame;
  }

  set ended(val: boolean) {
    assert(val, "You can't set ended to false");
    this.phase = Phase.EndGame;
  }

  get isLastRound() {
    return this.round === Round.LastRound;
  }

  finalScoringPhase() {
    this.changePhase(Phase.EndGame);
    this.advancedLog.push({phase: Phase.EndGame});
    this.currentPlayer = this.tempCurrentPlayer = undefined;

    const allRankings: Array<Array<{player: Player; count: number}>> = [];

    // finalScoring tiles
    for (const tile of this.tiles.scorings.final) {
      const players = sortBy(this.players, player => player.finalCount(tile)).reverse();

      const rankings = players.map(pl => ({
        player: pl,
        count: pl.finalCount(tile)
      }));

      if (this.players.length === 2) {
        rankings.push({ player: null, count: finalScorings[tile].neutralPlayer });
        rankings.sort((pl1, pl2) => pl2.count - pl1.count);
      }

      allRankings.push(rankings);
    }

    // Group gained points per player
    for (const player of this.players) {
      // Gain points from final scoring
      allRankings.forEach((rankings, index) => {
        const ranking = rankings.find(rnk => rnk.player === player);

        const count = ranking.count;
        // index of the first player with that score
        const first = rankings.findIndex(pl => pl.count === count);
        // number of other players with the same score
        const ties = rankings.filter(pl => pl.count === count).length;

        // only players that advaced are getting VPs
        // see https://boardgamegeek.com/thread/1929227/0-end-score-0-vp
        if (ranking.player && count > 0) {
          const VPs = [18, 12, 6, 0, 0, 0];

          ranking.player.gainRewards([new Reward(Math.floor(sum(VPs.slice(first, first + ties)) / ties), Resource.VictoryPoint)], `final${index + 1}` as 'final1' | 'final2');
        }
      });

      // research VP and remaining resources
      player.data.gainFinalVictoryPoints();

      //remove bids
      player.gainRewards([new Reward(Math.max(Math.floor(-1*player.data.bid )), Resource.VictoryPoint)], Command.Bid);
    }
  }

  beginLeechingPhase() {
    if (this.leechSources.length === 0) {
      this.beginRoundMovePhase();
      return;
    }
    const source = this.leechSources.shift();
    const sourceHex = this.map.getS(source.coordinates);
    const isTrade = source.tradeDelivery !== undefined;
    const canLeechPlayers: Player[] = [];

    this.lastLeechSource = source;

    // Gaia-formers & space stations don't trigger leech
    if (!isTrade && stdBuildingValue(sourceHex.buildingOf(source.player)) === 0) {
      return this.beginLeechingPhase(); // next building on the list
    }
    // From rules, this is in clockwise order. We assume the order of players in this.players is the
    // clockwise order
    for (const pl of this.playersInTableOrderFrom(source.player)) {
      // If pl is the one that made the building, exclude from leeching
      if (source.player === pl.player) {
        pl.data.leechPossible = 0;
        continue;
      }
      if (isTrade && source.tradeDelivery !== pl.player) {
        pl.data.leechPossible = 0;
        continue;
      }

      // Exclude the one who made the building from the leech
      let leech = 0;
      for (const hex of this.map.withinDistance(sourceHex, isTrade ? 0 : LEECHING_DISTANCE)) {
        leech = Math.max(leech, pl.buildingValue(this.map.grid.get(hex)));
      }

      // Do not use maxLeech() here, cuz taklons
      pl.data.leechPossible = leech;
      if (pl.canLeech() || isTrade) {
        canLeechPlayers.push(pl);
      }
    }

    if (canLeechPlayers.length > 0) {
      this.changePhase(Phase.RoundLeech);
      this.tempTurnOrder = canLeechPlayers.map(pl => pl.player);
      this.tempCurrentPlayer = this.tempTurnOrder.shift();
    } else {
      return this.beginLeechingPhase();
    }
  }

  advanceResearchAreaPhase(player: PlayerEnum, cost: string, field: ResearchField ) {
    const pl = this.player(player);

    if (!pl.canUpgradeResearch(field)) {
      return;
    }

    const destTile = pl.data.research[field] + 1;

    // If someone is already on last tile
    if (destTile === researchTracks.lastTile(field)) {
      if (this.players.some(pl2 => pl2.data.research[field] === destTile)) {
        return;
      }
    }

    pl.payCosts(Reward.parse(cost), Command.UpgradeResearch);
    pl.gainRewards([new Reward(`${Command.UpgradeResearch}-${field}`)], Command.UpgradeResearch);

    if (pl.data.research[field] === researchTracks.lastTile(field)) {
      if (field === ResearchField.Terraforming) {
        // gets federation token
        if (this.terraformingFederation) {
          pl.gainFederationToken(this.terraformingFederation);
          this.terraformingFederation = undefined;
        }
      } else if (field === ResearchField.Navigation) {
        // gets LostPlanet
        this.processNextMove(SubPhase.PlaceLostPlanet);
      } else if (field === ResearchField.TradingVolume) {
        pl.gainFederationToken(Federation.Ship);
      }
    }
  }

  // ****************************************
  // ******** PHASE COMMAND HANDLING ********
  // ****************************************
  [Phase.SetupInit](move: string) {
    const split = move.split(' ');
    const command = split[0] as Command;

    assert(command === Command.Init, "The first command of a game needs to be the initialization command");

    (this[Command.Init] as any)(...split.slice(1));

    this.beginSetupBoardPhase();
  }

  [Phase.SetupBoard](move: string) {
    this.loadTurnMoves(move, {split: false, processFirst: true});

    this.beginSetupFactionPhase();
  }

  [Phase.SetupFaction](move: string) {
    this.loadTurnMoves(move, {split: false, processFirst: true});

    if (!this.moveToNextPlayer(this.turnOrder, {loop: false})) {
      if (this.options.auction) {
        this.beginSetupAuctionPhase();
      } else {
        this.endSetupAuctionPhase();
      }
      return;
    }
  }

  [Phase.SetupAuction](move: string) {
    this.loadTurnMoves(move, {processFirst: true});

    const player = [...range(this.currentPlayer + 1, this.players.length), ...range(0, this.currentPlayer)].find(player => !this.players.some(pl => pl.player === player && pl.faction));

    if (player !== undefined) {
       this.currentPlayer = player;
    } else {
       this.endSetupAuctionPhase();
    }
  }

  [Phase.SetupBuilding](move: string) {
    this.loadTurnMoves(move, {split: false, processFirst: true});

    if (!this.moveToNextPlayer(this.turnOrder, {loop: false})) {
      if (this.expansions & Expansion.Spaceships) {
        this.beginSetupShipPhase();
      } else {
        this.beginSetupBoosterPhase();
      }
    }
  }

  [Phase.SetupShip](move: string) {
    this.loadTurnMoves(move, {split: false, processFirst: true});

    if (!this.moveToNextPlayer(this.turnOrder, {loop: false})) {
      this.beginSetupBoosterPhase();
    }
  }

  [Phase.SetupBooster](move: string) {
    this.loadTurnMoves(move, {split: false, processFirst: true});

    if (!this.moveToNextPlayer(this.turnOrder, {loop: false})) {
      this.beginRoundStartPhase();
    }
  }

  [Phase.RoundIncome](move: string) {
    this.loadTurnMoves(move, {processFirst: true});

    while (!this.handleNextIncome()) {
      this.generateAvailableCommands();
      this.processNextMove();
    }
  }

  [Phase.RoundGaia](move: string) {
    this.loadTurnMoves(move, {processFirst: true});

    while (!this.handleNextGaia(true)) {
      this.generateAvailableCommands();
      this.processNextMove();
    }
  }

  [Phase.RoundMove](move: string) {
    const pl = this.player(this.playerToMove);
    pl.data.turns = 1;

    this.loadTurnMoves(move);

    const playerAfter = this.getNextPlayer();

    while (pl.data.turns > 0) {
      pl.resetTemporaryVariables();

      // Execute all upcoming freeactions
      this.doFreeActions(SubPhase.BeforeMove);

      // If queue is empty, interrupt and ask for free actions / main command
      // otherwise execute main command
      const executedCommand = this.handleMainMove();
      pl.resetTemporaryVariables();
      pl.data.turns -= 1;

      if (executedCommand === Command.Pass) {
        if (this.turnOrder.length === 0) {
          this.cleanUpPhase();
          return;
        } else {
          break;
        }
      } else if (pl.data.turns <= 0) {
        // Execute all upcoming freeactions
        this.doFreeActions(SubPhase.AfterMove);

        // If the player has no possible command or the queue has the end turn command,
        // end turns.
        // If the player has possible free actions & the queue is empty, ask for free actions / end turn
        this.handleEndTurn();
      } else {
        this.generateAvailableCommands();
      }
    }

    this.beginLeechingPhase();
    this.currentPlayer = playerAfter;
  }

  [Phase.RoundLeech](move: string) {
    this.loadTurnMoves(move, {split: false, processFirst: true});
    this.tempCurrentPlayer = this.tempTurnOrder.shift();

    // Current leech round ended
    if (this.tempCurrentPlayer === undefined) {
      // Next leech rounds (eg: double leech happens with lab + lost planet in same turn)
      this.beginLeechingPhase();
    }
  }

  // ****************************************
  // ************** COMMANDS ****************
  // ****************************************
  [Command.Init](players: string, seed: string) {
    const nbPlayers = +players || 2;
    seed = seed || 'defaultSeed';

    assert(nbPlayers >= 2 && nbPlayers <= 5, "Invalid number of players");

    this.map = new SpaceMap(nbPlayers, seed, this.options.map?.mirror ?? false, this.options.layout);

    if (this.options.map?.sectors) {
      this.map.load(this.options.map);
    }
    this.options.map = this.map.placement;

    // Choose nbPlayers+3 boosters as part of the pool
    const boosters = shuffleSeed.shuffle(Booster.values(this.expansions), this.map.rng()).slice(0, nbPlayers + 3);
    for (const booster of boosters) {
      this.tiles.boosters[booster] = true;
    }

    // Shuffle tech tiles
    const techtiles = shuffleSeed.shuffle(TechTile.values(this.expansions), this.map.rng());
    TechTilePos.values(this.expansions).forEach( (pos, i) => {
      this.tiles.techs[pos] = {tile: techtiles[i], count: 4};
    });
    this.tiles.techs[TechTilePos.BasicShip] = {tile: TechTile.Ship0, count: 0};

    // Choose adv tech tiles as part of the pool
    const advtechtiles = shuffleSeed.shuffle(AdvTechTile.values(this.expansions), this.map.rng());
    AdvTechTilePos.values(this.expansions).forEach( (pos, i) => {
      this.tiles.techs[pos] = {tile: advtechtiles[i], count: 1};
    });

    // powerActions
    BoardAction.values(this.expansions).forEach( (pos: BoardAction) => {
      this.boardActions[pos] = true;
    });

    const feds = Federation.values();
    this.terraformingFederation = shuffleSeed.shuffle(feds, this.map.rng())[0];
    for (const federation of feds) {
      this.tiles.federations[federation] = 3;
    }
    this.tiles.federations[this.terraformingFederation] -= 1;

    // Choose roundScoring Tiles as part of the pool
    const roundscoringtiles = shuffleSeed.shuffle(ScoringTile.values(this.expansions), this.map.rng()).slice(0, 6);
    this.tiles.scorings.round = roundscoringtiles;

    // Choose finalScoring Tiles as part of the pool
    const finalscoringtiles = shuffleSeed.shuffle(FinalTile.values(this.expansions), this.map.rng()).slice(0, 2);
    this.tiles.scorings.final = finalscoringtiles;

    this.players = [];
    this.setup = [];

    for (let i = 0; i < nbPlayers; i++) {
      this.addPlayer(new Player(i));
    }

    // With the expansion, each player starts with a tech tile
    if (this.expansions & Expansion.Spaceships) {
      for (const player of this.players) {
        player.gainTechTile(TechTile.Ship0, TechTilePos.BasicShip);
      }
    }
  }

  [Command.RotateSectors](player: PlayerEnum, ...params: string[]) {
    assert(params.length % 2 === 0, "The rotate command needs an even number of parameters");

    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < params.length; i += 2) {
      pairs.push([params[i], params[i + 1]]);
    }

    assert(uniq(pairs.map(pair => pair[0])).length === params.length / 2, "Duplicate rotations are not allowed");

    for (const pair of pairs) {
      this.map.rotateSector(pair[0], +pair[1]);
    }
    this.map.recalibrate();
    assert(this.map.isValid(), "Map is invalid with two planets for the same type being near each other");
  }

  [Command.ChooseFaction](player: PlayerEnum, faction: string) {
    assert(this.availableCommand.data.includes(faction), `${faction} is not in the available factions`);
    this.setup.push( faction as Faction );
  }

  [Command.Bid](player: PlayerEnum, faction: string, bid: number) {
    const bidsAC  = this.availableCommand.data.bids;
    const bidAC = bidsAC.find( b => b.faction === faction);
    assert( bidAC.bid.includes(+bid), 'You have to bid the right amount');
    assert( bidAC, `${faction} is not in the available factions`);

    const previous = this.players.find(s => s.faction == faction);
    // remove faction from previous owner
    if (previous) {
      previous.faction = undefined;
    }

    this.players[player].faction = faction as Faction;
    this.players[player].data.bid = +bid;
  }

  [Command.ChooseRoundBooster](player: PlayerEnum, booster: Booster, fromCommand: Command = Command.ChooseRoundBooster ) {
    const { boosters } = this.availableCommand.data;

    assert(boosters.includes(booster), `${booster} is not in the available boosters`);

    this.tiles.boosters[booster] = false;
    this.players[player].getRoundBooster(booster);
  }

  [Command.Build](player: PlayerEnum, building: Building, location: string) {
    const { buildings } = this.availableCommand.data;
    const parsed = this.map.parse(location);

    for (const elem of buildings) {
      if (elem.building === building && isEqual(this.map.parse(elem.coordinates), parsed)) {
        const {q, r} = this.map.parse(location);
        const hex = this.map.grid.get({q, r});
        const pl = this.player(player);

        pl.build(building, hex, Reward.parse(elem.cost), this.map, elem.steps);

        // will trigger a LeechPhase
        if (this.phase === Phase.RoundMove) {
          this.leechSources.unshift({player, coordinates: location});
        }

        return;
      }
    }

    assert(false, `Impossible to execute build command at ${location}`);
  }

  [Command.UpgradeResearch](player: PlayerEnum, field: ResearchField) {
    const { tracks } = this.availableCommand.data;
    const track = tracks.find(tr => tr.field === field);

    assert(track, `Impossible to upgrade research for ${field}`);

    this.advanceResearchAreaPhase(player, track.cost, field);
  }

  [Command.Pass](player: PlayerEnum, booster: Booster) {
    this.tiles.boosters[this.players[player].data.tiles.booster] = true;
    this.players[player].pass();

    if (!this.isLastRound) {
      (this[Command.ChooseRoundBooster] as any)(player, booster, Command.Pass);
    }

    this.passedPlayers.push(player);
    this.turnOrder.splice(this.turnOrder.indexOf(player), 1);
  }

  [Command.ChargePower](player: PlayerEnum, income: string) {
    const leechCommand = this.availableCommand.data;
    // leech rewards are including +t, if needed and in the right sequence
    const leechRewards = Reward.parse(income);

    // Handles legacy stuff. To remove when all games with old engine have ended
    if (!leechCommand.offers) {
      leechCommand.offers = [{offer: leechCommand.offer, cost: leechCommand.cost}];
    }

    const offer = leechCommand.offers.find(ofr => ofr.offer === income);

    assert(offer, `Cannot leech ${income}. Possible leeches: ${leechCommand.offers.map(ofr => ofr.offer).join(' - ')}`);

    this.player(player).gainRewards(leechRewards, Command.ChargePower);
    this.player(player).payCosts(Reward.parse(offer.cost), Command.ChargePower);
  }

  [Command.Decline](player: PlayerEnum) {
    this.player(player).declined = true;
  }

  [Command.EndTurn](player: PlayerEnum) {
    // this.player(player).endTurn();
  }

  [Command.ChooseTechTile](player: PlayerEnum, pos: TechTilePos | AdvTechTilePos) {
    const { tiles } = this.availableCommand.data;
    const tileAvailable = tiles.find(ta => ta.pos === pos);

    assert(tileAvailable !== undefined, `Impossible to get ${pos} tile`);

    // BEFORE gaining the tech tile (e.g. the ship+move tech tile can generate trade, and so the tech tile
    // with trade >> 2vp needs to be covered before)
    if (isAdvanced(pos)) {
      this.processNextMove(SubPhase.CoverTechTile);
    }

    this.player(player).gainTechTile(tileAvailable.tile, tileAvailable.pos);
    this.tiles.techs[pos].count -= 1;

    // AFTER gaining the tech tile (as green federation can be flipped and lock research tracks)
    this.processNextMove(SubPhase.UpgradeResearch, ResearchField.values(Expansion.All).includes(pos as any as ResearchField) ? {pos} : undefined) ;
  }

  [Command.ChooseCoverTechTile](player: PlayerEnum, tilePos: TechTilePos) {
    const { tiles } = this.availableCommand.data;
    const tileAvailable = tiles.find(ta => ta.pos === tilePos);

    assert(tileAvailable !== undefined, `Impossible to cover ${tilePos} tile`);
    // remove tile
    this.player(player).coverTechTile(tileAvailable.pos);
  }

  [Command.Special](player: PlayerEnum, income: string) {
    const { specialacts } = this.availableCommand.data;
    const actAvailable = specialacts.find(sa => Reward.match(Reward.parse(sa.income), Reward.parse(income)));

    assert(actAvailable !== undefined, `Special action ${income} is not available`);

    // mark as activated special action for this turn
    // triggers buildMine subphase from the activation
    this.player(player).activateEvent(actAvailable.spec);
  }

  [Command.ChooseFederationTile](player: PlayerEnum, federation: Federation) {
    const { tiles, rescore } = this.availableCommand.data;

    assert(tiles.indexOf(federation) !== -1, `Federation ${federation} is not availabe`);

    if (rescore) {
      this.player(player).gainRewards(Reward.parse(federations[federation]), BoardAction.Qic2);
    } else {
      this.player(player).gainFederationToken(federation);
      this.tiles.federations[federation] -= 1;
    }
  }

  [Command.PlaceLostPlanet](player: PlayerEnum, location: string) {
    const { spaces } = this.availableCommand.data;
    const parsed = this.map.parse(location);

    const data = spaces.find(space =>  isEqual(this.map.parse(space.coordinates), parsed));

    assert(data, `Impossible to execute build command at ${location}`);

    const hex = this.map.getS(location);
    hex.data.planet = Planet.Lost;

    this.player(player).build(Building.Mine, hex, Reward.parse(data.cost), this.map, 0);

    this.leechSources.unshift({player, coordinates: location});
  }

  [Command.PlaceShip](player: PlayerEnum, location: string) {
    const pl = this.player(player);
    const { locations } = this.availableCommand.data;
    const parsed = this.map.parse(location);

    assert(locations.find(loc => isEqual(this.map.parse(loc.coordinates), parsed), `Impossible to place ship at ${location}`));

    const hex = this.map.grid.get(parsed);
    pl.placeShip(hex);

    pl.data.shipsToPlace -= 1;
    if (pl.data.shipsToPlace > 0) {
      this.processNextMove(SubPhase.PlaceShip);
    }
  }

  [Command.DeliverTrade](player: PlayerEnum, location: string) {
    assert(location === this.availableCommand.data.locations[0].coordinates, "Impossible to deliver trade at " + location);
    const destHex = this.map.getS(location);

    this.player(player).deliverTrade(destHex);
    // The main occupier of the planet can charge power
    this.leechSources.push({player, coordinates: location, tradeDelivery: destHex.data.player});
  }

  [`_${Command.MoveShip}`](player: PlayerEnum, ship: string, dest: string) {
    const pl = this.player(player);
    // tslint:disable-next-line no-shadowed-variable
    const { ships, range, costs } = this.availableCommand.data;
    const parsedShip = this.map.parse(ship);

    assert(ships.find(loc => isEqual(this.map.parse(loc.coordinates), parsedShip), `There is no movable ship at ${ship}`));

    const distance = this.map.distance(parsedShip, this.map.parse(dest));

    assert(range >= distance, 'The ship cannot move that far');

    const moveCost = costs[distance] || "~";
    pl.payCosts(Reward.parse(moveCost), Command.MoveShip);

    pl.removeShip(this.map.grid.get(parsedShip));

    const destHex = this.map.getS(dest);

    if (pl.data.availableWildTradeTokens() > 0) {
      assert (!destHex.hasTradeToken(player) || !destHex.hasWildTradeToken(), `The destination planet already has a trade token for your faction`);
    } else {
      assert (!destHex.hasTradeToken(player), `The destination planet already has a trade token for your faction`);
    }

    pl.placeShip(destHex);

    if (destHex.hasPlanet()) {
      if (destHex.occupied()) {
        assert(destHex.hasStructure(), `When moving a ship to an occupied planet, there needs to be a valid building on it`);
        assert(!destHex.isMainOccupier(player), "You can't move a ship to a planet that is occupied by you.");

        const canPutTradeToken = pl.data.availableTradeTokens() > 0 && !destHex.hasTradeToken(player);
        const canPutWildTradeToken = pl.data.availableWildTradeTokens() > 0 && !destHex.hasWildTradeToken();

        assert(canPutTradeToken || canPutWildTradeToken, "Impossible to put a trade token on the planet, either you already have a token there or all your tokens are used");

        this.processNextMove(SubPhase.DeliverTrade, {locations: [{coordinates: dest}], automatic: true});
      } else {
        const planet = destHex.data.planet;
        const building = planet === Planet.Transdim ? Building.GaiaFormer : Building.Mine;

        const {possible, cost, steps} = pl.canBuild(planet, building);
        assert(possible, "Impossible to move ship to this empty planet as you cannot build there");

        this.processNextMove(SubPhase.BuildMineOrGaiaFormer, {buildings: [{
          building,
          coordinates: dest,
          cost: Reward.toString(cost),
          steps
        }], automatic: true});
      }

      pl.removeShip(destHex);
    }

    pl.data.movableShips -= 1;
    pl.data.movableShipLocations.splice(pl.data.movableShipLocations.indexOf(ship), 1);

    if (pl.data.movableShips > 0) {
      this.processNextMove(SubPhase.MoveShip);
    }
  }

  [Command.PickReward](player: PlayerEnum, rewardString: string) {
    const pl = this.player(player);
    const reward = new Reward(rewardString);
    const index = pl.data.toPick.rewards.findIndex(rw => rw.type === reward.type && rw.count === reward.count);

    assert(index !== -1, "Cannot pick " + rewardString);

    pl.gainRewards([reward], pl.data.toPick.source);
    pl.data.toPick.count -= 1;
    pl.data.toPick.rewards.splice(index, 1);

    // Pick remaining reward
    if (pl.data.toPick.count > 0) {
      this.processNextMove(SubPhase.PickRewards);
    }
  }

  [Command.Spend](player: PlayerEnum, costS: string, _for: "for", incomeS: string) {
    const { acts: actions } = this.availableCommand.data;

    const pl = this.player(player);
    const cost = Reward.merge(Reward.parse(costS));
    const income = Reward.merge(Reward.parse(incomeS));

    assert(!cost.some(r => r.count <= 0) && !income.some(r => r.count <= 0), "Nice try!");
    assert(pl.canPay(cost) && cost, `Impossible to pay ${costS}`);
    assert(_for === 'for', "Expect second part of command to be 'for'");

    // tslint:disable-next-line no-shadowed-variable
    const isPossible = (cost: Reward[], income: Reward[]) => {
      for (const action of actions) {
        const actionCost = Reward.parse(action.cost);
        if (Reward.includes(cost, actionCost)) {
          // Remove income & cost of action
          const newCost = Reward.merge(cost, Reward.negative(actionCost));
          let newIncome = Reward.merge(income, Reward.negative(Reward.parse(action.income)));

          // Convert unused income into cost
          newCost.push(...Reward.negative(newIncome.filter(rew => rew.count < 0)));
          newIncome = newIncome.filter(rew => rew.count > 0);

          if (newIncome.length === 0 && newCost.length === 0) {
            return true;
          }

          if (isPossible(newCost, newIncome)) {
            return true;
          }
        }
      }
      return false;
    };

    assert(isPossible(cost, income), `spend ${cost} for ${income} is not allowed`);

    pl.payCosts(cost, Command.Spend);
    pl.gainRewards(income, Command.Spend);
  }

  [Command.BurnPower](player: PlayerEnum, cost: string) {
    const burn = this.availableCommand.data;
    assert(burn.includes(+cost), `Impossible to burn ${cost} power`);

    this.players[player].data.burnPower(+cost);
  }

  [Command.BrainStone](player: PlayerEnum, dest: string) {
    assert(this.availableCommand.data.includes(dest), "Possible brain stone areas: " + this.availableCommand.data.join(", "));
    this.players[player].data.brainstoneDest = dest as any;
  }

  [Command.Action](player: PlayerEnum, action: BoardAction) {
    const { poweracts: acts} = this.availableCommand.data;

    assert(acts.find(act => act.name === action), `${action} is not in the available power actions`);

    const pl = this.player(player);
    this.boardActions[action] = false;

    pl.payCosts(Reward.parse(boardActions[action].cost), action);
    pl.loadEvents(Event.parse(boardActions[action].income, action));
  }

  [Command.ChooseIncome](player: PlayerEnum, income: string) {
    const incomes = this.availableCommand.data;
    const incomeRewards = income.split(",") ;
    const pl = this.player(player);

    for (const incR of incomeRewards) {
      const eventIdx = incomes.findIndex(rw => Reward.match(Reward.parse(incR), [rw]));
      assert(eventIdx > -1, `${incR} is not in the available income`);
      incomes.splice(eventIdx, 1);
    }
    pl.receiveIncomeEvent(Reward.parse(income));
  }

  [Command.FormFederation](player: PlayerEnum, hexes: string, federation: Federation) {
    const pl = this.player(player);

    const fedInfo = pl.checkAndGetFederationInfo(hexes, this.map, this.options.flexibleFederations);

    assert(fedInfo, `Impossible to form federation at ${hexes}`);
    assert(this.availableCommand.data.tiles.includes(federation), `Impossible to form federation ${federation}`);

    pl.formFederation(fedInfo, federation);
    this.tiles.federations[federation] -= 1;
  }

  [Command.PISwap](player: PlayerEnum, location: string) {
    const { buildings } = this.availableCommand.data;
    const pl = this.player(player);

    const PIHex =  pl.data.occupied.find( hex => hex.buildingOf(player) === Building.PlanetaryInstitute);
    const parsed = this.map.parse(location);

    for (const elem of buildings) {
      if (isEqual(this.map.parse(elem.coordinates), parsed)) {
        const {q, r} = this.map.parse(location);
        const hex = this.map.grid.get({q, r});

        if ( hex.buildingOf(player) === Building.Mine ) {
          hex.data.building = Building.PlanetaryInstitute;
          PIHex.data.building = Building.Mine;
          pl.federationCache = null ;
          return;
        }
      }
    }

    assert(false, `Impossible to execute PI swap command at ${location}`);
  }
}
