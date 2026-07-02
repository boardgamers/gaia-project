import Engine from "@gaia-project/engine";

export type NewGameForm = {
  name: string;
  playerCount: number;
  lostFleet: boolean;
  seats: { email: string; name: string }[];
};

export function randomSeed(): string {
  return `lf-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/**
 * Builds the create_game RPC arguments. Seed is fixed here, once, forever
 * (§J3); a probe engine tells us which seat opens the setup phase.
 *
 * The probe gets a CLONE of the options: Engine mutates the object it's
 * given (it writes the generated map layout back into options.map, plus
 * factionVariantVersion), and persisting that mutated object breaks replay —
 * moveInit rejects map.sectors combined with lostFleet. The stored options
 * must stay exactly what the user chose.
 */
export function buildCreateGameParams(form: NewGameForm, seed: string = randomSeed()) {
  const options = { lostFleet: form.lostFleet, factionVariant: "standard" };
  const probe = new Engine([`init ${form.playerCount} ${seed}`], JSON.parse(JSON.stringify(options)));
  probe.generateAvailableCommandsIfNeeded();
  return {
    p_name: form.name,
    p_seed: seed,
    p_player_count: form.playerCount,
    p_options: options,
    p_invites: form.seats.map((s, i) => ({ email: s.email, seat: i, display_name: s.name })),
    p_current_seat: probe.playerToMove,
  };
}
