import Engine, { AuctionVariant } from "@gaia-project/engine";

export type NewGameForm = {
  playerCount: number;
  seats: { userId: string; name: string }[];
  auctionVariant: AuctionVariantOption;
};

/**
 * Faction-selection variants offered at game creation. "none" is the standard sequential pick
 * (no bidding at all). Add future variants here and to `AUCTION_VARIANT_OPTIONS` below - the
 * dropdown in CreateGame.vue is driven entirely off that list.
 */
export type AuctionVariantOption = "none" | "silent";

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
    description: "Each player picks a faction in turn order, no bidding.",
  },
  {
    value: "silent",
    label: "Silent Auction",
    summary: "Ban, pick, then submit private VP bids.",
    description:
      "Everyone bans one faction (in turn order), then picks one faction each, then every player privately " +
      "submits a max-VP bid for every picked faction. An ascending-auction algorithm then assigns each player " +
      "the faction that maximizes their own value.",
  },
];

function engineAuctionOption(variant: AuctionVariantOption): AuctionVariant | undefined {
  switch (variant) {
    case "silent":
      return AuctionVariant.Silent;
    case "none":
    default:
      return undefined;
  }
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

const GAME_NAME_NOUNS = [
  "Atlas",
  "Beacon",
  "Comet",
  "Drift",
  "Echo",
  "Harbor",
  "Nova",
  "Orbit",
  "Signal",
  "Spire",
];

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
  };
  const probe = new Engine(
    [`init ${form.playerCount} ${seed}`, rotateMove],
    JSON.parse(JSON.stringify(options))
  );
  probe.generateAvailableCommandsIfNeeded();
  return {
    p_name: randomGameName(),
    p_seed: seed,
    p_player_count: form.playerCount,
    p_options: options,
    p_invites: form.seats.map((s, i) => ({ user_id: s.userId, seat: i, display_name: s.name })),
    p_current_seat: probe.playerToMove,
    p_setup_move: rotateMove,
  };
}
