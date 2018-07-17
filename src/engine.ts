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
  BrainstoneArea,
  Phase
} from './enums';
import { CubeCoordinates } from 'hexagrid';
import Event from './events';
import federations from './tiles/federations';
import {roundScorings} from './tiles/scoring';
import * as researchTracks from './research-tracks';
import AvailableCommand, {
  generate as generateAvailableCommands,
  possibleBuildings
} from './available-command';
import Reward from './reward';
import { boardActions, freeActions } from './actions';
import { GaiaHex } from '..';
import { stdBuildingValue, upgradedBuildings } from './buildings';

const ISOLATED_DISTANCE = 3;
const QIC_RANGE_UPGRADE = 2;

export default class Engine {
  map: SpaceMap;
  players: Player[];
  roundBoosters: {
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
  roundScoringTiles: ScoringTile[];
  finalScoringTiles: FinalTile[];
  terraformingFederation: Federation;
  availableCommands: AvailableCommand[] = [];
  phase: Phase ;
  prevPhase: Phase;
  round: number = Round.None;
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
  nextPlayer: PlayerEnum;
  // used to transit between phases
  tempTurnOrder: PlayerEnum[] = [];
  tempCurrentPlayer: PlayerEnum;
  leechingSource: GaiaHex;

  constructor(moves: string[] = []) {
    this.phaseBegin(Phase.SetupInit);
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

  addPlayer(player: Player) {
    this.players.push(player);

    player.on('gain-tech', () => {
      this.techTilePhase(player.player);
    });
    player.on('build-mine', () => {
      this.buildMinePhase(player.player);
    });
    player.on('rescore-fed', () => {
      this.selectFederationTilePhase(player.player, "player");
    });
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

  playersInOrder(): Player[] {
    return this.turnOrder.map(i => this.players[i]);
  }

  playersInTableOrderFromCurrent(): Player[] {
    return [...this.players.slice(this.currentPlayer + 1), ...this.players.slice(0, this.currentPlayer)];
  }

  nextSubcommandPlayer(): PlayerEnum {
    if (this.roundSubCommands.length > 0) {
      return this.roundSubCommands[0].player;
    }
  }

  numberOfPlayersWithFactions(): number {
    return this.players.filter(pl => pl.faction).length;
  }

  setFirstPlayer() {
    this.currentPlayer = this.turnOrder[0];
  }

  storeTurnOrder() {
    this.tempCurrentPlayer = this.currentPlayer;
    this.tempTurnOrder = this.turnOrder;
  }

  restoreTurnOrder() {
    this.currentPlayer = this.tempCurrentPlayer;
    this.turnOrder = this.tempTurnOrder;
  }

  static fromData(data: any) {
    const engine = new Engine();
    engine.phase = data.phase;
    engine.round = data.round;
    engine.availableCommands = data.availableCommands;
    engine.map = SpaceMap.fromData(data.map);
    for (const player of data.players) {
      engine.addPlayer(Player.fromData(player));
    }

    return engine;
  }

  move(move: string) {
    let command: Command;
    move = move.trim();
    if (this.phase === Phase.SetupInit) {
      const split = move.split(' ');
      command = split[0] as Command;

      this.generateAvailableCommands();
      const available = this.availableCommands;
      const commandNames = available.map(cmd => cmd.name);

      assert(
        commandNames.includes(command),
        'Move ' + move + ' not in Available commands: ' + commandNames.join(', ')
      );

      (this[command] as any)(...split.slice(1));
      this.phaseEnd();
    } else {
      const playerS = move.substr(0, 2);

      assert(
        /^p[1-5]$/.test(playerS),
        'Wrong player format, expected p1, p2, ...'
      );
      const player = +playerS[1] - 1;
      assert(this.currentPlayer === (player as PlayerEnum), "Wrong turn order in move " + move + ", expected " + this.currentPlayer + ' found ' + player);

      const moves = move.substr(2, move.length - 2).trim().split('.');

      for ( const mv of moves )  {
        const split = mv.trim().split(' ');
        // the final dot is the end turn command
        command = split[0] === "" ? Command.EndTurn : split[0] as Command;

        this.generateAvailableCommands();
        const commandNames = this.availableCommands.map(cmd => cmd.name);

        assert(
          this.availableCommand(player, command),
          'Move ' + split + ' not in Available commands: ' + commandNames.join(', ')
        );

        (this[command] as any)(player as PlayerEnum, ...split.slice(1));

      }

      this.player(player).endTurn();
      this.moveToNextPlayer(command);
    }

  }

   /** Next player to make a move, after current player makes their move */
   moveToNextPlayer(command: Command): PlayerEnum {
    const playerPos = this.turnOrder.indexOf(this.currentPlayer);
    const subPhaseTurn = this.roundSubCommands.length > 0;

    if (subPhaseTurn) {
      return;
    }

    // check if need to start a leechingPhase
    if ( this.phase === Phase.RoundMove && this.leechingSource ) {
      this.phaseBegin(Phase.RoundLeech);
      return;
    }

    if (command === Command.Pass) {
      this.passedPlayers.push(this.currentPlayer);
    }

    if ( [Phase.SetupFaction, Phase.SetupBuilding, Phase.SetupBooster, Phase.RoundIncome, Phase.RoundGaia, Phase.RoundLeech].includes(this.phase) || command === Command.Pass) {
      this.turnOrder.splice(playerPos, 1);
      this.currentPlayer = this.turnOrder[playerPos % this.turnOrder.length];

      // If all players have passed
      if (this.turnOrder.length === 0) {
        this.phaseEnd();
      }
      return;
    }

    this.currentPlayer = this.turnOrder[(playerPos + 1) % this.turnOrder.length];

    return this.currentPlayer;
  }

  phaseBegin( phase: Phase) {
    this.phase = phase;
    switch ( phase ) {
      case Phase.SetupInit : {
        this.beginSetupInitPhase();
        break;
      }
      case Phase.SetupFaction : {
        this.beginSetupFactionPhase();
        break;
      }
      case Phase.SetupBuilding : {
        this.beginSetupBuildingPhase();
        break;
      }
      case Phase.SetupBooster : {
        this.beginSetupBoosterPhase();
        break;
      }
      case Phase.RoundStart : {
        this.beginRoundStartPhase();
        break;
      }
      case Phase.RoundIncome : {
        this.incomePhase();
        break;
      }
      case Phase.RoundGaia : {
        this.gaiaPhase();
        break;
      }
      case Phase.RoundMove : {
        this.beginRoundMovePhase();
        break;
      }
      case Phase.RoundLeech : {
        this.leechingPhase();
        break;
      }
      case Phase.RoundFinish : {
        this.cleanUpPhase();
        break;
      }
      case Phase.EndGame : {
        this.finalScoringPhase();
        break;
      }
    }
  }

  phaseEnd() {
    this.prevPhase = this.phase;
    const nextPhase = this.onPhaseEnd(this.phase);
    this.phaseBegin( nextPhase );
  }

  onPhaseEnd( currentPhase: Phase ): Phase {
    switch ( currentPhase ) {
      case Phase.SetupInit : {
        return Phase.SetupFaction;
      }
      case Phase.SetupFaction : {
        return Phase.SetupBuilding;
      }
      case Phase.SetupBuilding : {
        return Phase.SetupBooster;
      }
      case Phase.SetupBooster : {
        this.turnOrder = [];
        this.passedPlayers = this.players.map((pl, i) => i as PlayerEnum);
        return Phase.RoundStart;
      }
      case Phase.RoundStart : {
        return Phase.RoundIncome;
      }
      case Phase.RoundIncome : {
        this.restoreTurnOrder();
        this.setFirstPlayer();
        return Phase.RoundGaia;
      }
      case Phase.RoundGaia : {
        this.restoreTurnOrder();
        this.setFirstPlayer();
        return Phase.RoundMove;
      }
      case Phase.RoundMove : {
        return Phase.RoundFinish;
      }
      case Phase.RoundLeech : {
        this.restoreTurnOrder();
        this.leechingSource = undefined;
        return Phase.RoundMove;
      }
      case Phase.RoundFinish: {
        if (this.round === 6) {
          return Phase.EndGame;
        } else {
          return Phase.RoundStart;
        }
      }
    }
  }

  beginSetupInitPhase() {
    return;
  }

  beginSetupFactionPhase() {
    this.turnOrder = this.players.map((pl, i) => i as PlayerEnum);
    this.setFirstPlayer();
  }

  beginSetupBuildingPhase() {
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
    this.setFirstPlayer();
  }

  beginSetupBoosterPhase() {
    this.turnOrder = this.players.map((pl, i) => i as PlayerEnum).reverse();
    this.setFirstPlayer();
  }

  beginRoundStartPhase() {
    this.round += 1;
    this.turnOrder = this.passedPlayers;
    this.passedPlayers = [];
    this.setFirstPlayer();
    this.phaseEnd();
  }

  incomePhase() {
    this.storeTurnOrder();

    const newOrder = [];
    // creates a turnOrder for players that are needing income selection
    for (const player of this.playersInOrder()) {
      player.loadEvents(this.currentRoundScoringEvents);
      const { needed } = player.needIncomeSelection();
      if (needed) {
        newOrder.push(player.player);
      } else {
        player.receiveIncome();
      }
    }

    if (newOrder.length === 0) {
      this.phaseEnd();
    } else {
      this.turnOrder = newOrder;
      this.setFirstPlayer();
    }
  }

  gaiaPhase() {
    this.storeTurnOrder();

    const newOrder = [];
    // transform Transdim planets into Gaia if gaiaformed
    for (const hex of this.map.toJSON()) {
      if (hex.data.planet === Planet.Transdim && hex.data.player !== undefined && hex.data.building === Building.GaiaFormer) {
        hex.data.planet = Planet.Gaia;
      }
    }
    for (const player of this.playersInOrder()) {
      if (player.needGaiaSelection()) {
        newOrder.push(player.player);
      } else {
        player.gaiaPhase();
      }
    }

    if (newOrder.length === 0) {
      this.phaseEnd();
    } else {
      this.turnOrder = newOrder;
      this.setFirstPlayer();
    }
  }

  beginRoundMovePhase() {
    // returning from a leech phase
    if ( this.prevPhase === Phase.RoundLeech ) {
      this.moveToNextPlayer(Command.Leech);
    }
  }

  cleanUpPhase() {
    if (this.round < 1) {
      return;
    }
    for (const player of this.players) {
      // remove roundScoringTile
      player.removeEvents(this.currentRoundScoringEvents);

      // resets special action
      for (const event of player.events[Operator.Activate]) {
        event.activated = false;
      }
      // resets income action
      for (const event of player.events[Operator.Income]) {
        event.activated = false;
      }
    }
    // resets power and qic actions
    Object.values(BoardAction).forEach(pos => {
      this.boardActions[pos] = true;
    });

    this.phaseEnd();
  }

  finalScoringPhase() {
    // finalScoring tiles
    for (const tile of this.finalScoringTiles) {
      const players = _.sortBy(this.players, player => player.finalCount(tile)).reverse();

      const rankings = players.map(pl => ({
        player: pl,
        count: pl.finalCount(tile)
      }));

      if (this.players.length === 2) {
        rankings.push({ player: null, count: 8 });
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
          ranking.player.data.victoryPoints += Math.floor(_.sum(VPs.slice(first, ties)) / ties);
        }
      }
    }

    // research VP and remaining resources
    for (const pl of this.playersInOrder()) {
      pl.data.gainFinalVictoryPoints();
    }
  }

  leechingPhase() {
    this.storeTurnOrder();
    const newOrder = [];
    // Gaia-formers & space stations don't trigger leech
    if (stdBuildingValue(this.leechingSource.buildingOf(this.currentPlayer)) === 0) {
      return;
    }
    // From rules, this is in clockwise order. We assume the order of players in this.players is the
    // clockwise order
    for (const pl of this.playersInTableOrderFromCurrent()) {
      // Exclude the one who made the building from the leech
      if (pl !== this.player(this.currentPlayer)) {
        let leech = 0;
        for (const loc of pl.data.occupied) {
          if (this.map.distance(loc, this.leechingSource) < ISOLATED_DISTANCE) {
            leech = Math.max(leech, pl.buildingValue(this.map.grid.get(loc).buildingOf(pl.player), this.map.grid.get(loc).data.planet));
          }
        }
        leech = pl.maxLeech(leech);
        if (leech > 0) {
          newOrder.push( pl.player );
          pl.data.leechPossible = leech;
        }
      }
    }

    if (newOrder.length === 0) {
      this.phaseEnd();
    } else {
      this.turnOrder = newOrder;
      this.setFirstPlayer();
    }
  }

  techTilePhase(player: PlayerEnum) {
    const tiles = [];
    const data = this.players[player].data;

    //  tech tiles that player doesn't already have
    for (const tilePos of Object.values(TechTilePos)) {
      if (!_.find(data.techTiles, {tile: this.techTiles[tilePos].tile})) {
        tiles.push({
          tile: this.techTiles[tilePos].tile,
          tilePos,
          type: "std"
        });
      }
    }

    // adv tech tiles where player has lev 4/5, free federation tokens,
    // and available std tech tiles to cover
    for (const tilePos of Object.values(AdvTechTilePos)) {
      if (this.advTechTiles[tilePos].numTiles > 0  &&
          data.greenFederations > 0 &&
          data.research[tilePos.slice("adv-".length)] >= 4 &&
          data.techTiles.filter(tech => tech.enabled).length > 0 ) {
            tiles.push({
              tile: this.advTechTiles[tilePos].tile,
              tilePos,
              type: "adv"
            });
      }
    }
    if (tiles.length > 0) {
      this.roundSubCommands.unshift({
        name: Command.ChooseTechTile,
        player,
        data: { tiles }
    });
    }

  }

  coverTechTilePhase(player: PlayerEnum) {
    this.roundSubCommands.unshift({
      name: Command.ChooseCoverTechTile,
      player,
      data: {}
    });
  }

  lostPlanetPhase(player: PlayerEnum) {
    this.roundSubCommands.unshift({
      name: Command.PlaceLostPlanet,
      player,
      data: {}
    });
  }

  advanceResearchAreaPhase(player: PlayerEnum, pos: TechTilePos | AdvTechTilePos) {
    // if stdTech in a free position or advTech, any researchArea
    const destResearchArea = "";
    if (![TechTilePos.Free1, TechTilePos.Free2, TechTilePos.Free3].includes(pos as any) && Object.values(TechTilePos).includes(pos)) {
      // There's only one track to advance, so no need to give the player a choice, but end turn
      this.player(player).gainRewards(Reward.parse(`up-${pos}`));
      this.endTurnPhase(player, Command.ChooseTechTile);
      return;
    }

    this.roundSubCommands.unshift({
      name: Command.UpgradeResearch,
      player,
      data: destResearchArea
    });
  }

  selectFederationTilePhase(player: PlayerEnum, from: "pool" | "player") {
    const possibleTiles = Object.keys(this.federations).filter(key => this.federations[key] > 0);
    const playerTiles = Object.keys(this.player(player).data.federations);

    this.roundSubCommands.unshift({
      name: Command.ChooseFederationTile,
      player,
      data: {
        tiles: from === "player" ? playerTiles : possibleTiles,
        // Tiles that are rescored just add the rewards, but don't take the token
        rescore: from === "player"
      }
    });
  }

  endTurnPhase(player: PlayerEnum, fromCommand: Command) {
    // exclude setup rounds
    if (this.round <= 0) {
      return;
    }
    // if the current player has subCommands to do, cannot endTurn
    if (this.nextSubcommandPlayer() === player) {
      return;
    }
    this.roundSubCommands.unshift({
      name: Command.EndTurn,
      player,
      data: fromCommand
    });
  }

  buildMinePhase(player: PlayerEnum) {
    const buildingCommand = possibleBuildings(this, player);

    if (buildingCommand) {
      // We filter buildings that aren't mines (like gaia-formers) or
      // that already have a building on there (like gaia-formers)
      buildingCommand.data.buildings = buildingCommand.data.buildings.filter(bld => {
        if (bld.building !== Building.Mine && bld.building !== Building.GaiaFormer) {
          return false;
        }
        return this.map.grid.getS(bld.coordinates).buildingOf(player) === undefined;
      });

      if (buildingCommand.data.buildings.length > 0) {
        this.roundSubCommands.unshift(buildingCommand);
      }
    }
  }

  get currentRoundScoringEvents() {
    return Event.parse(roundScorings[this.roundScoringTiles[this.round - 1]]);
  }

  /** Commands */
  [Command.Init](players: string, seed: string) {
    const nbPlayers = +players || 2;
    seed = seed || 'defaultSeed';

    this.map = new SpaceMap(nbPlayers, seed);

    // Choose nbPlayers+3 boosters as part of the pool
    const boosters = shuffleSeed.shuffle(Object.values(Booster), this.map.rng()).slice(0, nbPlayers + 3);
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

    // powerActions
    Object.values(BoardAction).forEach( pos => {
      this.boardActions[pos] = true;
    });

    this.terraformingFederation = shuffleSeed.shuffle(Object.values(Federation), this.map.rng())[0];
    for (const federation of Object.values(Federation) as Federation[]) {
      if (federation !== Federation.FederationGleens) {
        this.federations[federation] = federation === this.terraformingFederation ? 2 : 3;
      }
    }


    // Choose roundScoring Tiles as part of the pool
    const roundscoringtiles = shuffleSeed.shuffle(Object.values(ScoringTile), this.map.rng()).slice(0, 6);
    this.roundScoringTiles = roundscoringtiles;

    // Choose finalScoring Tiles as part of the pool
    const finalscoringtiles = shuffleSeed.shuffle(Object.values(FinalTile), this.map.rng()).slice(0, 2);
    this.finalScoringTiles = finalscoringtiles;

    this.players = [];

    for (let i = 0; i < nbPlayers; i++) {
      this.addPlayer(new Player(i));
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
        const hex = this.map.grid.get({q, r});
        const pl = this.player(player);

        pl.build(
          building,
          hex,
          Reward.parse(elem.cost),
          this.map,
          elem.steps
        );

        // remove subCommand build if present
        if (this.roundSubCommands[0] && this.roundSubCommands[0].name === Command.Build) {
          this.roundSubCommands.splice(0, 1);
        }

        // will trigger a LeechPhase
        if (this.phase === Phase.RoundMove && building !== Building.GaiaFormer) {
          this.leechingSource = hex;
        }

        if ( pl.faction === Faction.Gleens && building === Building.PlanetaryInstitute) {
          pl.gainFederationToken(Federation.FederationGleens);
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
        // gets federation token
        if (this.terraformingFederation) {
          pl.gainFederationToken(this.terraformingFederation);
          this.terraformingFederation = undefined;
        }
      } else if (field === ResearchField.Navigation) {
        // gets LostPlanet
        this.lostPlanetPhase(player);
      }
    }
    this.endTurnPhase(player, Command.Build);
  }

  [Command.Pass](player: PlayerEnum, booster: Booster) {
    this.roundBoosters[this.players[player].data.roundBooster] = true;
    this.players[player].pass();
    (this[Command.ChooseRoundBooster] as any)(player, booster, Command.Pass);
  }

  [Command.Leech](player: PlayerEnum, income: string) {
    const leechCommand  = this.availableCommand(player, Command.Leech).data;
    // leech rewards are including +t, if needed and in the right sequence
    const leechRewards = Reward.parse(income);

    const leech =  leechRewards.find( lr => lr.type === Resource.ChargePower);
    const freeIncome =  leechRewards.find( lr => lr.type === Resource.GainToken);

    assert(leechCommand.leech === leech.toString() , `Impossible to charge ${leech}`);
    if ( freeIncome ) {
      assert(leechCommand.freeIncome === freeIncome.toString() , `Impossible to get ${freeIncome} for free`);
    }

    this.player(player).gainRewards(leechRewards);
    this.player(player).payCosts( [new Reward(Math.max(leech.count - 1, 0), Resource.VictoryPoint)]);
    this.player(player).data.leechPossible = 0;

  }

  [Command.DeclineLeech](player: PlayerEnum) {
    // no action needeed
  }

  [Command.EndTurn](player: PlayerEnum) {
    // removes endTurn subcommand
    this.roundSubCommands.splice(0, 1);
    // sets nextPlayer
    // const playerPos = this.turnOrder.indexOf(this.currentPlayer);
    // this.nextPlayer = this.turnOrder[(playerPos + 1) % this.turnOrder.length];
  }

  [Command.ChooseTechTile](player: PlayerEnum, pos: TechTilePos | AdvTechTilePos) {
    const { tiles } = this.availableCommand(player, Command.ChooseTechTile).data;
    const tileAvailable = tiles.find(ta => ta.tilePos === pos);

    assert(tileAvailable !== undefined, `Impossible to get ${pos} tile`);

    const advanced = tileAvailable.type === "adv";

    if (advanced) {
      this.player(player).gainAdvTechTile(tileAvailable.tile);
      this.advTechTiles[pos].numTiles -= 1;
      this.advanceResearchAreaPhase(player, pos);
      this.coverTechTilePhase(player);
    } else {
      this.player(player).gainTechTile(tileAvailable.tile);
      this.techTiles[pos].numTiles -= 1;
      // add advance research area subCommand
      this.advanceResearchAreaPhase(player, pos);
    }
  }

  [Command.ChooseCoverTechTile](player: PlayerEnum, tilePos: TechTilePos) {
    const { tiles } = this.availableCommand(player, Command.ChooseCoverTechTile).data;
    const tileAvailable = tiles.find(ta => ta.tilePos === tilePos);

    assert(tileAvailable !== undefined, `Impossible to cover ${tilePos} tile`);
    // remove tile
    this.player(player).coverTechTile(tileAvailable.tile);

    this.endTurnPhase(player, Command.Build);
  }

  [Command.Special](player: PlayerEnum, income: string) {
    const { specialacts } = this.availableCommand(player, Command.Special).data;
    const actAvailable = specialacts.find(sa => Reward.match(Reward.parse(sa.income), Reward.parse(income)));

    assert(actAvailable !== undefined, `Special action ${income} is not available`);

    // mark as activated special action for this turn
    this.player(player).activateEvent(actAvailable.spec);

    this.endTurnPhase(player, Command.Special);
  }

  [Command.ChooseFederationTile](player: PlayerEnum, federation: Federation) {
    const { tiles, rescore } = this.availableCommand(player, Command.ChooseFederationTile).data;
    const tileAvailable = tiles.find(ta => ta.tile === federation);

    if (rescore) {
      // rescore a federation
      this.player(player).gainRewards(Reward.parse(federations[federation]));
      this.endTurnPhase(player, Command.ChooseFederationTile);
    } else {
      // no other type of individual choose-fereation-tile
    }
  }

  [Command.PlaceLostPlanet](player: PlayerEnum, location: string) {
    const avail = this.availableCommand(player, Command.Build);
    const { spaces } = avail.data;

    if (spaces.indexOf(location) === -1) {
      throw new Error(`Impossible to execute build command at ${location}`);
    }

    const { q, r, s } = CubeCoordinates.parse(location);
    const hex = this.map.grid.get({q, r});
    hex.data.planet = Planet.Lost;

    this.player(player).build(Building.Mine, hex, [], this.map, 0);

    this.leechingSource = hex;
  }

  [Command.Spend](player: PlayerEnum, costS: string, _for: "for", incomeS: string) {
    const { acts: actions } = this.availableCommand(player, Command.Spend).data;

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
    pl.loadEvents(Event.parse(boardActions[action].income));
    this.endTurnPhase(player, Command.Action);
  }

  [Command.ChooseIncome](player: PlayerEnum, income: string) {
    const { incomes } = this.availableCommand(player, Command.ChooseIncome).data;
    const incomeRewards = income.split(",") ;
    const pl = this.player(player);

    for (const incR of incomeRewards) {
      const eventIdx = incomes.findIndex(ev => Reward.match(Reward.parse(incR), ev.rewards));
      assert(eventIdx > -1, `${incR} is not in the available income`);
      incomes.splice(eventIdx, 1);
    }
    pl.receiveIncomeEvent(Reward.parse(income));
    // no more income selection needed
    const { needed } = pl.needIncomeSelection();
    if (!needed) {
      pl.receiveIncome();
    }
  }

  [Command.FormFederation](player: PlayerEnum, hexes: string, federation: Federation) {
    const avail = this.availableCommand(player, Command.FormFederation);
    const pl = this.player(player);

    const fedInfo = pl.checkAndGetFederationInfo(hexes, this.map);
    if (!fedInfo) {
      throw new Error(`Impossible to form federation at ${hexes}`);
    }
    if (!avail.data.tiles.includes(federation)) {
      throw new Error(`Impossible to form federation ${federation}`);
    }

    pl.gainFederationToken(federation);
    this.federations[federation] -= 1;

    const hexList = hexes.split(',').map(str => this.map.grid.getS(str));
    for (const hex of hexList) {
      hex.addToFederationOf(player);
    }
    pl.payCosts([new Reward(fedInfo.satellites, Resource.GainToken)]);
    pl.data.satellites += fedInfo.satellites;

    this.endTurnPhase(player, Command.FormFederation);
  }
}
