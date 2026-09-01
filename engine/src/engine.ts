import { set } from "lodash";
import { version } from "../package.json";
import {
  defaultPreferenceSplitBudget,
  PreferenceSplitBid,
  PreferenceSplitResult,
} from "./algorithms/preference-split-auction";
import { SilentAuctionBid, SilentAuctionStep } from "./algorithms/silent-auction";
import { generate as generateAvailableCommands } from "./available/available-command";
import { AvailableCommand, BrainstoneActionData } from "./available/types";
import {
  AnyTechTile,
  AnyTechTilePos,
  ArtifactToken,
  BoardAction,
  Booster,
  Building,
  Command,
  Expansion,
  Faction,
  Federation,
  FinalTile,
  LostFleetEconomySide,
  Phase,
  Planet,
  Player as PlayerEnum,
  Resource,
  Round,
  ScoringBoardExtensionSide,
  ScoringTile,
  Spaceship,
  SpaceshipFederation,
  SubPhase,
} from "./enums";
import Event, { EventSource } from "./events";
import { factionVariantBoard, latestVariantVersion } from "./faction-boards";
import SpaceMap, { MapConfiguration } from "./map";
import {
  moveAction,
  moveBurn,
  moveChooseTinkeringTile,
  movePiSwap,
  movePlacePowerRing,
  moveSpecial,
  moveSpend,
} from "./move/actions";
import { appendCommand, moveAI as generateAIMove } from "./move/ai";
import { moveChooseArtifactToken, moveExamineArtifact } from "./move/artifacts";
import { autoMove } from "./move/auto";
import { moveBuild, moveLostPlanet } from "./move/buildings";
import { moveExplore } from "./move/exploration";
import { moveChooseFederationTile, moveFormFederation } from "./move/federation";
import { moveBrainStone, moveChargePower, moveDecline } from "./move/leech";
import {
  phaseRoundGaia,
  phaseRoundIncome,
  phaseRoundLeech,
  phaseRoundMove,
  phaseSetupAuction,
  phaseSetupBoard,
  phaseSetupBooster,
  phaseSetupBuilding,
  phaseSetupFaction,
  phaseSetupFactionBan,
  phaseSetupInit,
  phaseSetupPreferenceBid,
  phaseSetupSilentBid,
} from "./move/phase";
import { moveChooseCoverTechTile, moveChooseTechTile, moveResearch } from "./move/research";
import { moveChooseIncome, moveChooseRoundBooster, moveEndTurn, movePass } from "./move/round";
import {
  moveBanFaction,
  moveBid,
  moveChooseFaction,
  movePreferenceBid,
  moveRotateSectors,
  moveSetup,
  moveSilentBid,
} from "./move/setup";
import { moveGaiaFormTransdim, moveSpaceshipAction } from "./move/spaceship-actions";
import Player from "./player";
import { MoveTokens, powerLogString } from "./player-data";
import { lastTile } from "./research-tracks";
import { SeededSpaceshipTech, SpaceshipActionType } from "./spaceships";
import { roundScoringEvents } from "./tiles/scoring";
import { isVersionOrLater } from "./utils";
import assert from "./utils/assert";

export const LEECHING_DISTANCE = 2;

