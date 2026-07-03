import Engine from "@gaia-project/engine";

export type NewGameForm = {
  playerCount: number;
  seats: { userId: string; name: string }[];
};

export function randomSeed(): string {
  return `lf-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
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
  const options = { lostFleet: true, advancedRules: true, factionVariant: "standard" };
  const probe = new Engine(
    [`init ${form.playerCount} ${seed}`, rotateMove],
    JSON.parse(JSON.stringify(options))
  );
  probe.generateAvailableCommandsIfNeeded();
  return {
    p_name: "",
    p_seed: seed,
    p_player_count: form.playerCount,
    p_options: options,
    p_invites: form.seats.map((s, i) => ({ user_id: s.userId, seat: i, display_name: s.name })),
    p_current_seat: probe.playerToMove,
    p_setup_move: rotateMove,
  };
}
