import assert from "assert";
import { Faction, Player as PlayerEnum } from "../enums";

/**
 * "Preference Split Auction" - a simultaneous, secret, budget-limited faction auction resolved
 * entirely from the submitted numbers, with no bidding rounds and no player decisions after the
 * submission.
 *
 * Every player secretly splits ONE fixed budget of `budget` whole bid points across the four
 * factions up for auction (a bid of 0 is allowed, the four bids must add up to exactly the
 * budget). Once all four vectors are in, everything below follows mechanically:
 *
 * 1. Each faction's `total` is the sum of ALL FOUR original bids on it, and its `average` is that
 *    total divided by the number of players. Both are computed once, from the original bids, and
 *    are never recomputed as players drop out of the running.
 * 2. Factions are ranked by `total`, highest first. Factions on an equal total are ordered
 *    randomly (recorded in `tiedWith`).
 * 3. Working down that ranking, each faction goes to whichever still-unassigned player bid the
 *    most on it. Players on an equal highest bid are separated randomly (recorded in
 *    `tiedPlayers`). A player who wins a faction is out of the running for the rest.
 * 4. The winner pays the faction's `average`, rounded to a whole VP. **Always the average, whatever
 *    they bid themselves** - their own bid decides which faction they get, never what it costs.
 *
 * Deliberately NOT a first-price, second-price or ascending ("silent") auction: the price comes
 * from what the table as a whole thought the faction was worth, not from what anyone offered to
 * outbid, and nobody ever gets the chance to react to anybody else's numbers.
 *
 * Rule 4 deliberately has NO cap at the winner's own bid (owner decision, 2026-08-05). A cap sounds
 * fairer and is not: it lets a player take a faction the whole table rated highly for nothing at all
 * simply by having bid 0 on it. The owner's example - one player splitting their budget almost
 * evenly across two factions and another rating those same two almost evenly - ends with the second
 * player picking up a faction everybody valued at ~20 VP for free, purely because the first player's
 * marginally higher bid pulled them onto the other one. Paying the average keeps a faction's price
 * tied to what it is actually worth to the table. The accepted cost is that a winner can pay more
 * than they personally bid; in exchange the rule is one sentence long.
 *
 * The only randomness is the two tiebreaks. Pass a seeded `random` (the engine passes the game's
 * own seeded PRNG) and the whole resolution is reproducible from the submitted bids alone.
 */

/** The variant is defined for exactly this many players, each of whom nominates one faction. */
export const PREFERENCE_SPLIT_PLAYERS = 4;

/**
 * Default total bid budget per player. 40 points across four factions averages 10 per faction,
 * which - since every faction's price is an average of four bids - puts a typical winning price in
 * the 5-15 VP range: expensive enough to matter next to a ~120 VP game, cheap enough that no
 * single faction can eat a whole game's scoring. Configurable per game (EngineOptions.auctionBudget).
 */
export const DEFAULT_PREFERENCE_SPLIT_BUDGET = 40;

export const MIN_PREFERENCE_SPLIT_BUDGET = 1;
export const MAX_PREFERENCE_SPLIT_BUDGET = 999;

/** One player's bid on one faction, exactly as submitted. Never modified during resolution. */
export type PreferenceSplitBid = {
  player: PlayerEnum;
  faction: Faction;
  points: number;
};

export type PreferenceSplitFactionSummary = {
  faction: Faction;
  /** All four original bids on this faction, in seat order - including bids by players who end up
   * winning some other faction, which still count towards the total and the average. */
  bids: { player: PlayerEnum; points: number }[];
  total: number;
  /** `total / players` - exact (the divisor is a power of two), rounded only when paid. */
  average: number;
  /** 1-based position in the resolved ranking. */
  rank: number;
  /** Factions this one was tied with on `total`; their relative order was drawn at random. Empty
   * when the total was unique. */
  tiedWith: Faction[];
};

