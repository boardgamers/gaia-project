import { difference, range } from "lodash";
import Engine, { AuctionVariant } from "../engine";
import { Command, Faction, Player } from "../enums";
import { remainingFactions } from "../factions";
import { AvailableCommand, PossibleBid } from "./types";

/** Upper bound offered for a Silent Auction max-VP bid; a generous ceiling, not a real cap. */
export const MAX_SILENT_BID = 40;

export function chooseFactionOrBid(
  engine: Engine,
  player: Player
): AvailableCommand<Command.Bid | Command.ChooseFaction>[] {
  const chooseFaction: AvailableCommand<Command.Bid | Command.ChooseFaction> = {
    name: Command.ChooseFaction,
    player,
    data: choosableFactions(engine),
  };
  if (engine.options.auction === AuctionVariant.BidWhileChoosing) {
    return [...possibleBids(engine, player), chooseFaction];
  }
  return [chooseFaction];
}

export function choosableFactions(engine: Engine) {
  let factions: Faction[];
  if (engine.randomFactions) {
    if (engine.options.auction && engine.options.auction !== AuctionVariant.ChooseBid) {
      // In auction the player can pick from the pool of random factions
      factions = difference(engine.randomFactions, engine.setup);
    } else {
      // Otherwise, they are limited to one specific faction
      factions = engine.randomFactions.length > engine.setup.length ? [engine.randomFactions[engine.setup.length]] : [];
    }
  } else {
    // Standard
    factions = remainingFactions(engine.setup, engine.expansions);
  }
  return difference(factions, engine.bannedFactions);
}

/** Factions still eligible to be banned (Silent Auction's ban phase - one forced ban per player). */
export function banableFactions(engine: Engine): Faction[] {
  return difference(Faction.values(engine.expansions), engine.bannedFactions);
}

export function possibleFactionBans(engine: Engine, player: Player): AvailableCommand<Command.BanFaction>[] {
  return [{ name: Command.BanFaction, player, data: banableFactions(engine) }];
}

export function possibleSilentBids(engine: Engine, player: Player): AvailableCommand<Command.SilentBid>[] {
  const bids: PossibleBid[] = engine.setup.map((faction) => ({
    faction,
    bid: range(0, MAX_SILENT_BID + 1),
  }));

  return [{ name: Command.SilentBid, player, data: { bids } }];
}

/**
 * Preference Split Auction: the player has to split exactly `budget` whole points across every
 * faction up for auction, so each individual amount can be anything from 0 to the whole budget -
 * the constraint that actually matters is the sum, which `movePreferenceBid` enforces and the
 * viewer's form mirrors. `budget` and `factions` travel with the command so the UI never has to
 * re-derive them from engine options.
 */
export function possiblePreferenceBids(engine: Engine, player: Player): AvailableCommand<Command.PreferenceBid>[] {
  const budget = engine.preferenceSplitBudget;
  const bids: PossibleBid[] = engine.setup.map((faction) => ({
    faction,
    bid: range(0, budget + 1),
  }));

  return [{ name: Command.PreferenceBid, player, data: { budget, factions: [...engine.setup], bids } }];
}

export function possibleBids(engine: Engine, player: Player): AvailableCommand<Command.Bid>[] {
  const commands: AvailableCommand<Command.Bid>[] = [];
  const bids: PossibleBid[] = [];

  for (const faction of engine.setup) {
    const bid = engine.players.find((pl) => pl.faction === faction)
      ? engine.players.find((pl) => pl.faction === faction).data.bid
      : -1;
    bids.push({
      faction,
      bid: range(bid + 1, bid + 10),
    });
  }

  if (bids.length > 0) {
    commands.push({
      name: Command.Bid,
      player,
      data: { bids },
    });
  }

  return commands;
}
