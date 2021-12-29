import assert from "assert";
import { range, set } from "lodash";
import { version } from "../package.json";
import { finalRankings, gainFinalScoringVictoryPoints } from "./algorithms/scoring";
import { generate as generateAvailableCommands } from "./available/available-command";
import { AvailableCommand, BrainstoneActionData } from "./available/types";
import { stdBuildingValue } from "./buildings";
import {
  AdvTechTile,
  AdvTechTilePos,
  BoardAction,
  Booster,
  Building,
  Command,
  Expansion,
  Faction,
  Federation,
  FinalTile,
  Operator,
  Phase,
  Planet,
  Player as PlayerEnum,
  ResearchField,
  Resource,
  Round,
  RoundScoring,
  ScoringTile,
  SubPhase,
  TechTile,
  TechTilePos,
} from "./enums";
import Event, { EventSource } from "./events";
import { factionVariantBoard, latestVariantVersion } from "./faction-boards";
import { GaiaHex } from "./gaia-hex";
import SpaceMap, { MapConfiguration } from "./map";
import { moveAction, moveBurn, movePiSwap, moveSpecial, moveSpend } from "./move/actions";
import { autoMove } from "./move/auto";
import { moveBuild, moveLostPlanet } from "./move/buildings";
import { moveChooseFederationTile, moveFormFederation } from "./move/federation";
import { moveBrainStone, moveChargePower, moveDecline } from "./move/leech";
import { moveChooseCoverTechTile, moveChooseTechTile, moveResearch } from "./move/research";
import { moveChooseIncome, moveChooseRoundBooster, moveEndTurn, movePass } from "./move/round";
import { moveBid, moveChooseFaction, moveInit, moveRotateSectors, moveSetup } from "./move/setup";
import { moveShip } from "./move/ships";
import Player from "./player";
import { MoveTokens, powerLogString } from "./player-data";
import * as researchTracks from "./research-tracks";
import Reward from "./reward";
import { initCustomSetup, possibleSetupBoardActions } from "./setup";
import { roundScorings } from "./tiles/scoring";
import { isVersionOrLater } from "./utils";

export const LEECHING_DISTANCE = 2;

export enum AuctionVariant {
  /** Finish choosing all factions first, then start an auction phase */
  ChooseBid = "choose-bid",
  /** Bid on factions while not all factions are chosen */
  BidWhileChoosing = "bid-while-choosing",
}

export type FactionVariant =
  | "standard"
  | "more-balanced" // https://boardgamegeek.com/thread/2324994/article/36509533#36509533
  | "beta"; // https://docs.google.com/document/d/1BKTUb7kByOgBp1cW65KipZINT0InjGo0xxc3cZTs1Js/edit#

export type FactionCustomization = {
  variant: FactionVariant;
  players: number;
  version: number;
};

export type Layout = "standard" | "balanced" | "xshape";

export interface EngineOptions {
  /** Allow last player to rotate sector BEFORE faction selection */
  advancedRules?: boolean;
  /** Allow last player the entire board */
  customBoardSetup?: boolean;
  /** disable Federation check for available commands */
  noFedCheck?: boolean;
  /** Custom map given */
  map?: MapConfiguration;
  /** Are the federations flexible (allows you to avoid planets with buildings to form federation even if it's not the shortest route)? */
  flexibleFederations?: boolean;
  /** Frontiers expansion */
  frontiers?: boolean;
  /** auction */
  auction?: AuctionVariant;
  /**  **/
  factionVariant?: FactionVariant;
  factionVariantVersion?: number;
  /** Layout */
  layout?: Layout;
  /* Force players to have random factions */
  randomFactions?: boolean;
  /** player that created the game **/
  creator?: PlayerEnum;
}

export type LogEntryChanges = {
  [source in EventSource]?: { [resource in Resource]?: number };
};

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
  changes?: LogEntryChanges;
  // For round changes
  round?: number;
  // For phase change
  phase?: Phase.RoundIncome | Phase.RoundGaia | Phase.EndGame;
}

const replaceRegex = new RegExp(
  `\\b((${Command.Pass}|${Command.PISwap}|${Building.GaiaFormer}|${Command.FormFederation} [^ ]+|${Command.UpgradeResearch}) ?([^. ]+)?)(\\.|$)`,
  "g"
);

const powerRegex = new RegExp(
  " \\((\\d+(,B)?/\\d+(,B)?/\\d+(,B)?/\\d+(,B)?) ⇒ \\d+(,B)?/\\d+(,B)?/\\d+(,B)?/\\d+(,B)?\\)"
);

