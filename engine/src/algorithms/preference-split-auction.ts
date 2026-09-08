import { Faction, Player as PlayerEnum } from "../enums";
import assert from "../utils/assert";

/**
 * "Preference Split Auction" - a simultaneous, secret, budget-limited faction auction resolved
 * entirely from the submitted numbers, with no bidding rounds and no player decisions after the
 * submission.
 *
 * Every player secretly splits ONE fixed budget of `budget` whole bid points across the factions up
 * for auction - one per player, nominated in the pick round (a bid of 0 is allowed, the bids must
 * add up to exactly the budget). Once every vector is in, everything below follows mechanically:
 *
 * 1. Each faction's `total` is the sum of EVERY original bid on it, and its `average` is that
 *    total divided by the number of players. Both are computed once, from the original bids, and
 *    are never recomputed as players drop out of the running.
 * 2. Factions are ranked by `total`, highest first. Factions on an equal total are ordered by
 *    nomination order, LATEST first (recorded in `tiedWith`).
 * 3. Working down that ranking, each faction goes to whichever still-unassigned player bid the
 *    most on it. Players on an equal highest bid are separated by NOMINATION ORDER - the player who
 *    nominated LATEST wins (recorded in `tiedPlayers`). A player who wins a faction is out of the
 *    running for the rest.
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
 * Both tiebreaks are DETERMINISTIC (owner decision, 2026-09): on a tie, the LATER nominator wins -
 * the last faction-picker picks a booster first (setup booster order is reverse nomination order)
 * and the owner ruled they win auction ties. No PRNG - the resolution is reproducible from the
 * submitted bids alone, with nothing to persist or reseed across a server round-trip (the old
 * seeded-`random` tiebreak is what crashed hosted simultaneous bidding on a reloaded engine).
 */

/** Fewest players the variant makes sense for. Nothing above this is count-specific: the auction
 * runs at whatever player count the game itself supports (moveInit caps that at 2-5), with one
 * nominated faction per player. Note that at exactly 2 players the ranking step cannot change the
 * outcome - whoever bid more on one of the two factions necessarily bid less on the other, so each
 * player simply gets the one they rated relatively higher. It still prices correctly; it is just a
 * much simpler game than at 3 or more. */
export const MIN_PREFERENCE_SPLIT_PLAYERS = 2;

/**
 * The default budget scales with the player count, because the budget is the TABLE's total bill,
 * not one player's. Every faction costs its own average (total over N players) and there are N
 * factions, so the payments always sum to exactly the budget before rounding - meaning each player
 * pays budget/N on average, whoever wins what. At 20 points per player that is ~20 VP each at any
 * count: 40 at 2 players, 60 at 3, 80 at 4. Expensive enough to matter next to a ~120 VP game,
 * cheap enough that no single faction can eat a whole game's scoring. A flat default would instead
 * have made a 2-player auction twice as punishing as a 4-player one.
 *
 * Raised from 10 to 20 per player on 2026-08-06 (owner decision) so a split has more resolution to
 * express preferences with. `auctionBudget` is stored per game at creation, so this only affects
 * games created from here on - an in-progress game keeps whatever it was created with.
 */
export const PREFERENCE_SPLIT_BUDGET_PER_PLAYER = 20;

export function defaultPreferenceSplitBudget(players: number): number {
  return PREFERENCE_SPLIT_BUDGET_PER_PLAYER * players;
}

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
  /** Every original bid on this faction, in seat order - including bids by players who end up
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
  /** The factions in resolved rank order, most-wanted first. */
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

export function resolvePreferenceSplitAuction(
  factions: Faction[],
  players: PlayerEnum[],
  bids: PreferenceSplitBid[],
  budget: number,
  nominatedFaction: Map<PlayerEnum, Faction>
): PreferenceSplitResult {
  assert(
    players.length >= MIN_PREFERENCE_SPLIT_PLAYERS,
    `The Preference Split Auction needs at least ${MIN_PREFERENCE_SPLIT_PLAYERS} players, got ${players.length}`
  );
  assert(
    factions.length === players.length,
    `The Preference Split Auction needs one faction per player - got ${factions.length} factions for ${players.length} players`
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

  // Ranking: highest total first. `sort` is stable, so factions sharing a total keep their
  // `factions` (nomination) order. Deterministic tiebreak (no PRNG): the LATER-nominated faction
  // ranks higher - the last faction-picker picks a booster first (booster order is reverse
  // nomination order) and, per the owner's ruling, wins auction ties. So within a tied group,
  // reverse the nomination order so the latest nominee resolves first.
  const byTotal = [...summaries].sort(
    (a, b) => b.total - a.total || factions.indexOf(b.faction) - factions.indexOf(a.faction)
  );
  const ordered: PreferenceSplitFactionSummary[] = [];
  for (let i = 0; i < byTotal.length;) {
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
    }
    ordered.push(...group); // already in deterministic setup order
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
    // Deterministic tiebreak, no PRNG (reproducible from the bids alone): the player who nominated
    // their faction LATEST in setup order wins. The last faction-picker picks a booster first
    // (booster order is reverse nomination order) and, per the owner's ruling, wins auction ties.
    // A player's nomination position is the index in `factions` of the faction they nominated.
    const nominationPos = (player: PlayerEnum) => factions.indexOf(nominatedFaction.get(player));
    const winner = tiedPlayers.reduce((a, b) => (nominationPos(a) >= nominationPos(b) ? a : b));
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
