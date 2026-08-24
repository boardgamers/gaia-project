import assert from "../utils/assert";
import { Faction, Player as PlayerEnum } from "../enums";

/** Upper bound offered for a Silent Auction max-VP bid; a generous ceiling, not a real cap. */
export const MAX_SILENT_BID = 40;

export type SilentAuctionBid = {
  player: PlayerEnum;
  faction: Faction;
  max: number;
};

/**
 * The one rule set a Silent Auction submission has to satisfy, shared by everything that checks
 * one: the engine's own `moveSilentBid` (so a hand-edited move log can't smuggle in an illegal
 * bid), the bid form's submit button, and - mirrored in SQL - `submit_sealed_bid`, which is what
 * actually guards a hosted submission since the bids never pass through the engine until the
 * reveal.
 *
 * Unlike the Preference Split's split there is no budget: each faction is bid on independently,
 * anywhere from 0 to `MAX_SILENT_BID`. What must hold is that every faction up for auction is bid
 * on exactly once, so the auction has a complete valuation from every player.
 *
 * Returns a human-readable reason, or null when the submission is legal.
 */
export function silentAuctionBidError(
  entries: readonly { faction: string; points: number }[],
  factions: readonly Faction[],
  maxBid: number = MAX_SILENT_BID
): string | null {
  if (entries.length !== factions.length) {
    return `You have to bid on all ${factions.length} factions up for auction`;
  }
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!factions.includes(entry.faction as Faction)) {
      return `${entry.faction} is not up for auction`;
    }
    if (seen.has(entry.faction)) {
      return `You can only bid once on ${entry.faction}`;
    }
    seen.add(entry.faction);
    if (!Number.isInteger(entry.points) || entry.points < 0) {
      return `Every bid has to be a whole, non-negative number of victory points`;
    }
    if (entry.points > maxBid) {
      return `A bid cannot be higher than ${maxBid} victory points`;
    }
  }
  return null;
}

export type SilentAuctionStep = {
  player: PlayerEnum;
  faction: Faction;
  price: number;
  /** true when the player already led `faction` (their best-value option) and made no bid */
  skipped: boolean;
  tiebreak?: "existing" | "nominated" | "random";
};

export type SilentAuctionResult = {
  /** faction -> winning player */
  winners: Map<Faction, PlayerEnum>;
  /** faction -> final price (VP paid by the winner) */
  prices: Map<Faction, number>;
  /** full step-by-step trace, for display/statistics */
  log: SilentAuctionStep[];
};

/**
 * Runs the community "Faction Auction" ascending-bid algorithm
 * (https://steamcommunity.com/sharedfiles/filedetails/?id=2506595080).
 *
 * Every player privately submitted a max VP bid for each faction in `factions`. Starting from
 * price 0 on every faction, players take turns (round-robin over `seatOrder`, repeating): on your
 * turn, if you already lead the faction that gives you the most value (max bid minus price), you
 * are skipped; otherwise you bid on whichever faction currently gives you the most value, raising
 * its price to (current price + 1), or to 0 if it's unclaimed, and become its new leader (bumping
 * off whoever led it before). Ties in value are broken by, in order: preferring to raise an
 * existing bid over claiming an untouched faction, preferring the faction the player originally
 * picked in the nomination/pick phase, then uniformly at random. The auction ends once a full
 * round passes with every player skipped.
 */
export function resolveSilentAuction(
  factions: Faction[],
  seatOrder: PlayerEnum[],
  bids: SilentAuctionBid[],
  nominatedFaction: Map<PlayerEnum, Faction>,
  random: () => number = Math.random
): SilentAuctionResult {
  const maxBid = (player: PlayerEnum, faction: Faction) =>
    bids.find((b) => b.player === player && b.faction === faction)?.max ?? 0;

  const price = new Map<Faction, number>(factions.map((f) => [f, 0]));
  const leader = new Map<Faction, PlayerEnum | undefined>(factions.map((f) => [f, undefined]));
  const log: SilentAuctionStep[] = [];

  const costFor = (player: PlayerEnum, faction: Faction) => {
    const lead = leader.get(faction);
    if (lead === player) {
      return price.get(faction);
    }
    return lead === undefined ? 0 : price.get(faction) + 1;
  };
  const valueFor = (player: PlayerEnum, faction: Faction) => maxBid(player, faction) - costFor(player, faction);

  let consecutiveSkips = 0;
  let turn = 0;
  // Prices strictly increase on every non-skip turn and are bounded by the max bids, so this
  // always terminates well before the cap; the cap only guards against a logic bug looping forever.
  const maxIterations = seatOrder.length * (Math.max(...bids.map((b) => b.max), 0) + 1) * factions.length + 1000;

  for (let i = 0; i < maxIterations && consecutiveSkips < seatOrder.length; i++) {
    const player = seatOrder[turn % seatOrder.length];
    turn++;

    const leadingFaction = factions.find((f) => leader.get(f) === player);
    const bestValue = Math.max(...factions.map((f) => valueFor(player, f)));

    if (leadingFaction !== undefined && valueFor(player, leadingFaction) === bestValue) {
      log.push({ player, faction: leadingFaction, price: price.get(leadingFaction), skipped: true });
      consecutiveSkips++;
      continue;
    }

    let candidates = factions.filter((f) => valueFor(player, f) === bestValue);
    let tiebreak: SilentAuctionStep["tiebreak"];

    if (candidates.length > 1) {
      const existing = candidates.filter((f) => leader.get(f) !== undefined);
      if (existing.length > 0 && existing.length < candidates.length) {
        candidates = existing;
        tiebreak = "existing";
      }
    }
    if (candidates.length > 1) {
      const nominated = nominatedFaction.get(player);
      if (nominated && candidates.includes(nominated)) {
        candidates = [nominated];
        tiebreak = "nominated";
      }
    }
    if (candidates.length > 1) {
      candidates = [candidates[Math.floor(random() * candidates.length)]];
      tiebreak = "random";
    }

    const best = candidates[0];
    const newPrice = costFor(player, best);
    price.set(best, newPrice);
    leader.set(best, player);
    consecutiveSkips = 0;
    log.push({ player, faction: best, price: newPrice, skipped: false, tiebreak });
  }

  for (const faction of factions) {
    assert(leader.get(faction) !== undefined, `Silent auction did not converge for ${faction}`);
  }

  return { winners: new Map(factions.map((f) => [f, leader.get(f)])), prices: price, log };
}
