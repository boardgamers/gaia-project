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
  BoardAction,
  Operator,
  ScoringTile,
  FinalTile,
  Phase,
  SubPhase
} from './enums';
import { CubeCoordinates } from 'hexagrid';
import Event from './events';
import federations from './tiles/federations';
import {roundScorings, finalScorings} from './tiles/scoring';
import * as researchTracks from './research-tracks';
import AvailableCommand, {
  generate as generateAvailableCommands,
} from './available-command';
import Reward from './reward';
import { boardActions } from './actions';
import { stdBuildingValue } from './buildings';

const ISOLATED_DISTANCE = 3;

interface EngineOptions {
  /** Allow last player to rotate sector BEFORE faction selection */
  advancedRules?: boolean;
}

export default class Engine {
  map: SpaceMap;
  players: Player[] = [];
  options: EngineOptions = {};
  tiles: {
    boosters: {
      [key in Booster]?: boolean
    },
    techs: {
      [key in TechTilePos | AdvTechTilePos]?: {tile: TechTile | AdvTechTile; count: number}
    },
    scorings: {
      round: ScoringTile[]
      final: FinalTile[]
    },
    federations: {
      [key in Federation]?: number
    }
  } = {boosters: {}, techs: {}, scorings: {round: null, final: null}, federations: {}};
  boardActions: {
    [key in BoardAction]?: boolean
  } = {};

  terraformingFederation: Federation;
  availableCommands: AvailableCommand[] = [];
  availableCommand: AvailableCommand;
  phase: Phase = Phase.SetupInit;
  oldPhase: Phase;

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
  leechSources: Array<{player: PlayerEnum, coordinates: string}> = [];

  // All moves
  moveHistory: string[] = [];
  // Current move being processed, separated in phase
  turnMoves: string[] = [];
  // Tells the UI if the new move should be on the same line or not
  newTurn: boolean = true;

