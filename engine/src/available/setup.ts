import { difference, range } from "lodash";
import Engine, { AuctionVariant } from "../engine";
import { Command, Player } from "../enums";
import { remainingFactions } from "../factions";
import { AvailableCommand, PossibleBid } from "./types";

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
  if (engine.randomFactions) {
    if (engine.options.auction && engine.options.auction !== AuctionVariant.ChooseBid) {
      // In auction the player can pick from the pool of random factions
      return difference(engine.randomFactions, engine.setup);
    } else {
      // Otherwise, they are limited to one specific faction
      return engine.randomFactions.length > engine.setup.length ? [engine.randomFactions[engine.setup.length]] : [];
    }
  } else {
    // Standard
    return remainingFactions(engine.setup);
  }
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
