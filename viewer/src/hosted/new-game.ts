import Engine, { AuctionVariant } from "@gaia-project/engine";

export type NewGameForm = {
  playerCount: number;
  seats: { userId?: string | null; name?: string }[];
  auctionVariant: AuctionVariantOption;
  banPhase?: boolean;
  officialCenterSectors?: boolean;
  openLobby: boolean;
};

/**
 * Faction-selection variants offered at game creation. "none" is the standard sequential pick
 * (no bidding at all). Add future variants here and to `AUCTION_VARIANT_OPTIONS` below - the
 * dropdown in CreateGame.vue is driven entirely off that list.
 */
export type AuctionVariantOption = "none" | "silent" | "choose-bid" | "bid-while-choosing";

export const AUCTION_VARIANT_OPTIONS: {
  value: AuctionVariantOption;
  label: string;
  summary: string;
  description: string;
}[] = [
  {
    value: "none",
    label: "Standard",
    summary: "Take turns choosing factions.",
    description: "Each player picks a faction in turn order. No bidding.",
  },
  {
    value: "silent",
    label: "Silent Auction",
    summary: "Pick, then submit private VP bids.",
    description:
      "Every player picks one faction, then privately submits a maximum VP bid for each picked faction. An " +
      "ascending-auction algorithm assigns each player the faction that maximizes their own value.",
  },
  {
    value: "choose-bid",
    label: "Choose, Then Bid",
    summary: "Everyone picks a faction, then bids for a different one.",
    description:
      "Each player picks a faction in turn order first. Once every faction is taken, players bid VP in turn " +
      "order to swap into a different picked faction, passing when they no longer want to bid.",
  },
  {
    value: "bid-while-choosing",
    label: "Bid While Choosing",
    summary: "Bid for factions as they're picked, one at a time.",
    description:
      "Players bid VP on each faction in turn order as it comes up for selection, one faction at a time, until " +
      "every faction is assigned.",
  },
];

function engineAuctionOption(variant: AuctionVariantOption): AuctionVariant | undefined {
  switch (variant) {
    case "silent":
      return AuctionVariant.Silent;
    case "choose-bid":
      return AuctionVariant.ChooseBid;
    case "bid-while-choosing":
      return AuctionVariant.BidWhileChoosing;
    case "none":
    default:
      return undefined;
  }
}

/**
 * Fisher-Yates shuffle of a seats array, returning a new array (input untouched). Used for
 * direct-invite games, where every seat is known at creation time and would otherwise always
 * seat the creator first (see 0025_randomize_seats_on_lobby_fill.sql, which already randomizes
 * open-lobby seats once the table fills - direct invite needs the same treatment since it never
 * goes through that join flow).
 */
export function shuffleSeats<T>(seats: T[]): T[] {
  const shuffled = [...seats];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function randomSeed(): string {
  return `lf-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

const GAME_NAME_ADJECTIVES = [
  "Amber",
  "Cinder",
  "Copper",
  "Ivory",
  "Lunar",
  "North",
  "Quiet",
  "Solar",
  "Swift",
  "Verdant",
];

const GAME_NAME_NOUNS = ["Atlas", "Beacon", "Comet", "Drift", "Echo", "Harbor", "Nova", "Orbit", "Signal", "Spire"];

export function randomGameName(): string {
  const adjective = GAME_NAME_ADJECTIVES[Math.floor(Math.random() * GAME_NAME_ADJECTIVES.length)];
  const noun = GAME_NAME_NOUNS[Math.floor(Math.random() * GAME_NAME_NOUNS.length)];
  return `${adjective} ${noun}`;
}

/**
 * Builds the create_game RPC arguments. Seed and rotation are both fixed at
 * creation, once, forever (§J3 + the sector-rotation extension of it) — both
 * come from SetupPreview.vue's already-validated lock-in, not minted here.
 * `advancedRules: true` is required so replay re-enters Phase.SetupBoard and
 * expects the rotate move as the game's very first committed turn (seq=1,
 * inserted by create_game via p_setup_move); a probe engine (with that move
 * applied) tells us which seat opens SetupFaction next.
 *
 * The probe gets a CLONE of the options: Engine mutates the object it's
 * given (it writes the generated map layout back into options.map, plus
 * factionVariantVersion), and persisting that mutated object breaks replay —
 * moveInit rejects map.sectors combined with lostFleet. The stored options
 * must stay exactly what the user chose.
 */
export function buildCreateGameParams(form: NewGameForm, seed: string, rotateMove: string) {
  const auction = engineAuctionOption(form.auctionVariant);
  const options = {
    lostFleet: true,
    advancedRules: true,
    factionVariant: "standard",
    ...(auction ? { auction } : {}),
    // Always explicit (not conditionally omitted) so the checkbox has full control even for Silent
    // Auction - the engine's `banPhase ?? auction === Silent` fallback is only meant to preserve
    // *pre-existing* stored games that predate this option, never to override a fresh choice here.
    banPhase: !!form.banPhase,
    ...(form.officialCenterSectors ? { officialCenterSectors: true } : {}),
  };
  const probe = new Engine([`init ${form.playerCount} ${seed}`, rotateMove], JSON.parse(JSON.stringify(options)));
  probe.generateAvailableCommandsIfNeeded();
  return {
    p_name: randomGameName(),
    p_seed: seed,
    p_player_count: form.playerCount,
    p_options: options,
    p_invites: form.seats.map((s, i) => ({
      user_id: s.userId ?? null,
      seat: i,
      display_name: s.name ?? "",
    })),
    p_current_seat: probe.playerToMove,
    p_setup_move: rotateMove,
    p_open_lobby: form.openLobby,
  };
}