export function createMoveToShow(move: string, player: Player, map: SpaceMap, executeMove: () => void): string {
  let moveToGaia: MoveTokens = null;
  const data = player.data;

  const oldPower = powerLogString(data.power, data.brainstone);

  const listener = (event: MoveTokens) => (moveToGaia = event);

  const formerBooster = data.tiles.booster;

  const formerPI =
    player.faction === Faction.Ambas && move.includes(Command.PISwap)
      ? [...map.grid.values()].find((h) => h.buildingOf(player.player) === Building.PlanetaryInstitute)
      : null;

  data.on("move-tokens", listener);
  try {
    executeMove();
  } finally {
    data.off("move-tokens", listener);
  }

  const addDetails = () => {
    return move.replace(replaceRegex, (match, moveWithoutEnding, command, commandArgument, moveEnding) => {
      if (moveToGaia) {
        const powerUsage = Object.entries(moveToGaia)
          .map(([area, amt]) => {
            return amt > 0 ? area + ": " + amt : "";
          })
          .filter((s) => s.length > 0)
          .join(", ");

        return `${moveWithoutEnding} using ${powerUsage}${moveEnding}`;
      }

      switch (command) {
        case Command.Pass:
          return `${moveWithoutEnding} returning ${formerBooster}${moveEnding}`;
        case Command.PISwap:
          return `${moveWithoutEnding} (from ${formerPI.toString()})${moveEnding}`;
        case Command.UpgradeResearch: {
          const level = data.research[commandArgument];
          if (!level) {
            //decline up
            return match;
          }
          return `${moveWithoutEnding} (${level - 1} ⇒ ${level})${moveEnding}`;
        }
      }
      return match;
    });
  };

  const withDetails = addDetails();

  const newPower = powerLogString(data.power, data.brainstone);

  if (oldPower !== newPower) {
    const lastOldPower = powerRegex.exec(withDetails);
    if (lastOldPower) {
      return `${withDetails.replace(lastOldPower[0], "")} (${lastOldPower[1]} ⇒ ${newPower})`;
    }
    return `${withDetails} (${oldPower} ⇒ ${newPower})`;
  }

  return withDetails;
}

export type BoardActions = {
  [key in BoardAction]?: PlayerEnum;
};

export default class Engine {
  map: SpaceMap;
  players: Player[] = [];
  setup: Faction[] = [];
  options: EngineOptions = {};
  tiles: {
    boosters: {
      [key in Booster]?: boolean;
    };
    techs: {
      [key in TechTilePos | AdvTechTilePos]?: {
        tile: TechTile | AdvTechTile;
        count: number;
      };
    };
    scorings: {
      round: ScoringTile[];
      final: FinalTile[];
    };
    federations: {
      [key in Federation]?: number;
    };
  } = {
    boosters: {},
    techs: {},
    scorings: { round: [], final: [] },
    federations: {},
  };
  boardActions: BoardActions = {};

  terraformingFederation: Federation;
  availableCommands: AvailableCommand[] = [];
  availableCommand: AvailableCommand;
  phase: Phase = Phase.SetupInit;
  subPhase: SubPhase = SubPhase.BeforeMove;
  oldPhase: Phase;
  randomFactions?: Faction[];
  version = version;
  replayVersion: string;
  replay: boolean; // be more permissive during replay

