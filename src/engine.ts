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
import {roundScorings} from './tiles/scoring';
import * as researchTracks from './research-tracks';
import AvailableCommand, {
  generate as generateAvailableCommands,
  possibleBuildings
} from './available-command';
import Reward from './reward';
import { boardActions, freeActions } from './actions';
import { GaiaHex } from '..';
import { stdBuildingValue } from './buildings';

const ISOLATED_DISTANCE = 3;

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
  subPhase: SubPhase;

  round: number = Round.None;
  /** Order of players in the turn */
  turnOrder: PlayerEnum[] = [];
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
      this.subPhase = SubPhase.ChooseTechTile;
    });
    player.on('build-mine', () => {
      this.subPhase = SubPhase.BuildMine;
    });
    player.on('rescore-fed', () => {
      this.subPhase = SubPhase.RescoreFederationTile;
    });
    player.on('pi-swap', () => {
      this.subPhase = SubPhase.PISwap;
    });
  }

  player(player: number): Player {
    return this.players[player];
  }

  playersInOrder(): Player[] {
    return this.turnOrder.map(i => this.players[i]);
  }

  playersInTableOrderFromCurrent(): Player[] {
    return [...this.players.slice(this.currentPlayer + 1), ...this.players.slice(0, this.currentPlayer)];
  }

  numberOfPlayersWithFactions(): number {
    return this.players.filter(pl => pl.faction).length;
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

      // implicit endTurn
      if (this.subPhase === SubPhase.EndMove) {
        this.moveToNextPlayer(command);
      }
    }
  }

    moveToFirstPlayer() {
      this.currentPlayer = this.turnOrder[0];
      this.subPhase = SubPhase.BeforeMove;
      // If all players have passed
      if (this.turnOrder.length === 0) {
        this.phaseEnd();
      }
    }

   /** Next player to make a move, after current player makes their move */
   moveToNextPlayer(command: Command): PlayerEnum {
    const playerPos = this.turnOrder.indexOf(this.currentPlayer);

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
      this.subPhase = SubPhase.BeforeMove;

      // If all players have passed
      if (this.turnOrder.length === 0) {
        this.phaseEnd();
      }
      return;
    }

    this.currentPlayer = this.turnOrder[(playerPos + 1) % this.turnOrder.length];
    this.subPhase = SubPhase.BeforeMove;

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
        this.beginIncomePhase();
        break;
      }
      case Phase.RoundGaia : {
        this.beginGaiaPhase();
        break;
      }
      case Phase.RoundMove : {
        this.beginRoundMovePhase();
        break;
      }
      case Phase.RoundLeech : {
        this.beginLeechingPhase();
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
        this.endIncomePhase();
        this.restoreTurnOrder();
        return Phase.RoundGaia;
      }
      case Phase.RoundGaia : {
        this.endGaiaPhase();
        this.restoreTurnOrder();
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
    this.moveToFirstPlayer();
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
    this.moveToFirstPlayer();
  }

  beginSetupBoosterPhase() {
    this.turnOrder = this.players.map((pl, i) => i as PlayerEnum).reverse();
    this.moveToFirstPlayer();
  }

  beginRoundStartPhase() {
    this.round += 1;
    this.turnOrder = this.passedPlayers;
    this.passedPlayers = [];
    this.moveToFirstPlayer();
    this.phaseEnd();
  }

  beginIncomePhase() {
    this.storeTurnOrder();

    const newOrder = [];
    // creates a turnOrder for players that are needing income selection
    for (const player of this.playersInOrder()) {
      player.loadEvents(this.currentRoundScoringEvents);
      const { needed } = player.needIncomeSelection();
      if (needed) {
        newOrder.push(player.player);
      }
    }
    this.turnOrder = newOrder;
    this.moveToFirstPlayer();
  }

  endIncomePhase() {
    for (const player of this.players) {
      player.receiveIncome();
    }
  }

  beginGaiaPhase() {
    this.storeTurnOrder();

    const newOrder = [];
    // transform Transdim planets into Gaia if gaiaformed
    for (const hex of this.map.toJSON()) {
      if (hex.data.planet === Planet.Transdim && hex.data.player !== undefined && hex.data.building === Building.GaiaFormer) {
        hex.data.planet = Planet.Gaia;
      }
    }
    for (const player of this.playersInOrder()) {
      if (player.canGaiaTerrans() || player.canGaiaItars() ) {
        newOrder.push(player.player);
      }
    }
    this.turnOrder = newOrder;
    this.moveToFirstPlayer();
  }

  endGaiaPhase() {
    for (const player of this.players) {
        player.gaiaPhase();
    }
  }

  beginRoundMovePhase() {
    // returning from a leech phase
    if ( this.prevPhase === Phase.RoundLeech ) {
      this.moveToNextPlayer(Command.Leech);
    } else {
      this.moveToFirstPlayer();
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

  beginLeechingPhase() {
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

    this.turnOrder = newOrder;
    this.moveToFirstPlayer();
  }

  advanceResearchAreaPhase(player: PlayerEnum, cost: string, field: ResearchField ) {
    const pl = this.player(player);

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
        this.subPhase = SubPhase.PlaceLostPlanet;
        return;
      }
    }
    this.subPhase = SubPhase.AfterMove;
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
    this.subPhase = SubPhase.EndMove;
  }

  [Command.ChooseRoundBooster](player: PlayerEnum, booster: Booster, fromCommand: Command = Command.ChooseRoundBooster ) {
    const { boosters } = this.availableCommand(player, fromCommand).data;

    assert(boosters.includes(booster),
      `${booster} is not in the available boosters`
    );

    this.roundBoosters[booster] = false;
    this.players[player].getRoundBooster(booster);
    this.subPhase = SubPhase.EndMove;
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

        // will trigger a LeechPhase
        if (this.phase === Phase.RoundMove && building !== Building.GaiaFormer) {
          this.leechingSource = hex;
        }

        if ( pl.faction === Faction.Gleens && building === Building.PlanetaryInstitute) {
          pl.gainFederationToken(Federation.FederationGleens);
        }

          // Gain tech tile if lab / academy
        if ( building === Building.ResearchLab || building === Building.Academy1 || building === Building.Academy2) {
          this.subPhase = SubPhase.ChooseTechTile;
          return;
        }

        if ( this.phase === Phase.SetupBuilding) {
          this.subPhase = SubPhase.EndMove;
          return;
        }

        this.subPhase = SubPhase.AfterMove;
        return;
      }
    }

    throw new Error(`Impossible to execute build command at ${location}`);
  }

  [Command.UpgradeResearch](player: PlayerEnum, field: ResearchField) {
    const { tracks } = this.availableCommand(player, Command.UpgradeResearch).data;
    const track = tracks.find(tr => tr.field === field);

    assert(track, `Impossible to upgrade knowledge for ${field}`);

    this.advanceResearchAreaPhase(player, track.cost, field);
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
    this.subPhase = SubPhase.EndMove;

  }

  [Command.DeclineLeech](player: PlayerEnum) {
    // no action needeed
    this.subPhase = SubPhase.EndMove;
  }

  [Command.EndTurn](player: PlayerEnum) {
    this.player(player).endTurn();
    this.moveToNextPlayer(Command.EndTurn);
  }

  [Command.ChooseTechTile](player: PlayerEnum, pos: TechTilePos | AdvTechTilePos) {
    const { tiles } = this.availableCommand(player, Command.ChooseTechTile).data;
    const tileAvailable = tiles.find(ta => ta.tilePos === pos);

    assert(tileAvailable !== undefined, `Impossible to get ${pos} tile`);

    const advanced = tileAvailable.type === "adv";
    const stdNoFree = ![TechTilePos.Free1, TechTilePos.Free2, TechTilePos.Free3].includes(pos as any) &&  tileAvailable.type === "std";

    if (advanced) {
      // need to cover before to upgrade
      this.player(player).gainAdvTechTile(tileAvailable.tile, tileAvailable.tilePos);
      this.advTechTiles[pos].numTiles -= 1;
      this.subPhase = SubPhase.CoverTechTile;
      return;
    }

    this.player(player).gainTechTile(tileAvailable.tile, tileAvailable.tilePos);
    this.techTiles[pos].numTiles -= 1;

    if ( stdNoFree ) {
      this.advanceResearchAreaPhase(player, "", pos as any );
      return;
    } else {
      this.subPhase = SubPhase.UpgradeResearch;
    }

  }

  [Command.ChooseCoverTechTile](player: PlayerEnum, tilePos: TechTilePos) {
    const { tiles } = this.availableCommand(player, Command.ChooseCoverTechTile).data;
    const tileAvailable = tiles.find(ta => ta.tilePos === tilePos);

    assert(tileAvailable !== undefined, `Impossible to cover ${tilePos} tile`);
    // remove tile
    this.player(player).coverTechTile(tileAvailable.tilePos);
    this.subPhase = SubPhase.UpgradeResearch;
  }

  [Command.Special](player: PlayerEnum, income: string) {
    const { specialacts } = this.availableCommand(player, Command.Special).data;
    const actAvailable = specialacts.find(sa => Reward.match(Reward.parse(sa.income), Reward.parse(income)));

    assert(actAvailable !== undefined, `Special action ${income} is not available`);

    this.subPhase = SubPhase.AfterMove;

    // mark as activated special action for this turn
    // triggers buildMine subphase from the activation
    this.player(player).activateEvent(actAvailable.spec);

  }

  [Command.ChooseFederationTile](player: PlayerEnum, federation: Federation) {
    const { tiles, rescore } = this.availableCommand(player, Command.ChooseFederationTile).data;
    const tileAvailable = tiles.find(ta => ta.tile === federation);

    this.player(player).gainRewards(Reward.parse(federations[federation]));

    if (!rescore) {
      this.player(player).data.federations.push(federation);
    }

    this.subPhase = SubPhase.AfterMove;
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
    this.subPhase = SubPhase.AfterMove;
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

    // Terrans are no needing more conversion for gaia?
    if ( this.phase === Phase.RoundGaia && pl.faction === Faction.Terrans && !pl.canGaiaTerrans() ) {
      this.subPhase = SubPhase.EndMove;
    }

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
    this.subPhase = SubPhase.AfterMove;
  }

  [Command.ChooseIncome](player: PlayerEnum, income: string) {
    const incomes = this.availableCommand(player, Command.ChooseIncome).data;
    const incomeRewards = income.split(",") ;
    const pl = this.player(player);

    for (const incR of incomeRewards) {
      const eventIdx = incomes.findIndex(rw => Reward.match(Reward.parse(incR), [rw]));
      assert(eventIdx > -1, `${incR} is not in the available income`);
      incomes.splice(eventIdx, 1);
    }
    pl.receiveIncomeEvent(Reward.parse(income));
    // no more income selection needed
    const { needed } = pl.needIncomeSelection();
    if (!needed) {
      pl.receiveIncome();
      this.subPhase = SubPhase.EndMove;
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

    this.subPhase = SubPhase.AfterMove;
  }

  [Command.PISwap](player: PlayerEnum, location: string) {
    const avail = this.availableCommand(player, Command.PISwap);
    const { buildings } = avail.data;
    const pl = this.player(player);

    const PIHex =  pl.data.occupied.find( hex => hex.buildingOf(player) === Building.PlanetaryInstitute);

    for (const elem of buildings) {
      if (elem.coordinates === location) {
        const {q, r, s} = CubeCoordinates.parse(location);
        const hex = this.map.grid.get({q, r});

        if ( hex.buildingOf(player) === Building.Mine ) {
          hex.data.building = Building.PlanetaryInstitute;
          PIHex.data.building = Building.Mine;
        }

        this.subPhase = SubPhase.AfterMove;
        return;
      }
    }

    throw new Error(`Impossible to execute PI swap command at ${location}`);
  }
}
