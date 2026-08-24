import Engine, { Command, Phase } from "@gaia-project/engine";

/**
 * The two faction-selection variants whose bid round is **simultaneous**: every player submits one
 * secret valuation of every faction up for auction, and nothing is derived - or readable by anyone
 * else - until the last submission lands.
 *
 * In hosted play neither of them can use the ordinary move log while the round is open, because
 * every seated player can read `public.moves`. Both therefore collect submissions in
 * `auction_sealed_bids` instead and turn them into one ordinary move per seat, in seat order, in a
 * single transaction (`reveal_sealed_bids`). This module is the one place the client decides
 * whether a given engine state is in such a round, and what its moves are called - so the host,
 * the bid panels and the setup strip can never disagree about it.
 */
export type SealedBidVariant = "preference-split" | "silent";

export type SealedBidPhaseInfo = {
  variant: SealedBidVariant;
  phase: Phase;
  /** The engine command one submission becomes. Must match `sealed_bid_command()` in SQL. */
  command: Command;
};

const preferenceSplit: SealedBidPhaseInfo = {
  variant: "preference-split",
  phase: Phase.SetupPreferenceBid,
  command: Command.PreferenceBid,
};

const silent: SealedBidPhaseInfo = {
  variant: "silent",
  phase: Phase.SetupSilentBid,
  command: Command.SilentBid,
};

/** The simultaneous bid round this engine is sitting in, or null if it isn't in one. */
export function sealedBidPhase(engine: Engine | null | undefined): SealedBidPhaseInfo | null {
  switch (engine?.phase) {
    case Phase.SetupPreferenceBid:
      return preferenceSplit;
    case Phase.SetupSilentBid:
      return silent;
    default:
      return null;
  }
}

/**
 * True for the one hosted state that must NOT use the sealed table: a Silent Auction that already
 * recorded some of its bids as ordinary committed moves.
 *
 * The Silent Auction collected its bids sequentially until migration 20260812130000, and the
 * hosted app replays a game's ENTIRE stored move history through current code with no version
 * gate. A game caught mid-round by the change therefore has to finish the way it started: the
 * seats that already bid are in the move log, and asking them again through the sealed table would
 * record them twice. `silentAuctionBids` being non-empty is exactly that state, because a hosted
 * sealed round leaves the engine's own list empty right up until the reveal appends all of it at
 * once. (`submit_sealed_bid` refuses the same games server-side; this is what keeps the client
 * from offering it in the first place, and what keeps `Commands.vue`'s old turn-by-turn form
 * available for them.)
 *
 * Deliberately NOT true of offline/hot-seat play, where the same engine state is simply the normal
 * course of a round - there is no server there, so every submission is a move by design and the
 * device is passed around. Callers pair this with "is there a sealed backend".
 */
export function isLegacySequentialBidRound(engine: Engine | null | undefined): boolean {
  return engine?.phase === Phase.SetupSilentBid && (engine.silentAuctionBids?.length ?? 0) > 0;
}

/**
 * The move line one sealed submission becomes at reveal time. Must stay byte-identical to what
 * `reveal_sealed_bids` builds server-side (migrations 20260805120000 / 20260812130000): the server
 * writes the authoritative text, and this only reproduces it locally to work out which seat the
 * game lands on once the auction has resolved.
 */
export function sealedBidMove(seat: number, bids: { faction: string; points: number }[], command: Command): string {
  return `p${seat + 1} ${command} ${bids.map((b) => `${b.faction} ${b.points}`).join(" ")}`;
}