  get expansions(): Expansion {
    return 0 | (this.options.frontiers ? Expansion.Frontiers : 0);
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
  leechSources: Array<{
    player: PlayerEnum;
    coordinates: string;
  }> = [];
  // When ongoing leech, remember the source in case
  lastLeechSource: {
    player: PlayerEnum;
    coordinates: string;
  };

  // All moves
  moveHistory: string[] = [];
  // Advanced log
  advancedLog: LogEntry[] = [];
  // Current move being processed, separated in phase
  turnMoves: string[] = [];
  // Tells the UI if the new move should be on the same line or not
  newTurn = true;

  constructor(moves: string[] = [], options: EngineOptions = {}, engineVersion?: string, replay?: boolean) {
    this.options = options;
    if (engineVersion) {
      this.version = engineVersion;
    }
    this.replay = replay;
    if (this.options.factionVariantVersion === undefined) {
      this.options.factionVariantVersion = latestVariantVersion(this.options.factionVariant);
    }
    this.sanitizeOptions();
    this.loadMoves(moves);
    this.options = options;
  }

  /** Fix old options passed. To remove when legacy data is no more in database */
  sanitizeOptions(players?: Player[]) {
    if (this.options.factionVariant === undefined) {
      this.options.factionVariant = "standard";
    }
    if ((this.options.auction as any) === true) {
      if (this.isVersionOrLater("4.7.0")) {
        this.options.auction = AuctionVariant.BidWhileChoosing;
      } else {
        this.options.auction = AuctionVariant.ChooseBid;
      }
    }
    if (players && this.options.factionVariantVersion === undefined) {
      const versions = (players as Array<Player & { factionVariantVersion?: number }>)
        .filter((p) => p.factionVariantVersion !== undefined && p.factionVariantVersion !== null)
        .map((p) => p.factionVariantVersion);

      this.options.factionVariantVersion = Math.max(...versions, 0);
    }
  }

  get factionCustomization(): FactionCustomization {
    return {
      variant: this.options.factionVariant,
      version: this.options.factionVariantVersion,
      players: this.players.length,
    };
  }

  isVersionOrLater(version: string) {
    return isVersionOrLater(this.version, version);
  }

  loadMoves(_moves: string[]) {
    const moves = [..._moves];

    while (moves.length > 0) {
      const move = moves.shift().trim();

      this.move(move, moves.length === 0);
    }
  }

  move(_move: string, allowIncomplete = true) {
    if (this.replay) {
      this.newTurn = true;
    } else {
      assert(this.newTurn, "Cannot execute a move after executing an incomplete move");
    }

    const execute = () => {
      try {
        if (!this.executeMove(move)) {
          if (!this.replay) {
            assert(allowIncomplete, `Move ${move} (line ${this.moveHistory.length + 1}) is not complete!`);
          }
          this.newTurn = false;
        }
      } catch (e) {
        console.log(this.assertContext());
        throw e;
      }
    };

    const move = _move.trim();
    let moveToShow = move;
    if (this.playerToMove !== undefined) {
      this.log(this.playerToMove, undefined, 0, undefined);
      moveToShow = createMoveToShow(move, this.player(this.playerToMove), this.map, execute);
    } else {
      execute();
    }

    if (!this.replay) {
      assert(this.turnMoves.length === 0, "Unnecessary commands at the end of the turn: " + this.turnMoves.join(". "));
    }
    this.moveHistory.push(moveToShow);
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
      this.addAdvancedLog({
        player,
        move,
        changes: amount
          ? {
              [source]: { [resource]: amount },
            }
          : undefined,
      });
    }
  }

  protected addAdvancedLog(entry: LogEntry) {
    this.advancedLog.push(entry);
  }

  generateAvailableCommandsIfNeeded(subphase: SubPhase = null, data?: any): AvailableCommand[] {
    return this.availableCommands || this.generateAvailableCommands(subphase, data);
  }

  generateAvailableCommands(subphase: SubPhase = null, data?: any): AvailableCommand[] {
    return (this.availableCommands = generateAvailableCommands(this, subphase, data));
  }

  findAvailableCommand<C extends Command>(player: PlayerEnum, command: C): AvailableCommand<C> | null {
    this.availableCommands = this.availableCommands || this.generateAvailableCommands();
    return this.availableCommands.find((availableCommand) => {
      if (availableCommand.name !== command) {
        return false;
      }
      if (availableCommand.player === undefined) {
        return false;
      }
      return availableCommand.player === player;
    }) as AvailableCommand<C>;
  }

  clearAvailableCommands() {
    this.availableCommands = null;
    this.availableCommand = null;
  }