export type PreferenceSplitAllocation = {
  faction: Faction;
  rank: number;
  /** Players still without a faction when this one came up, in seat order. */
  eligible: PlayerEnum[];
  winner: PlayerEnum;
  /** The winner's own original bid on this faction - what won it for them, NOT what they pay. */
  winnerBid: number;
  /** The faction's average - the price, before VP rounding. Charged whatever `winnerBid` was. */
  basePrice: number;
  /** VP actually deducted from the winner's score: `basePrice` rounded. */
  payment: number;
  /** The eligible players who shared the highest bid; the winner among them was drawn at random.
   * Empty when the highest bid was unique. */
  tiedPlayers: PlayerEnum[];
};

export type PreferenceSplitResult = {
  budget: number;
  /** Seat order of the participating players, as resolved. */
  players: PlayerEnum[];
  /** The factions in resolved rank order, first to fourth. */
  order: Faction[];
  /** Per-faction totals/averages/ranks, in the same order as `order`. */
  factions: PreferenceSplitFactionSummary[];
  /** One entry per faction, in the order they were awarded (= `order`). */
  allocations: PreferenceSplitAllocation[];
};

/**
 * The project's VP rounding rule for auction payments, in one place: conventional half-up, so
 * 10.5 costs 11 VP and 10.49 costs 10. Applied once, at the very end - totals and averages stay
 * exact right up to the payment.
 */
export function roundVictoryPoints(value: number): number {
  return Math.floor(value + 0.5);
}

export function isValidPreferenceSplitBudget(budget: unknown): budget is number {
  return (
    typeof budget === "number" &&
    Number.isInteger(budget) &&
    budget >= MIN_PREFERENCE_SPLIT_BUDGET &&
    budget <= MAX_PREFERENCE_SPLIT_BUDGET
  );
}

/**
 * Validates one player's whole submission against the factions up for auction and the budget.
 * Returns a human-readable reason it is not submittable, or null when it is. Shared by the engine
 * move (which turns it into an assertion) and the viewer's bid form (which uses it to keep the
 * submit button disabled), so the two can never disagree about what counts as a legal split.
 */
export function preferenceSplitBidError(
  entries: { faction: string; points: number }[],
  factions: Faction[],
  budget: number
): string | null {
  if (!isValidPreferenceSplitBudget(budget)) {
    return `The bid budget must be a whole number between ${MIN_PREFERENCE_SPLIT_BUDGET} and ${MAX_PREFERENCE_SPLIT_BUDGET}`;
  }
  if (entries.length !== factions.length) {
    return `You have to bid on all ${factions.length} factions, no more and no less`;
  }
  if (new Set(entries.map((e) => e.faction)).size !== entries.length) {
    return "You can only bid once per faction";
  }
  for (const entry of entries) {
    if (!factions.includes(entry.faction as Faction)) {
      return `${entry.faction} is not up for auction`;
    }
    if (typeof entry.points !== "number" || !Number.isFinite(entry.points)) {
      return "Every bid has to be a number";
    }
    if (!Number.isInteger(entry.points)) {
      return "Bids have to be whole numbers";
    }
    if (entry.points < 0) {
      return "Bids cannot be negative";
    }
  }
  const total = entries.reduce((sum, e) => sum + e.points, 0);
  if (total !== budget) {
    return total < budget
      ? `You still have ${budget - total} of your ${budget} bid points left to spend`
      : `You have spent ${total - budget} more than your ${budget} bid points`;
  }
  return null;
}

/** Fisher-Yates over a copy, driven by the supplied (seeded) random source. */
function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = pick(i + 1, random);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** A uniform index in [0, count), guarded against a random source that can return exactly 1. */
function pick(count: number, random: () => number): number {
  return Math.min(count - 1, Math.max(0, Math.floor(random() * count)));
}

