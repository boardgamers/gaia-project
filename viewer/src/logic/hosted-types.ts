import type { SealedBidVariant } from "./sealed-bid";

export type SealedBidEntry = { faction: string; points: number };
export type SealedBidStatus = {
  playerCount: number;
  /** Which auction is being bid on, so a panel can tell it is looking at its own game's status. */
  variant: SealedBidVariant | null;
  /** Preference Split only - the exact total every submission has to add up to. Null for silent. */
  budget: number | null;
  /** Silent Auction only - the ceiling on any single bid. Null for preference-split. */
  maxBid: number | null;
  /** Which seats have submitted. Progress only - never carries anybody's points. */
  submittedSeats: number[];
};

// The data layer a hosted game backend needs to provide.
