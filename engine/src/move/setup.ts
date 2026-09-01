import { uniq } from "lodash";
import {
  defaultPreferenceSplitBudget,
  isValidPreferenceSplitBudget,
  MAX_PREFERENCE_SPLIT_BUDGET,
  MIN_PREFERENCE_SPLIT_BUDGET,
  preferenceSplitBidError,
} from "../algorithms/preference-split-auction";
import { silentAuctionBidError } from "../algorithms/silent-auction";
import { AvailableCommand } from "../available/types";
import Engine, { AuctionVariant } from "../engine";
import { BoardAction, Command, Faction, Player as PlayerEnum } from "../enums";
import { lostFleetTerraformingBoard, remainingFactions } from "../factions";
import SpaceMap from "../map";
import Player from "../player";
import { applyRandomBoardSetup, applySetupOption, SetupOption, SetupPosition, SetupType } from "../setup";
import assert from "../utils/assert";

export function moveInit(engine: Engine, players: number, seed: string) {
  assert(players >= 2 && players <= 5, "Invalid number of players");
  assert(
    !(engine.options.lostFleet && engine.options.map?.sectors),
    "A custom map configuration cannot be combined with the Lost Fleet expansion"
  );
  assert(
    !(engine.options.lostFleet && engine.options.customBoardSetup),
    "Custom (drafted) board setup is not supported with the Lost Fleet expansion"
  );
  if (engine.options.auction === AuctionVariant.PreferenceSplit) {
    // Checked at the earliest possible moment (a game that reached its bid phase before anyone
    // noticed would have no legal way forward). The faction count needs no check of its own: the
    // pick round gives exactly one distinct faction per player, which
    // `resolvePreferenceSplitAuction` re-asserts before it resolves anything.
    //
    // `engine.preferenceSplitBudget` cannot be used here - it derives its default from
    // `engine.players`, which this function has not populated yet - so the default is resolved
    // from the `players` argument instead.
    const budget = engine.options.auctionBudget ?? defaultPreferenceSplitBudget(players);
    assert(
      isValidPreferenceSplitBudget(budget),
      `The Preference Split Auction's bid budget must be a whole number between ${MIN_PREFERENCE_SPLIT_BUDGET} and ${MAX_PREFERENCE_SPLIT_BUDGET}, got ${engine.options.auctionBudget}`
    );
    assert(
      !engine.options.randomFactions,
      "The Preference Split Auction cannot be combined with forced random factions"
    );
  }

  engine.map = new SpaceMap(
    players,
    seed,
    engine.options.map?.mirror ?? false,
    engine.options.layout,
    engine.options.lostFleet,
    engine.options.officialCenterSectors
  );

  if (engine.options.map?.sectors) {
    engine.map.load(engine.options.map);
  }
  engine.options.map = engine.map.placement;

  applyRandomBoardSetup(engine, seed, players);

  if (engine.options.lostFleet) {
    // §B5 (rulebook p.8): the Moweyds/Tinkeroids Terraforming board's randomized 7-color row is
    // placed once at setup. Compute it here (the only code path guaranteed to still have the real
    // seed) and persist it on the engine — `SpaceMap.toJSON()` drops the seed, so recomputing the
    // row later from `map.seed` is nondeterministic across fromData round trips (§J3; finding LF-1).
    engine.lostFleetTerraformingRow = lostFleetTerraformingBoard(seed);
  }

  // powerActions
  BoardAction.values(engine.expansions).forEach((pos: BoardAction) => {
    engine.boardActions[pos] = null;
  });

  engine.players = [];
  engine.setup = [];

  for (let i = 0; i < players; i++) {
    engine.addPlayer(new Player(engine.expansions, i));
  }

  if (engine.options.randomFactions) {
    const randomFactions = [];

    for (const _ of engine.players) {
      const possible = remainingFactions(randomFactions, engine.expansions);

      randomFactions.push(possible[Math.floor(possible.length * engine.map.rng())]);
    }
    engine.randomFactions = randomFactions;
  }
}

export function moveSetup(
  engine: Engine,
  command: AvailableCommand<Command.Setup>,
  player: PlayerEnum,
  type: SetupType,
  position: SetupPosition,
  _to: "to",
  option: SetupOption
) {
  applySetupOption(engine, type, position, option);
}

export function moveRotateSectors(
  engine: Engine,
  command: AvailableCommand<Command.RotateSectors>,
  player: PlayerEnum,
  ...params: string[]
) {
  assert(params.length % 2 === 0, "The rotate command needs an even number of parameters");

  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < params.length; i += 2) {
    pairs.push([params[i], params[i + 1]]);
  }

  assert(uniq(pairs.map((pair) => pair[0])).length === params.length / 2, "Duplicate rotations are not allowed");

  for (const pair of pairs) {
    engine.map.rotateSector(pair[0], +pair[1]);
  }
  engine.map.recalibrate();
  assert(engine.map.isValid(), "Map is invalid with two planets for the same type being near each other");
}