export function resolvePreferenceSplitAuction(
  factions: Faction[],
  players: PlayerEnum[],
  bids: PreferenceSplitBid[],
  budget: number,
  random: () => number = Math.random
): PreferenceSplitResult {
  assert(
    players.length === PREFERENCE_SPLIT_PLAYERS,
    `The Preference Split Auction needs exactly ${PREFERENCE_SPLIT_PLAYERS} players, got ${players.length}`
  );
  assert(
    factions.length === PREFERENCE_SPLIT_PLAYERS,
    `The Preference Split Auction needs exactly ${PREFERENCE_SPLIT_PLAYERS} factions, got ${factions.length}`
  );
  assert(new Set(factions).size === factions.length, "The factions up for auction have to be distinct");
  assert(isValidPreferenceSplitBudget(budget), `Invalid bid budget ${budget}`);

  const submitted = new Map<string, number>();
  for (const bid of bids) {
    const key = `${bid.player}/${bid.faction}`;
    assert(!submitted.has(key), `Duplicate bid by player ${bid.player} on ${bid.faction}`);
    submitted.set(key, bid.points);
  }
  const bidOf = (player: PlayerEnum, faction: Faction): number => {
    const points = submitted.get(`${player}/${faction}`);
    assert(points !== undefined, `Player ${player} did not bid on ${faction}`);
    return points;
  };

  // Re-check each vector here too, not only in the move handler: this function is the last place
  // that can still catch a submission that reached the engine some other way (a hand-edited move
  // log, a future auction mode reusing the resolver) before it silently skews every average.
  for (const player of players) {
    const error = preferenceSplitBidError(
      factions.map((faction) => ({ faction: faction as string, points: bidOf(player, faction) })),
      factions,
      budget
    );
    assert(error === null, `Player ${player}'s bids are not a legal split of ${budget}: ${error}`);
  }

  const summaries: PreferenceSplitFactionSummary[] = factions.map((faction) => {
    const factionBids = players.map((player) => ({ player, points: bidOf(player, faction) }));
    const total = factionBids.reduce((sum, b) => sum + b.points, 0);
    return {
      faction,
      bids: factionBids,
      total,
      average: total / players.length,
      rank: 0,
      tiedWith: [],
    };
  });

  // Ranking: highest total first. `sort` is stable, so factions sharing a total arrive here in
  // their `factions` order and the shuffle below is the ONLY thing that decides between them.
  const byTotal = [...summaries].sort((a, b) => b.total - a.total);
  const ordered: PreferenceSplitFactionSummary[] = [];
  for (let i = 0; i < byTotal.length; ) {
    let j = i;
    while (j < byTotal.length && byTotal[j].total === byTotal[i].total) {
      j++;
    }
    const group = byTotal.slice(i, j);
    if (group.length > 1) {
      const tied = group.map((s) => s.faction);
      for (const summary of group) {
        summary.tiedWith = tied.filter((faction) => faction !== summary.faction);
      }
      ordered.push(...shuffled(group, random));
    } else {
      ordered.push(...group);
    }
    i = j;
  }
  ordered.forEach((summary, index) => {
    summary.rank = index + 1;
  });

  const remaining = [...players];
  const allocations: PreferenceSplitAllocation[] = ordered.map((summary) => {
    const eligible = [...remaining];
    const highest = Math.max(...eligible.map((player) => bidOf(player, summary.faction)));
    const tiedPlayers = eligible.filter((player) => bidOf(player, summary.faction) === highest);
    const winner = tiedPlayers.length === 1 ? tiedPlayers[0] : tiedPlayers[pick(tiedPlayers.length, random)];
    remaining.splice(remaining.indexOf(winner), 1);

    return {
      faction: summary.faction,
      rank: summary.rank,
      eligible,
      winner,
      winnerBid: bidOf(winner, summary.faction),
      basePrice: summary.average,
      payment: roundVictoryPoints(summary.average),
      tiedPlayers: tiedPlayers.length > 1 ? tiedPlayers : [],
    };
  });

  assert(remaining.length === 0, "The auction left a player without a faction");
  assert(
    new Set(allocations.map((a) => a.winner)).size === players.length,
    "The auction gave a player more than one faction"
  );
  assert(
    new Set(allocations.map((a) => a.faction)).size === factions.length,
    "The auction awarded a faction more than once"
  );
  for (const allocation of allocations) {
    // The price is the faction's own average and nothing else - not the winner's bid, not a bid
    // from anyone still in the running. This is the invariant the cap used to hide.
    assert(
      allocation.payment === roundVictoryPoints(allocation.basePrice),
      `${allocation.faction} was not priced at its average`
    );
  }

  return {
    budget,
    players: [...players],
    order: ordered.map((summary) => summary.faction),
    factions: ordered,
    allocations,
  };
}