export enum AuctionVariant {
  /** Finish choosing all factions first, then start an auction phase */
  ChooseBid = "choose-bid",
  /** Bid on factions while not all factions are chosen */
  BidWhileChoosing = "bid-while-choosing",
  /**
   * Sealed-bid ("Silent Auction") variant: a sequential ban round (one forced ban per player),
   * then a sequential pick round (one distinct faction per player), then every player privately
   * and SIMULTANEOUSLY submits a max-VP bid for each picked faction (hosted play collects those
   * in `auction_sealed_bids`, exactly as the Preference Split does). Once everyone has submitted, an ascending-auction
   * algorithm (see algorithms/silent-auction.ts) automatically assigns each player the faction that
   * maximizes their own value, at the lowest price nobody else was willing to beat.
   */
  Silent = "silent",
  /**
   * "Preference Split Auction" (4 players / 4 factions only): after the pick round, every player
   * secretly splits ONE fixed budget of `EngineOptions.auctionBudget` whole bid points across the
   * four picked factions, all at the same time. Nothing is revealed until all four submissions are
   * in, and the whole assignment then follows mechanically from the numbers - factions ranked by
   * the total bid on them, each awarded to the highest still-unassigned bidder, priced at the
   * faction's average bid capped by the winner's own bid. See
   * algorithms/preference-split-auction.ts.
   */
  PreferenceSplit = "preference-split",
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
  /** Lost Fleet expansion */
  lostFleet?: boolean;
  /**
   * Lost Fleet §H1 "official rules" map restriction: force the center sector(s) (the sector
   * bordering everything else at 2p/3p, or both hub sectors at 4p) to be drawn from sectors 1-4
   * only, instead of the fully random center this engine previously always generated. Defaults to
   * false (unrestricted, matching every game generated before this option existed).
   */
  officialCenterSectors?: boolean;
  /** auction */
  auction?: AuctionVariant;
  /**
   * Total bid budget each player must split across the factions in the Preference Split Auction
   * (AuctionVariant.PreferenceSplit). Ignored by every other variant. Undefined falls back to
   * `defaultPreferenceSplitBudget(players)`, which is also what pre-existing stored games (none
   * yet, but the fallback keeps a future default change from rewriting old games) replay with.
   */
  auctionBudget?: number;
  /**
   * Independent sequential-ban round before faction selection (one forced ban per player, turn
   * order), regardless of auction variant. Undefined (not explicitly set) falls back to the legacy
   * rule of "Silent Auction always bans" for backward compatibility with games created before this
   * flag existed - see `beginSetupFactionPhaseOrBan` in move/phase.ts.
   */
  banPhase?: boolean;
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

export type LogEntryChange = { [resource in Resource]?: number };
export type LogEntryChanges = {
  [source in EventSource]?: LogEntryChange;
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
  phase?: Phase.RoundIncome | Phase.RoundGaia | Phase.RoundMove | Phase.EndGame;
}

/**
 * Premove support (PREMOVE_PLAN.md §2): the phases of a running round that `previewAvailableCommandsFor`
 * will preview an off-turn seat's upcoming move-phase turn from. `RoundMove` is the obvious one; the
 * other three are the states a live async game actually SITS in between turns - waiting on someone
 * else's power-charge answer, or on a start-of-round income/gaia choice - which is precisely when a
 * player reaches for a premove. Everything else (setup, auction, scoring, endgame, and the transient
 * `RoundStart`/`RoundFinish` the engine never rests in) has no well-defined "my next turn"
 * to preview.
 */
const premovePreviewablePhases: Phase[] = [Phase.RoundMove, Phase.RoundLeech, Phase.RoundIncome, Phase.RoundGaia];

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
      ? Array.from(map.grid.values()).find((h) => h.buildingOf(player.player) === Building.PlanetaryInstitute)
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

export type SpaceshipActions = {
  [key in Spaceship]?: { [key in SpaceshipActionType]?: PlayerEnum };
};

export default class Engine {
  map: SpaceMap;
  players: Player[] = [];
  setup: Faction[] = [];
  // Silent Auction variant (AuctionVariant.Silent) state - see move/phase.ts's
  // SetupFactionBan/SetupSilentBid phases and algorithms/silent-auction.ts.
  bannedFactions: Faction[] = [];
  silentAuctionBids: SilentAuctionBid[] = [];
  silentAuctionLog: SilentAuctionStep[] = [];
  // Preference Split Auction variant (AuctionVariant.PreferenceSplit) state - see move/phase.ts's
  // SetupPreferenceBid phase and algorithms/preference-split-auction.ts. `preferenceSplitResult`
  // is the persisted, audited outcome (ranking, both kinds of random tiebreak, every payment):
  // written exactly once, when the last submission lands, and never recomputed afterwards.
  preferenceSplitBids: PreferenceSplitBid[] = [];
  preferenceSplitResult?: PreferenceSplitResult;
  options: EngineOptions = {};
  tiles: {
    boosters: {
      [key in Booster]?: boolean;
    };
    techs: {
      [key in AnyTechTilePos]?: {
        tile: AnyTechTile;
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
    spaceshipTechs: {
      [key in Spaceship]?: SeededSpaceshipTech;
    };
    spaceshipFederations: {
      [key in Spaceship]?: SpaceshipFederation;
    };
    artifacts: ArtifactToken[];
  } = {
    boosters: {},
    techs: {},
    scorings: { round: [], final: [] },
    federations: {},
    spaceshipTechs: {},
    spaceshipFederations: {},
    artifacts: [],
  };
  boardActions: BoardActions = {};
  spaceshipActions: SpaceshipActions = {};

  terraformingFederation: Federation;
  // Lost Fleet's Scoring Board Extension: the face-up side, decided once per game at setup (§E6).
  scoringExtensionSide?: ScoringBoardExtensionSide;
  // Lost Fleet's Moweyds/Tinkeroids Terraforming board: the randomized 7-color row, placed once at
  // setup (RULES_CLARIFICATIONS.md §B5, rulebook p.8: "the 7 base colors are placed on the board in
  // a random order"). Computed at init and PERSISTED because `SpaceMap.toJSON()` does not carry the
  // seed — recomputing it lazily from `map.seed` after a fromData round trip broke §J3 determinism
  // (fuzzer finding LF-1, regression fixture lf-001).
  lostFleetTerraformingRow?: Planet[];
  // Lost Fleet's Economy research track overlay tile: the face-up side, decided once per game at
  // setup (§F1).
  lostFleetEconomySide?: LostFleetEconomySide;
  availableCommands: AvailableCommand[] = [];
  availableCommand: AvailableCommand;
  phase: Phase = Phase.SetupInit;
  subPhase: SubPhase = SubPhase.BeforeMove;
  oldPhase: Phase;
  randomFactions?: Faction[];
  version = version;
  replayVersion: string;
  replay: boolean; // be more permissive during replay

  /** The Preference Split Auction's per-player bid budget, defaulted once so every layer
   * (move validation, available commands, the viewer's form) reads the same number. The default
   * scales with the player count - see `defaultPreferenceSplitBudget`. Only safe to read once
   * `players` is populated; `moveInit` resolves the same default from its own argument instead. */
  get preferenceSplitBudget(): number {
    return this.options.auctionBudget ?? defaultPreferenceSplitBudget(this.players.length);
  }

  get expansions(): Expansion {
    return 0 | (this.options.lostFleet ? Expansion.LostFleet : 0);
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
  // Raw move string for an incomplete turn, used by the viewer to append
  // follow-up commands without the human-readable log decorations.
  pendingMove = "";
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
      if (!this.executeMove(move)) {
        if (!this.replay) {
          assert(allowIncomplete, `Move ${move} (line ${this.moveHistory.length + 1}) is not complete!`);
        }
        this.newTurn = false;
      }
    };

    const move = _move.trim();
    this.pendingMove = move;
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
    this.pendingMove = this.newTurn ? "" : move;
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

  addAdvancedLog(entry: LogEntry) {
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

  /**
   * "Premove" support (PREMOVE_PLAN.md §2): forces THIS engine - always a disposable preview clone,
   * never a real game state - into "it is `seat`'s ordinary move-phase turn right now".
   *
   * The phase override is the part that's easy to miss: `available-command.ts`'s generator branches
   * on `engine.phase` first, so a clone left in `RoundLeech` (or `RoundIncome`/`RoundGaia`) answers
   * with that phase's decision - or with nothing at all once its `tempTurnOrder` no longer names the
   * forced seat - instead of the move the seat will actually get. That's what previously emptied the
   * command list for a Sequential premove chained after one that offers an opponent a leech.
   */
  forcePremovePreviewTurn(seat: PlayerEnum) {
    this.phase = Phase.RoundMove;
    this.currentPlayer = seat;
    this.tempCurrentPlayer = undefined;
    this.clearAvailableCommands();
  }

  /**
   * "Premove" support (PREMOVE_PLAN.md §2): what `seat` could legally do right now if it were their
   * turn, without it actually being their turn. Returns `null` (premove not offered) when it already
   * is their turn (the real buttons apply - including a leech/income decision they owe this instant),
   * when they've already passed this round (nothing to premove into), or before round 1 / outside a
   * running round (setup/scoring/endgame/auction all have a differently-shaped "next turn" that isn't
   * well-defined to preview).
   *
   * The other phases a running round can rest in - `RoundLeech` while someone answers a charge offer,
   * `RoundIncome`/`RoundGaia` while someone makes a start-of-round choice - DO preview (2026-08-06).
   * They're exactly when an off-turn player wants to queue a premove and used to be offered nothing
   * at all, and the seat's own next turn is still an ordinary move-phase turn in the same round.
   * Income the seat hasn't collected yet is simply absent from the preview, which offers fewer
   * options rather than illegal ones; the resolver still refuses to fire outside a genuine
   * `Phase.RoundMove` turn and revalidates the move when that turn arrives.
   *
   * Never mutates `this` - operates on a disposable clone, exactly like every other preview/replay
   * path in this engine (`fromData(JSON.parse(JSON.stringify(...)))`).
   */
  previewAvailableCommandsFor(seat: PlayerEnum): AvailableCommand[] | null {
    if (
      this.round < Round.Round1 ||
      !premovePreviewablePhases.includes(this.phase) ||
      seat === this.playerToMove ||
      this.passedPlayers?.includes(seat)
    ) {
      return null;
    }

    const clone = Engine.fromData(JSON.parse(JSON.stringify(this)));
    clone.forcePremovePreviewTurn(seat);
    try {
      return clone.generateAvailableCommands();
    } catch {
      // Defensive: a preview is never worth breaking the game screen over. Every caller treats this
      // as "no premove offered", the same as an unsupported phase - and the getter that asks for it
      // renders the whole off-turn UI (the -1 placeholder seat already taught this lesson once).
      return null;
    }
  }

  addPlayer(player: Player) {
    this.players.push(player);

    player.data.on(`gain-${Resource.TechTile}`, (count, source) =>
      this.processNextMove(SubPhase.ChooseTechTile, null, source === BoardAction.Qic1 || source === Spaceship.Rebellion)
    );
    player.data.on(`gain-${Resource.InstantGaiaforming}`, () =>
      this.processNextMove(SubPhase.InstantGaiaforming, null, true)
    );
    player.data.on(`gain-${Resource.TemporaryStep}`, () => this.processNextMove(SubPhase.BuildMine, null, true));
    player.data.on(`gain-${Resource.TemporaryRange}`, (count: number) => {
      this.processNextMove(SubPhase.BuildMineOrGaiaFormer, null, true);
    });
    // Not `required`: Lost Fleet's Twilight Q.I.C. action and Federation-shaped Artifact can be
    // taken/claimed with no owned Federation token to rescore (owner ruling 2026-07-03,
    // RULES_CLARIFICATIONS.md open question #8) - with zero tokens owned, `possibleFederationTiles`
    // offers an empty choice list, and `required: false` lets that resolve as a silent no-op
    // instead of forcing a Command.DeadEnd undo. The base game's own rescore action (QIC2) never
    // reaches this with zero tokens (it's pre-filtered in available/actions.ts), so this is a no-op
    // there.
    player.data.on(`gain-${Resource.RescoreFederation}`, () =>
      this.processNextMove(SubPhase.RescoreFederationTile, null, false)
    );
    player.data.on(`gain-${Resource.GainArtifact}`, () =>
      this.processNextMove(SubPhase.ChooseArtifactToken, null, true)
    );
    player.data.on(`gain-${Resource.PowerRing}`, () => this.processNextMove(SubPhase.PlacePowerRing, null, true));
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
      } else if (destTile === lastTile(field) && this.players.some((pl) => pl.data.research[field] === destTile)) {
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
      Resource.GainTokenGaiaArea,
      Resource.BurnToken,
      Resource.Brainstone,
      Resource.MoveTokenFromGaiaAreaToArea1,
      Resource.MoveGaiaFormerFromGaiaAreaToArea1,
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

  /**
   * Execute a random legal move for the current player ("dumb AF" bot, used by
   * the platform to drive bot players).
   *
   * Returns `true` if a move was made, `false` if there is nothing to play (game
   * ended, no player to move) or if no move could be completed: a random move
   * can be a dead end (e.g. upgrading a mine with no ore left to rebuild), in
   * which case the engine is left unchanged.
   */
  moveAI(): boolean {
    if (this.ended || this.playerToMove === undefined) {
      return false;
    }

    // Simulate the whole turn on copies: a random move can be a dead end (e.g.
    // upgrading a mine with no ore left to rebuild), and an incomplete move
    // cannot be undone. A turn is built as a single dot-separated move - the
    // only way to execute several commands in one turn. The salt makes each
    // attempt draw different random choices.
    for (let attempt = 0; attempt < 20; attempt++) {
      const move = generateAIMove(this, this.playerToMove, attempt);

      if (!move) {
        return false;
      }

      let completed = false;

      // A command can trigger follow-up decisions for the same player (e.g.
      // choosing a tech tile after building a research lab): keep appending
      // random commands to the move until the turn is complete
      let fullMove = move;
      for (let safeguard = 0; safeguard < 20; safeguard++) {
        const copy = Engine.fromData(JSON.parse(JSON.stringify(this)));

        try {
          copy.move(fullMove);
        } catch {
          // Illegal or incomplete move
          break;
        }

        if (copy.newTurn || copy.ended) {
          completed = true;
          break;
        }

        const command = appendCommand(copy, copy.playerToMove, safeguard);
        if (!command) {
          break;
        }

        // Append to the simulated move; the next iteration re-checks it
        fullMove = `${fullMove}. ${command}`;
      }

      if (completed) {
        // The turn can be completed: replay it on the real engine
        this.move(fullMove);
        return true;
      }
    }

    return false;
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
      engine.map.lostFleet = engine.options.lostFleet;
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
          engine.version,
          data.players.length,
          engine.lostFleetEconomySide
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
    const phaseRegistry: {
      [key in Phase]: (engine: Engine, move: string) => void;
    } = {
      [Phase.BeginGame]: () => {
        throw new Error("beginGame cannot be executed");
      },
      [Phase.EndGame]: () => {
        throw new Error("endGame cannot be executed");
      },
      [Phase.RoundStart]: () => {
        throw new Error("roundStart cannot be executed");
      },
      [Phase.RoundFinish]: () => {
        throw new Error("roundFinish cannot be executed");
      },
      [Phase.SetupInit]: phaseSetupInit,
      [Phase.SetupBoard]: phaseSetupBoard,
      [Phase.SetupFactionBan]: phaseSetupFactionBan,
      [Phase.SetupFaction]: phaseSetupFaction,
      [Phase.SetupAuction]: phaseSetupAuction,
      [Phase.SetupSilentBid]: phaseSetupSilentBid,
      [Phase.SetupPreferenceBid]: phaseSetupPreferenceBid,
      [Phase.SetupBuilding]: phaseSetupBuilding,
      [Phase.SetupBooster]: phaseSetupBooster,
      [Phase.RoundIncome]: phaseRoundIncome,
      [Phase.RoundGaia]: phaseRoundGaia,
      [Phase.RoundMove]: phaseRoundMove,
      [Phase.RoundLeech]: phaseRoundLeech,
    };

    try {
      phaseRegistry[this.phase](this, move);
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
      [Command.BanFaction]: moveBanFaction,
      [Command.ChooseFaction]: moveChooseFaction,
      [Command.Bid]: moveBid,
      [Command.SilentBid]: moveSilentBid,
      [Command.PreferenceBid]: movePreferenceBid,
      [Command.Build]: moveBuild,
      [Command.PlaceLostPlanet]: moveLostPlanet,
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
      [Command.ChooseTinkeringTile]: moveChooseTinkeringTile,
      [Command.Explore]: moveExplore,
      [Command.SpaceshipAction]: moveSpaceshipAction,
      [Command.GaiaFormTransdim]: moveGaiaFormTransdim,
      [Command.PlacePowerRing]: movePlacePowerRing,
      [Command.Pass]: movePass,
      [Command.EndTurn]: moveEndTurn,
      [Command.ChooseIncome]: moveChooseIncome,
      [Command.ExamineArtifact]: moveExamineArtifact,
      [Command.ChooseArtifactToken]: moveChooseArtifactToken,
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

  get currentRoundScoringEvents(): Event[] | null {
    const tile = this.tiles.scorings.round[this.round - 1];
    return tile && roundScoringEvents(tile, this.round);
  }

  changePhase(phase: Phase) {
    this.phase = phase;
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

  private avCommand<C extends Command>(): AvailableCommand<C> {
    return this.availableCommand as AvailableCommand<C>;
  }
}