export function moveChooseFaction(
  engine: Engine,
  command: AvailableCommand<Command.ChooseFaction>,
  player: PlayerEnum,
  faction: Faction
) {
  assert(command.data.includes(faction), `${faction} is not in the available factions`);
  engine.setup.push(faction as Faction);
  if (engine.options.auction !== AuctionVariant.ChooseBid) {
    executeBid(engine, player, faction, 0);
  }
}

export function moveBid(
  engine: Engine,
  command: AvailableCommand<Command.Bid>,
  player: PlayerEnum,
  faction: string,
  bid: number
) {
  if (!engine.replay) {
    const bidsAC = command.data.bids;
    const bidAC = bidsAC.find((b) => b.faction === faction);
    assert(bidAC, `${faction} is not in the available factions`);
    assert(bidAC.bid.includes(+bid), "You have to bid the right amount");
  }
  executeBid(engine, player, faction, bid);
}

function executeBid(engine: Engine, player: PlayerEnum, faction: string, bid: number) {
  const previous = engine.players.find((s) => s.faction === faction);
  // remove faction from previous owner
  if (previous) {
    previous.faction = undefined;
  }

  engine.players[player].faction = faction as Faction;
  engine.players[player].data.bid = +bid;
}

export function moveBanFaction(
  engine: Engine,
  command: AvailableCommand<Command.BanFaction>,
  player: PlayerEnum,
  faction: Faction
) {
  assert(command.data.includes(faction), `${faction} is not available to ban`);
  engine.bannedFactions.push(faction);
}

/**
 * A Silent Auction bid submission: one player privately entering their entire max-VP-bid vector
 * (one amount per faction up for auction) in a single move, e.g.
 * "p1 silentBid itars 15 taklons 10 xenos 0".
 *
 * Validated through the shared `silentAuctionBidError` rather than only against `command.data`,
 * for the same reason `movePreferenceBid` is: in hosted play these moves are appended by the
 * server (from `auction_sealed_bids`) rather than composed by a client on turn, and the
 * available-command check is skipped on replay - so this is the one check a hand-edited or
 * server-built move log still has to pass.
 */
export function moveSilentBid(
  engine: Engine,
  command: AvailableCommand<Command.SilentBid>,
  player: PlayerEnum,
  ...params: string[]
) {
  assert(params.length % 2 === 0, "The silentBid command needs an even number of parameters");

  const entries: { faction: string; points: number }[] = [];
  for (let i = 0; i < params.length; i += 2) {
    assert(/^\d+$/.test(params[i + 1]), `"${params[i + 1]}" is not a whole, non-negative bid`);
    entries.push({ faction: params[i], points: +params[i + 1] });
  }

  assert(
    uniq(entries.map((entry) => entry.faction)).length === entries.length,
    "Duplicate factions are not allowed in a silent bid"
  );
  assert(
    !engine.silentAuctionBids.some((bid) => bid.player === player),
    `Player ${player} has already submitted their bids`
  );

  const error = silentAuctionBidError(entries, engine.setup);
  assert(error === null, error);

  for (const entry of entries) {
    engine.silentAuctionBids.push({ player, faction: entry.faction as Faction, max: entry.points });
  }
}

/**
 * A Preference Split Auction submission: one player's entire budget split, entered secretly and
 * recorded in a single move, e.g. "p1 preferenceBid itars 20 taklons 12 xenos 6 gleens 2".
 *
 * Validated here rather than only against `command.data` because these numbers decide both who
 * gets which faction and what everybody pays: the four amounts must be whole, non-negative, cover
 * every faction up for auction exactly once, and add up to exactly the game's budget. The same
 * check runs on replay (unlike the available-command check, which `engine.replay` skips) via
 * `preferenceSplitBidError`, so a hand-edited move log cannot smuggle in an illegal split.
 */
export function movePreferenceBid(
  engine: Engine,
  command: AvailableCommand<Command.PreferenceBid>,
  player: PlayerEnum,
  ...params: string[]
) {
  assert(params.length % 2 === 0, "The preferenceBid command needs an even number of parameters");

  const entries: { faction: string; points: number }[] = [];
  for (let i = 0; i < params.length; i += 2) {
    assert(/^\d+$/.test(params[i + 1]), `"${params[i + 1]}" is not a whole, non-negative number of bid points`);
    entries.push({ faction: params[i], points: +params[i + 1] });
  }

  assert(
    !engine.preferenceSplitBids.some((bid) => bid.player === player),
    `Player ${player} has already submitted their bids`
  );

  const error = preferenceSplitBidError(entries, engine.setup, engine.preferenceSplitBudget);
  assert(error === null, error);

  for (const entry of entries) {
    engine.preferenceSplitBids.push({ player, faction: entry.faction as Faction, points: entry.points });
  }
}