  addPlayer(player: Player) {
    this.players.push(player);

    player.data.on(`gain-${Resource.TechTile}`, (count, source) =>
      this.processNextMove(SubPhase.ChooseTechTile, null, source === BoardAction.Qic1)
    );
    player.data.on(`gain-${Resource.TemporaryStep}`, () => this.processNextMove(SubPhase.BuildMine, null, true));
    player.data.on(`gain-${Resource.TemporaryRange}`, (count: number) => {
      this.processNextMove(SubPhase.BuildMineOrGaiaFormer, null, true);
    });
    player.data.on(`gain-${Resource.RescoreFederation}`, () =>
      this.processNextMove(SubPhase.RescoreFederationTile, null, true)
    );
    player.data.on(`gain-${Resource.PISwap}`, () => this.processNextMove(SubPhase.PISwap, null, true));
    player.data.on(`gain-${Resource.SpaceStation}`, () => this.processNextMove(SubPhase.SpaceStation, null, true));
    player.data.on(`gain-${Resource.DowngradeLab}`, () => {
      this.processNextMove(SubPhase.DowngradeLab, null, true);
      this.processNextMove(SubPhase.UpgradeResearch, null, false);
    });
    player.data.on(`gain-${Resource.UpgradeLowest}`, () =>
      this.processNextMove(SubPhase.UpgradeResearch, { bescods: true }, true)
    );
    player.data.on("brainstone", (data: BrainstoneActionData) => this.processNextMove(SubPhase.BrainStone, data));
    // Test before upgrading research that it's actually possible. Needed when getting up-int or up-nav in
    // the spaceship expansion
    player.data.on("beforeResearchUpgrade", (field) => {
      const destTile = player.data.research[field] + 1;
      if (!player.canUpgradeResearch(field)) {
        player.data.canUpgradeResearch = false;
      } else if (
        destTile === researchTracks.lastTile(field) &&
        this.players.some((pl) => pl.data.research[field] === destTile)
      ) {
        player.data.canUpgradeResearch = false;
      }
    });

    /* For advanced log */
    for (const resource of [
      Resource.VictoryPoint,
      Resource.ChargePower,
      Resource.Credit,
      Resource.Qic,
      Resource.Knowledge,
      Resource.Ore,
      Resource.GainToken,
    ]) {
      player.data.on(`gain-${resource}`, (amount: number, source: EventSource) =>
        this.log(player.player, resource, amount, source)
      );
      player.data.on(`pay-${resource}`, (amount: number, source: EventSource) =>
        this.log(player.player, resource, -amount, source)
      );
    }
  }

  player(player: PlayerEnum): Player | null {
    return this.players[player];
  }

  playersInOrder(): Player[] {
    return this.turnOrder.map((i) => this.players[i]);
  }

  /**
   * Get next players starting from `player`, finishing to the player before `player`
   * @param player
   */
  playersInTableOrderFrom(player: PlayerEnum): Player[] {
    const pos = this.turnOrderAfterSetupAuction.findIndex((pl) => pl === player);
    const turn = [...this.turnOrderAfterSetupAuction.slice(pos), ...this.turnOrderAfterSetupAuction.slice(0, pos)];
    return turn.map((pl) => this.players[pl]);
  }

  get turnOrderAfterSetupAuction(): PlayerEnum[] {
    return this.setup.map((faction) => this.players.findIndex((pl) => pl.faction === faction));
  }

  get playerToMove(): PlayerEnum {
    if (this.tempCurrentPlayer !== undefined) {
      return this.tempCurrentPlayer;
    }

    return this.currentPlayer;
  }

  numberOfPlayersWithFactions(): number {
    return this.players.filter((pl) => pl.faction).length;
  }

  getNextPlayer(list: PlayerEnum[] = this.turnOrder) {
    return list[(list.indexOf(this.currentPlayer) + 1) % list.length];
  }