  constructor(moves: string[] = [], options: EngineOptions = {}) {
    this.options = options;
    this.loadMoves(moves);
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

    const move = _move.trim();

    if (!this.executeMove(move)) {
      assert(lastMove, `Move ${move} (line ${this.moveHistory.length + 1}) is not complete!`);
      this.newTurn = false;
    }

    assert(this.turnMoves.length === 0, "Unnecessary commands at the end of the turn: " + this.turnMoves.join('. '));

    this.moveHistory.push(move);
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
    player.data.on(`gain-${Resource.TemporaryStep}`, () => this.processNextMove(SubPhase.BuildMine));
    player.data.on(`gain-${Resource.TemporaryRange}`, () => this.processNextMove(SubPhase.BuildMineOrGaiaFormer));
    player.data.on(`gain-${Resource.RescoreFederation}`, () => this.processNextMove(SubPhase.RescoreFederationTile));
    player.data.on(`gain-${Resource.PISwap}`, () => this.processNextMove(SubPhase.PISwap));
    player.data.on(`gain-${Resource.SpaceStation}`, () => this.processNextMove(SubPhase.SpaceStation));
    player.data.on(`gain-${Resource.DowngradeLab}`, () => {this.processNextMove(SubPhase.DowngradeLab); this.processNextMove(SubPhase.UpgradeResearch); });
    player.data.on(`gain-${Resource.UpgradeLowest}`, () => this.processNextMove(SubPhase.UpgradeResearch, {bescods: true}));
    player.data.on('brainstone', areas => this.processNextMove(SubPhase.BrainStone, areas));
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
    return [...this.players.slice(player), ...this.players.slice(0, player)];
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
    if (!_.get(params, 'loop', true)) {
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
    } else {
      assert(false, "Can't automove for player " + (this.playerToMove + 1));
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

    // Only leech when only one option and cost is nothing
    if (offers.length > 1 || offers[0].cost !== '~') {
      return false;
    }

    const pl = this.player(this.playerToMove);
    // const jsonData = pl.data.toJSON();

    // Itars may want to burn power instead
    if (pl.faction === Faction.Itars) {
      return false;
    }

    try {
      this.move(`${pl.faction} ${Command.ChargePower} ${offers[0].offer}`, false);
      return true;
    } catch (err) {
      /* Restore player data to what it was, like if the taklons cause an incomplete move error requiring brainstone destination */
      // pl.loadPlayerData(jsonData);
      return false;
    }
  }

  static fromData(data: any) {
    const engine = new Engine();

    Object.assign(engine, _.omit(data, "map", "players"));
    engine.map = SpaceMap.fromData(data.map);
    engine.map.nbPlayers = data.players.length;
    for (const player of data.players) {
      engine.addPlayer(Player.fromData(player, engine.map));
    }

    for (const hex of engine.map.grid.values()) {
      for (const player of hex.occupyingPlayers()) {
        engine.player(player).data.occupied.push(hex);
      }
    }

    return engine;
  }

  static slowMotion([first, ...moves]: string[]): Engine {
    if (!first) {
      return new Engine();
    }
    let state = JSON.parse(JSON.stringify(new Engine([first])));

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
   * @param params params.processFist indicates to process the first move. params.split is set to true if leftover commands are allowed
   */
  loadTurnMoves(move: string, params: {split?: boolean, processFirst?: boolean} = {split: true, processFirst: false}) {
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

    const split = _.get(params, 'split', true);
    const processFirst = _.get(params, 'processFirst', false);

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
    (this[move.command] as any)(this.playerToMove, ...move.args);

    return move;
  }

  peekNextMove() {
    return this.parseMove(this.turnMoves[0]);
  }

  checkCommand(command: Command) {
    assert(this.availableCommand = this.findAvailableCommand(this.playerToMove, command), `Command ${command} is not in the list of available commands`);
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
    return Event.parse(roundScorings[this.tiles.scorings.round[this.round - 1]]);
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

  handleNextGaia(afterCommand: boolean = false) {
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

  beginSetupBuildingPhase() {
    this.changePhase(Phase.SetupBuilding);
    const posIvits = this.players.findIndex(
      pl => pl.faction === Faction.Ivits
    );

    const setupTurnOrder = this.players
      .map((pl, i) => i as PlayerEnum)
      .filter(i => i !== posIvits);
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
    this.moveToNextPlayer(this.turnOrder, {loop: false});
  }

  beginSetupBoosterPhase() {
    this.changePhase(Phase.SetupBooster);
    this.turnOrder = this.players.map((pl, i) => i as PlayerEnum).reverse();
    this.moveToNextPlayer(this.turnOrder, {loop: false});
  }

  beginRoundStartPhase() {
    this.round += 1;
    this.turnOrder = this.passedPlayers || this.players.map((pl, i) => i);
    this.passedPlayers = [];
    this.currentPlayer = this.turnOrder[0];

    for (const player of this.playersInOrder()) {
      player.loadEvents(this.currentRoundScoringEvents);
    }

    this.beginIncomePhase();
  }

  beginIncomePhase() {
    this.changePhase(Phase.RoundIncome);
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
    Object.values(BoardAction).forEach(pos => {
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

  get isLastRound() {
    return this.round === Round.LastRound;
  }

  finalScoringPhase() {
    this.changePhase(Phase.EndGame);
    this.currentPlayer = this.tempCurrentPlayer = undefined;

    // finalScoring tiles
    for (const tile of this.tiles.scorings.final) {
      const players = _.sortBy(this.players, player => player.finalCount(tile)).reverse();

      const rankings = players.map(pl => ({
        player: pl,
        count: pl.finalCount(tile)
      }));

      if (this.players.length === 2) {
        rankings.push({ player: null, count: finalScorings[tile].neutralPlayer });
        rankings.sort((pl1, pl2) => pl2.count - pl1.count);
      }

      for (const ranking of rankings) {
        const count = ranking.count;
        // index of the first player with that score
        const first = rankings.findIndex(pl => pl.count === count);
        // number of other players with the same score
        const ties = rankings.filter(pl => pl.count === count).length;

        if (ranking.player) {
          const VPs = [18, 12, 6, 0, 0, 0];

          ranking.player.data.victoryPoints += Math.floor(_.sum(VPs.slice(first, first + ties)) / ties);
        }
      }
    }

    // research VP and remaining resources
    for (const pl of this.players) {
      pl.data.gainFinalVictoryPoints();
    }
  }

  beginLeechingPhase() {
    if (this.leechSources.length === 0) {
      this.beginRoundMovePhase();
      return;
    }
    const source = this.leechSources.shift();
    const sourceHex = this.map.grid.getS(source.coordinates);

    // Gaia-formers & space stations don't trigger leech
    if (stdBuildingValue(sourceHex.buildingOf(source.player)) === 0) {
      return this.beginLeechingPhase(); // next building on the list
    }
    // From rules, this is in clockwise order. We assume the order of players in this.players is the
    // clockwise order
    for (const pl of this.playersInTableOrderFrom(source.player)) {
      // If the player has passed and it's the last round, there's absolutely no points in leeching
      // There's no cultists in gaia project.
      if (this.isLastRound && this.passedPlayers.includes(pl.player)) {
        pl.data.leechPossible = 0;
        continue;
      }
      // If source, exclude too
      if (source.player === pl.player) {
        pl.data.leechPossible = 0;
        continue;
      }
      // Exclude the one who made the building from the leech
      let leech = 0;
      for (const loc of pl.data.occupied) {
        if (this.map.distance(loc, sourceHex) < ISOLATED_DISTANCE) {
          leech = Math.max(leech, pl.buildingValue(this.map.grid.get(loc).buildingOf(pl.player), this.map.grid.get(loc).data.planet));
        }
      }

      // Do not use maxLeech() here, cuz taklons
      pl.data.leechPossible = leech;
    }

    const canLeechPlayers = this.playersInTableOrderFrom(source.player).filter(pl => pl.canLeech());
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

    pl.payCosts(Reward.parse(cost));
    pl.gainRewards([new Reward(`${Command.UpgradeResearch}-${field}`)]);

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
      this.beginSetupBuildingPhase();
    }
  }

  [Phase.SetupBuilding](move: string) {
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
    this.loadTurnMoves(move);

    const playerAfter = this.getNextPlayer();

    // Execute all upcoming freeactions
    this.doFreeActions(SubPhase.BeforeMove);

    // If queue is empty, interrupt and ask for free actions / main command
    // otherwise execute main command
    if (this.handleMainMove() === Command.Pass) {
      if (this.turnOrder.length === 0) {
        this.cleanUpPhase();
        return;
      }
    } else {
      // Execute all upcoming freeactions
      this.doFreeActions(SubPhase.AfterMove);

      // If the player has no possible command or the queue has the end turn command,
      // end turns.
      // If the player has possible free actions & the queue is empty, ask for free actions / end turn
      this.handleEndTurn();
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

    this.map = new SpaceMap(nbPlayers, seed);

    // Choose nbPlayers+3 boosters as part of the pool
    const boosters = shuffleSeed.shuffle(Object.values(Booster), this.map.rng()).slice(0, nbPlayers + 3);
    for (const booster of boosters) {
      this.tiles.boosters[booster] = true;
    }

    // Shuffle tech tiles
    const techtiles = shuffleSeed.shuffle(Object.values(TechTile), this.map.rng());
    Object.values(TechTilePos).forEach( (pos, i) => {
      this.tiles.techs[pos] = {tile: techtiles[i], count: 4};
    });

    // Choose adv tech tiles as part of the pool
    const advtechtiles = shuffleSeed.shuffle(Object.values(AdvTechTile), this.map.rng()).slice(0, 6);
    Object.values(AdvTechTilePos).forEach( (pos, i) => {
      this.tiles.techs[pos] = {tile: advtechtiles[i], count: 1};
    });

    // powerActions
    Object.values(BoardAction).forEach( pos => {
      this.boardActions[pos] = true;
    });

    this.terraformingFederation = shuffleSeed.shuffle(Object.values(Federation).filter(fed => fed !== Federation.FederationGleens), this.map.rng())[0];
    for (const federation of Object.values(Federation) as Federation[]) {
      if (federation !== Federation.FederationGleens) {
        this.tiles.federations[federation] = federation === this.terraformingFederation ? 2 : 3;
      }
    }

    // Choose roundScoring Tiles as part of the pool
    const roundscoringtiles = shuffleSeed.shuffle(Object.values(ScoringTile), this.map.rng()).slice(0, 6);
    this.tiles.scorings.round = roundscoringtiles;

    // Choose finalScoring Tiles as part of the pool
    const finalscoringtiles = shuffleSeed.shuffle(Object.values(FinalTile), this.map.rng()).slice(0, 2);
    this.tiles.scorings.final = finalscoringtiles;

    this.players = [];

    for (let i = 0; i < nbPlayers; i++) {
      this.addPlayer(new Player(i));
    }
  }

  [Command.RotateSectors](player: PlayerEnum, ...params: string[]) {
    assert(params.length % 2 === 0, "The rotate command needs an even number of parameters");

    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < params.length; i += 2) {
      pairs.push([params[i], params[i + 1]]);
    }

    assert(_.uniq(pairs.map(pair => pair[0])).length === params.length / 2, "Duplicate rotations are not allowed");

    for (const pair of pairs) {
      this.map.rotateSector(pair[0], +pair[1]);
    }
    this.map.recalibrate();
    assert(this.map.isValid(), "Map is invalid with two planets for the same type being near each other");
  }

  [Command.ChooseFaction](player: PlayerEnum, faction: string) {
    assert(this.availableCommand.data.includes(faction), `${faction} is not in the available factions`);

    this.players[player].loadFaction(faction as Faction);
  }

  [Command.ChooseRoundBooster](player: PlayerEnum, booster: Booster, fromCommand: Command = Command.ChooseRoundBooster ) {
    const { boosters } = this.availableCommand.data;

    assert(boosters.includes(booster), `${booster} is not in the available boosters`);

    this.tiles.boosters[booster] = false;
    this.players[player].getRoundBooster(booster);
  }

  [Command.Build](player: PlayerEnum, building: Building, location: string) {
    const { buildings } = this.availableCommand.data;

    for (const elem of buildings) {
      if (elem.building === building && elem.coordinates === location) {
        const {q, r} = CubeCoordinates.parse(location);
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

    throw new Error(`Impossible to execute build command at ${location}`);
  }

  [Command.UpgradeResearch](player: PlayerEnum, field: ResearchField) {
    const { tracks } = this.availableCommand.data;
    const track = tracks.find(tr => tr.field === field);

    assert(track, `Impossible to upgrade research for ${field}`);

    this.advanceResearchAreaPhase(player, track.cost, field);
  }

  [Command.Pass](player: PlayerEnum, booster: Booster) {
    this.tiles.boosters[this.players[player].data.tiles.booster] = true;
    this.players[player].pass(this.isLastRound);

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

    this.player(player).gainRewards(leechRewards);
    this.player(player).payCosts(Reward.parse(offer.cost));
  }

  [Command.Decline](player: PlayerEnum) {
    this.player(player).declined = true;
  }

  [Command.EndTurn](player: PlayerEnum) {
    this.player(player).endTurn();
  }

  [Command.ChooseTechTile](player: PlayerEnum, pos: TechTilePos | AdvTechTilePos) {
    const { tiles } = this.availableCommand.data;
    const tileAvailable = tiles.find(ta => ta.pos === pos);
    const advanced = Object.values(AdvTechTilePos).includes(pos);

    assert(tileAvailable !== undefined, `Impossible to get ${pos} tile`);

    this.player(player).gainTechTile(tileAvailable.tile, tileAvailable.pos);
    this.tiles.techs[pos].count -= 1;

    if (advanced) {
      this.processNextMove(SubPhase.CoverTechTile);
    }

    this.processNextMove(SubPhase.UpgradeResearch, Object.values(ResearchField).includes(pos) ? {pos} : undefined) ;

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
      this.player(player).gainRewards(Reward.parse(federations[federation]));
    } else {
      this.player(player).gainFederationToken(federation);
      this.tiles.federations[federation] -= 1;
    }
  }

  [Command.PlaceLostPlanet](player: PlayerEnum, location: string) {
    const { spaces } = this.availableCommand.data;

    const data = spaces.find(space => space.coordinates === location);

    if (!data) {
      throw new Error(`Impossible to execute build command at ${location}`);
    }

    const { q, r, s } = CubeCoordinates.parse(location);
    const hex = this.map.grid.get({q, r});
    hex.data.planet = Planet.Lost;

    this.player(player).build(Building.Mine, hex, Reward.parse(data.cost), this.map, 0);

    this.leechSources.unshift({player, coordinates: location});
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

    pl.payCosts(cost);
    pl.gainRewards(income);
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

    assert(_.find(acts, {name: action}), `${action} is not in the available power actions`);

    const pl = this.player(player);
    this.boardActions[action] = false;

    pl.payCosts(Reward.parse(boardActions[action].cost));
    pl.loadEvents(Event.parse(boardActions[action].income));
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

    const fedInfo = pl.checkAndGetFederationInfo(hexes, this.map);
    if (!fedInfo) {
      throw new Error(`Impossible to form federation at ${hexes}`);
    }
    if (!this.availableCommand.data.tiles.includes(federation)) {
      throw new Error(`Impossible to form federation ${federation}`);
    }

    pl.formFederation(fedInfo, federation);
    this.tiles.federations[federation] -= 1;
  }

  [Command.PISwap](player: PlayerEnum, location: string) {
    const { buildings } = this.availableCommand.data;
    const pl = this.player(player);

    const PIHex =  pl.data.occupied.find( hex => hex.buildingOf(player) === Building.PlanetaryInstitute);

    for (const elem of buildings) {
      if (elem.coordinates === location) {
        const {q, r, s} = CubeCoordinates.parse(location);
        const hex = this.map.grid.get({q, r});

        if ( hex.buildingOf(player) === Building.Mine ) {
          hex.data.building = Building.PlanetaryInstitute;
          PIHex.data.building = Building.Mine;
          pl.federationCache = null ;
          return;
        }
      }
    }

    throw new Error(`Impossible to execute PI swap command at ${location}`);
  }
}
