import assert from "assert";
import { uniq } from "lodash";
import { AvailableCommand } from "../available/types";
import Engine, { AuctionVariant } from "../engine";
import { BoardAction, Command, Faction, Player as PlayerEnum } from "../enums";
import { remainingFactions } from "../factions";
import SpaceMap from "../map";
import Player from "../player";
import { applyRandomBoardSetup, applySetupOption, SetupOption, SetupPosition, SetupType } from "../setup";

export function moveInit(engine: Engine, players: number, seed: string) {
  assert(players >= 2 && players <= 5, "Invalid number of players");

  engine.map = new SpaceMap(players, seed, engine.options.map?.mirror ?? false, engine.options.layout);

  if (engine.options.map?.sectors) {
    engine.map.load(engine.options.map);
  }
  engine.options.map = engine.map.placement;

  applyRandomBoardSetup(engine, seed, players);

  // powerActions
  BoardAction.values(engine.expansions).forEach((pos: BoardAction) => {
    engine.boardActions[pos] = null;
  });

  engine.players = [];
  engine.setup = [];

  for (let i = 0; i < players; i++) {
    engine.addPlayer(new Player(this.expansions, i));
  }

  if (engine.options.randomFactions) {
    const randomFactions = [];

    for (const _ of engine.players) {
      const possible = remainingFactions(randomFactions);

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