  moveToNextPlayer(list: PlayerEnum[], params: { loop?: boolean } = { loop: true }) {
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

  /** Automatically generate moves based on player settings */
  autoMove(partialMove?: string, options?: { autoPass?: boolean }): boolean {
    return autoMove(this, partialMove, options);
  }

  static fromData(data: Record<string, any>): Engine {
    const engine = new Engine();
    delete engine.version;

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

    engine.sanitizeOptions(data.players);

    if (data.map) {
      engine.map = SpaceMap.fromData(data.map);
      engine.map.nbPlayers = data.players.length;
      engine.map.layout = engine.options.layout;
      engine.map.placement = engine.options.map;
    }

    //players are not added to engine yet
    const customization = {
      variant: engine.options.factionVariant,
      players: data.players.length,
      version: engine.options.factionVariantVersion,
    };
    for (const player of data.players) {
      engine.addPlayer(
        Player.fromData(
          player,
          engine.map,
          player.faction && factionVariantBoard(customization, player.faction),
          engine.expansions,
          engine.version
        )
      );
    }

    if (data.map) {
      for (const hex of engine.map.grid.values()) {
        for (const player of hex.occupyingPlayers()) {
          engine.player(player).data.occupied.push(hex);
        }
      }
    }

    // LEGACY CODE
    // TODO: Remove when games are updated (also remove player !== Player.Player5)
    for (const key of Object.keys(engine.boardActions)) {
      const action = engine.boardActions[key];
      if (typeof action === "boolean") {
        engine.boardActions[key] = action ? null : PlayerEnum.Player5;
      }
    }

    return engine;
  }

  toJSON() {
    // Export getters as well as data
    const proto = Object.getPrototypeOf(this);
    const jsonObj: any = Object.assign({}, this);

    Object.entries(Object.getOwnPropertyDescriptors(proto))
      .filter(([key, descriptor]) => typeof descriptor.get === "function")
      .map(([key, descriptor]) => {
        if (descriptor && key[0] !== "_") {
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

  replayedTo(move = Infinity, keepReplayMode = false) {
    const oldHistory = this.moveHistory.slice(0, move);
    const oldPlayers = this.players;
    const engine = new Engine(oldHistory.slice(0, 1), this.options, this.version ?? "1.0.0", true);

    for (let i = 0; i < oldPlayers.length && i < engine.players.length; i++) {
      engine.players[i].name = oldPlayers[i].name;
      engine.players[i].dropped = oldPlayers[i].dropped;
      if ((oldPlayers[i] as any).factionVariant && !oldPlayers[i].variant) {
        // LEGACY
        engine.players[i].variant = {
          board: (oldPlayers[i] as any).factionVariant,
          version: (oldPlayers[i] as any).factionVersion,
        };
      } else {
        engine.players[i].variant = oldPlayers[i].variant;
      }
    }

    engine.loadMoves(oldHistory.slice(1));
    assert(engine.newTurn, "Last move of the game is incomplete");

    engine.replay = keepReplayMode;

    engine.generateAvailableCommandsIfNeeded();

    return engine;
  }

  static slowMotion([first, ...moves]: string[], options: EngineOptions = {}, version: string = null): Engine {
    if (!first) {
      return new Engine([], options, version);
    }
    let state = JSON.parse(JSON.stringify(new Engine([first], options, version)));

    for (const move of moves) {
      const tempEngine = Engine.fromData(state);
      tempEngine.move(move);
      state = JSON.parse(JSON.stringify(tempEngine));
    }

    return Engine.fromData(state);
  }

  static parseMoves(moves: string) {
    return moves
      .trim()
      .split("\n")
      .map((move) => move.trim());
  }

  /**
   * Load turn moves.
   *
   * @param move The move string to process. Can contain multiple moves separated by a dot
   * @param params params.processFirst indicates to process the first move. params.split is set to true if leftover commands are allowed
   */
  loadTurnMoves(
    move: string,
    params: { split?: boolean; processFirst?: boolean } = {
      split: true,
      processFirst: false,
    }
  ) {
    this.oldPhase = this.phase;

    const playerS = move.substr(0, move.indexOf(" "));
    let player: number;

    if (/^p[1-7]$/.test(playerS)) {
      player = +playerS[1] - 1;
    } else {
      const pl = this.players.find((_pl) => _pl.faction === playerS);

      if (pl) {
        player = pl.player;
      }
    }

    if (!this.replay) {
      assert(
        this.playerToMove === (player as PlayerEnum),
        "Wrong turn order in move " + move + ", expected player " + (this.playerToMove + 1)
      );
    }
    this.processedPlayer = player;

    const split = params.split ?? true;
    const processFirst = params.processFirst ?? true;

    if (!split) {
      assert(processFirst);
    }

    this.turnMoves = move
      .substr(playerS.length)
      .split(".")
      .map((x) => x.trim());

    if (processFirst) {
      this.processNextMove();

      assert(
        split || this.turnMoves.length === 0,
        "There is an extra command at the end of the turn: " + this.turnMoves.join(". ")
      );
    }
  }

  /**
   * Return true if it is a full move
   * @param move
   */
  executeMove(move: string) {
    try {
      this[this.phase](move);
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
    const split = move.split(" ");
    return {
      command: (split[0] || Command.EndTurn) as Command,
      args: split.slice(1),
    };
  }

  processNextMove(subphase?: SubPhase, data?: any, required = false) {
    if (subphase) {
      this.generateAvailableCommands(subphase, data);
      if (this.availableCommands.length === 0) {
        if (required && !this.replay) {
          // not allowed - see https://github.com/boardgamers/gaia-project/issues/76
          this.availableCommands = [{ name: Command.DeadEnd, player: this.currentPlayer, data: subphase }];
        } else {
          return;
        }
      }
    }
    if (this.turnMoves.length === 0) {
      throw Object.assign(new Error("Missing command to end turn"), {
        availableCommands: this.availableCommands,
      });
    }
    const move = this.parseMove(this.turnMoves.shift());

    if (move.args.length === 2 && move.args[0] === "⇒") {
      // power log - should have been solved differently, but it's already in log files
      return;
    }

    this.checkCommand(move.command);

    const moveRegistry: {
      [key in Command]: (engine: Engine, command: AvailableCommand, player: PlayerEnum, ...args: any) => void;
    } = {
      [Command.Init]: () => {
        throw new Error("init cannot be executed");
      },
      [Command.DeadEnd]: () => {
        throw new Error("deadEnd cannot be executed");
      },
      [Command.Setup]: moveSetup,
      [Command.RotateSectors]: moveRotateSectors,
      [Command.ChooseFaction]: moveChooseFaction,
      [Command.Bid]: moveBid,
      [Command.Build]: moveBuild,
      [Command.PlaceLostPlanet]: moveLostPlanet,
      [Command.MoveShip]: moveShip,
      [Command.Special]: moveSpecial,
      [Command.Spend]: moveSpend,
      [Command.BurnPower]: moveBurn,
      [Command.Action]: moveAction,
      [Command.PISwap]: movePiSwap,
      [Command.ChooseFederationTile]: moveChooseFederationTile,
      [Command.FormFederation]: moveFormFederation,
      [Command.ChargePower]: moveChargePower,
      [Command.Decline]: moveDecline,
      [Command.BrainStone]: moveBrainStone,
      [Command.UpgradeResearch]: moveResearch,
      [Command.ChooseTechTile]: moveChooseTechTile,
      [Command.ChooseCoverTechTile]: moveChooseCoverTechTile,
      [Command.ChooseRoundBooster]: moveChooseRoundBooster,
      [Command.Pass]: movePass,
      [Command.EndTurn]: moveEndTurn,
      [Command.ChooseIncome]: moveChooseIncome,
    };
    moveRegistry[move.command](this, this.avCommand(), this.playerToMove, ...move.args);

    return move;
  }

  peekNextMove() {
    return this.parseMove(this.turnMoves[0]);
  }

  checkCommand(command: Command) {
    this.availableCommand = this.findAvailableCommand(this.playerToMove, command);
    if (!this.availableCommand && !this.replay) {
      assert(this.availableCommand, `Command ${command} is not in the list of available commands`);
    }
  }

  private assertContext(): string {
    return `last command: ${this.moveHistory[this.moveHistory.length - 1]}, index: ${this.moveHistory.length},
    available: ${JSON.stringify(this.generateAvailableCommandsIfNeeded())}`;
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
    const roundScoring = roundScorings[roundScoringTile];
    return roundScoring && Event.parse(roundScoring, `round${this.round}` as RoundScoring);
  }

  /**
   * Handle income phase of current player, and the one after that and so on.
   * Pauses if an action is needed from the player.
   */
  handleNextIncome() {
    const pl = this.player(this.currentPlayer);
    if (pl.incomeSelection().needed) {
      return false;
    }

    pl.receiveIncome(pl.events[Operator.Income]);

    if (!this.moveToNextPlayer(this.tempTurnOrder, { loop: false })) {
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

    if (!this.moveToNextPlayer(this.tempTurnOrder, { loop: false })) {
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

    if (this.options.customBoardSetup) {
      initCustomSetup(this);

      // The creator does board setup and rotation
      this.currentPlayer = this.players[this.options.creator ?? 0].player;
    } else if (this.options.advancedRules) {
      // The last player is the one to rotate the sectors
      this.currentPlayer = this.players.slice(-1).pop().player;
    } else {
      this.beginSetupFactionPhase();
    }
  }

  beginSetupFactionPhase() {
    this.changePhase(Phase.SetupFaction);
    this.turnOrder = this.players.map((pl) => pl.player as PlayerEnum);
    this.moveToNextPlayer(this.turnOrder, { loop: false });
  }

  beginSetupAuctionPhase() {
    this.changePhase(Phase.SetupAuction);
    this.turnOrder = this.players.map((pl) => pl.player as PlayerEnum);
    this.moveToNextPlayer(this.turnOrder, { loop: false });
  }

  endSetupFactionPhase() {
    for (const pl of this.players) {
      if (!pl.faction) {
        pl.faction = this.setup[pl.player as PlayerEnum];
      }
      const faction = pl.faction;
      const board = pl.variant ?? factionVariantBoard(this.factionCustomization, faction);
      pl.loadFaction(board, this.expansions);
    }

    this.beginSetupBuildingPhase();
  }

  beginSetupBuildingPhase() {
    this.changePhase(Phase.SetupBuilding);

    const posIvits = this.players.findIndex((player) => player.faction === Faction.Ivits);

    const setupTurnOrder = this.turnOrderAfterSetupAuction.filter((i) => i !== posIvits);
    const reverseSetupTurnOrder = setupTurnOrder.slice().reverse();
    this.turnOrder = setupTurnOrder.concat(reverseSetupTurnOrder);

    const posXenos = this.players.findIndex((player) => player.faction === Faction.Xenos);

    if (posXenos !== -1) {
      this.turnOrder.push(posXenos as PlayerEnum);
    }

    if (posIvits !== -1) {
      if (this.players.length === 2 && this.factionCustomization.variant === "more-balanced") {
        const first = this.turnOrder.shift();
        this.turnOrder.unshift(posIvits as PlayerEnum);
        this.turnOrder.unshift(first);
      } else {
        this.turnOrder.push(posIvits as PlayerEnum);
      }
    }

    this.moveToNextPlayer(this.turnOrder, { loop: false });
  }

  beginSetupBoosterPhase() {
    this.changePhase(Phase.SetupBooster);
    this.turnOrder = this.turnOrderAfterSetupAuction.reverse();
    this.moveToNextPlayer(this.turnOrder, { loop: false });
  }

  beginRoundStartPhase() {
    this.round += 1;
    this.addAdvancedLog({ round: this.round });
    this.turnOrder = this.passedPlayers || this.turnOrderAfterSetupAuction;
    this.passedPlayers = [];
    this.currentPlayer = this.turnOrder[0];

    for (const player of this.playersInOrder()) {
      player.loadEvents(this.currentRoundScoringEvents);
      player.data.ships?.forEach((s) => {
        s.moved = false;
      });
    }

    this.beginIncomePhase();
  }

  beginIncomePhase() {
    this.changePhase(Phase.RoundIncome);
    this.addAdvancedLog({ phase: Phase.RoundIncome });
    this.tempTurnOrder = [...this.turnOrder];

    this.moveToNextPlayer(this.tempTurnOrder, { loop: false });
    this.handleNextIncome();
  }

  endIncomePhase() {
    // remove incomes from roundboosters
    for (const player of this.playersInOrder()) {
      player.removeRoundBoosterEvents(Operator.Income);
    }

    this.beginGaiaPhase();
  }

  beginGaiaPhase() {
    this.changePhase(Phase.RoundGaia);
    this.addAdvancedLog({ phase: Phase.RoundGaia });
    this.tempTurnOrder = [...this.turnOrder];

    // transform Transdim planets into Gaia if gaiaformed
    for (const hex of this.map.toJSON()) {
      if (
        hex.data.planet === Planet.Transdim &&
        hex.data.player !== undefined &&
        hex.data.building === Building.GaiaFormer
      ) {
        hex.data.planet = Planet.Gaia;
      }
    }

    this.moveToNextPlayer(this.tempTurnOrder, { loop: false });
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
      this.boardActions[pos] = null;
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
    this.addAdvancedLog({ phase: Phase.EndGame });
    this.currentPlayer = this.tempCurrentPlayer = undefined;
    const allRankings = finalRankings(this.tiles.scorings.final, this.players);

    // Group gained points per player
    for (const player of this.players) {
      gainFinalScoringVictoryPoints(allRankings, player);

      player.data.gainResearchVictoryPoints();

      player.data.finalResourceHandling();

      //remove bids
      player.gainRewards([new Reward(Math.max(Math.floor(-1 * player.data.bid)), Resource.VictoryPoint)], Command.Bid);
    }
  }

  beginLeechingPhase() {
    if (this.leechSources.length === 0) {
      this.beginRoundMovePhase();
      return;
    }
    const source = this.leechSources.shift();
    const sourceHex = this.map.getS(source.coordinates);
    const canLeechPlayers: Player[] = [];

    this.lastLeechSource = source;

    // Gaia-formers & space stations don't trigger leech
    if (stdBuildingValue(sourceHex.buildingOf(source.player)) === 0) {
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
      // Do not use PlayerData.maxLeech() here, cuz taklons
      pl.data.leechPossible = this.leechPossible(sourceHex, (hex) => pl.buildingValue(this.map.grid.get(hex)));
      if (pl.canLeech()) {
        canLeechPlayers.push(pl);
      }
    }

    if (canLeechPlayers.length > 0) {
      this.changePhase(Phase.RoundLeech);
      this.tempTurnOrder = canLeechPlayers.map((pl) => pl.player);
      this.tempCurrentPlayer = this.tempTurnOrder.shift();
    } else {
      return this.beginLeechingPhase();
    }
  }

  leechPossible(sourceHex: GaiaHex, buildingValue: (GaiaHex) => number) {
    let leech = 0;
    for (const hex of this.map.withinDistance(sourceHex, LEECHING_DISTANCE)) {
      leech = Math.max(leech, buildingValue(hex));
    }
    return leech;
  }

  advanceResearchAreaPhase(player: PlayerEnum, cost: string, field: ResearchField) {
    const pl = this.player(player);

    if (!pl.canUpgradeResearch(field)) {
      return;
    }

    const destTile = pl.data.research[field] + 1;

    // If someone is already on last tile
    if (destTile === researchTracks.lastTile(field)) {
      if (this.players.some((pl2) => pl2.data.research[field] === destTile)) {
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
      }
    }
  }

  // ****************************************
  // ******** PHASE COMMAND HANDLING ********
  // ****************************************
  [Phase.SetupInit](move: string) {
    const split = move.split(" ");
    const command = split.shift() as Command;

    assert(command === Command.Init, "The first command of a game needs to be the initialization command");

    const players = split.shift();
    moveInit(this, +players || 2, split.shift() || "defaultSeed");

    this.beginSetupBoardPhase();
  }

  [Phase.SetupBoard](move: string) {
    this.loadTurnMoves(move, { split: false, processFirst: true });

    if (possibleSetupBoardActions(this, this.currentPlayer).length === 0 || move.includes(Command.RotateSectors)) {
      this.beginSetupFactionPhase();
    }
  }

  [Phase.SetupFaction](move: string) {
    this.loadTurnMoves(move, { split: false, processFirst: true });
    // Legacy: there might be a few games that ended up in the 4.7.0 <= version < 4.8.0 state.
    if (this.isVersionOrLater("4.7.0") && this.options.auction !== AuctionVariant.ChooseBid) {
      this.moveToNextPlayerWithoutAChosenFaction();
      return;
    }
    if (!this.moveToNextPlayer(this.turnOrder, { loop: false })) {
      if (this.options.auction) {
        this.beginSetupAuctionPhase();
      } else {
        this.endSetupFactionPhase();
      }
    }
  }

  [Phase.SetupAuction](move: string) {
    this.loadTurnMoves(move, { processFirst: true });
    this.moveToNextPlayerWithoutAChosenFaction();
  }

  private moveToNextPlayerWithoutAChosenFaction() {
    const player = [...range(this.currentPlayer + 1, this.players.length), ...range(0, this.currentPlayer)].find(
      (player) => !this.players.some((pl) => pl.player === player && pl.faction)
    );

    if (player !== undefined) {
      this.currentPlayer = player;
    } else {
      this.endSetupFactionPhase();
    }
  }

  [Phase.SetupBuilding](move: string) {
    this.loadTurnMoves(move, { split: false, processFirst: true });

    if (!this.moveToNextPlayer(this.turnOrder, { loop: false })) {
      this.beginSetupBoosterPhase();
    }
  }

  [Phase.SetupBooster](move: string) {
    this.loadTurnMoves(move, { split: false, processFirst: true });

    if (!this.moveToNextPlayer(this.turnOrder, { loop: false })) {
      this.beginRoundStartPhase();
    }
  }

  [Phase.RoundIncome](move: string) {
    this.loadTurnMoves(move, { processFirst: true });

    while (!this.handleNextIncome()) {
      this.generateAvailableCommands();
      this.processNextMove();
    }
  }

  [Phase.RoundGaia](move: string) {
    this.loadTurnMoves(move, { processFirst: true });

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
    this.loadTurnMoves(move, { split: false, processFirst: true });
    this.tempCurrentPlayer = this.tempTurnOrder.shift();

    // Current leech round ended
    if (this.tempCurrentPlayer === undefined) {
      // Next leech rounds (eg: double leech happens with lab + lost planet in same turn)
      this.beginLeechingPhase();
    }
  }

  private avCommand<C extends Command>(): AvailableCommand<C> {
    return this.availableCommand as AvailableCommand<C>;
  }
}
