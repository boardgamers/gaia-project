import Engine, { Command, endSetupFactionPhase, Faction, Phase, Resource, Reward, Round } from "@gaia-project/engine";

// Analysis mode (docs/lost-fleet/ANALYSIS_MODE_PLAN.md) - a local, non-committing sandbox clone of
// the board. The "line" is the ordered list of turns played inside it. Persistence is localStorage
// only, per game + seat (§3.3/§3.4) - never the database, and never a serialized engine (schema
// drift would corrupt a stored save; storing move strings and replaying them sidesteps that).

/** A real, engine-validated turn. */
export interface AnalysisMoveEntry {
  kind: "move";
  move: string;
}

/** The leech adjustment (§4.4, decision #12) - opponents never build in analysis mode, so a line
 * never gains the leech power a real opponent's building would realistically have offered. This is
 * an explicit, visible "assume I leech N power" line item the player adds themselves, never an
 * automatic guess. Applied on replay as a direct `Resource.ChargePower` gain (below), not a move
 * string - there is no engine command for "leech power with no offer to answer". */
export interface AnalysisAdjustEntry {
  kind: "adjust";
  charge: number;
}

/** The round-0 faction seed (§11) - "let me try this faction", the one thing round 0 could not do
 * before: it assigns a whole seat-ordered faction lineup on the clone and takes the engine's own
 * exit from faction selection straight into setup building, so the player places everyone's starting
 * mines (decision #7) and then plays round 1 solo, without first walking every seat's pick - or, in
 * an auction game, every seat's bid, whose resolution would have decided their faction FOR them.
 *
 * The lineup is stored per seat rather than recomputed on replay because the pool it is drawn from
 * shrinks as the line is edited; storing it makes replay reproduce the same table every time, the
 * same way `adjust` stores its own charge rather than re-deriving one. Like `adjust`, this is
 * analysis-only fiction with no move string behind it, so it is never committable (see
 * `committableAnalysisMoves`). */
export interface AnalysisFactionEntry {
  kind: "faction";
  /** One faction per seat, indexed by seat - `lineup[analysisSeat]` is the faction being tried. */
  lineup: Faction[];
}

export type AnalysisEntry = AnalysisMoveEntry | AnalysisAdjustEntry | AnalysisFactionEntry;

/** Structural shape shared by a real `PlayerData` instance and its plain-JSON'd form (the shape
 * `analysisComposeBase` etc. are stored as, per Game.vue's "replay from a stable base" pattern) -
 * every counter/wallet function below only ever needs to read these fields, never engine methods. */
export interface AnalysisResourceSnapshot {
  credits: number;
  ores: number;
  knowledge: number;
  qics: number;
  victoryPoints: number;
  power: { area1: number; area2: number; area3: number; gaia: number };
}

function snapshotResources(data: AnalysisResourceSnapshot): AnalysisResourceSnapshot {
  return {
    credits: data.credits,
    ores: data.ores,
    knowledge: data.knowledge,
    qics: data.qics,
    victoryPoints: data.victoryPoints,
    power: { area1: data.power.area1, area2: data.power.area2, area3: data.power.area3, gaia: data.power.gaia },
  };
}

/** Marks the analysis seat's player data uncapped (§3.4/engine player-data.ts's `analysis` flag) -
 * must be re-applied after every `Engine.fromData` reconstruction in this file, since the flag is
 * deliberately absent from `toJSON()` and so never survives a serialize/deserialize round trip. */
export function markAnalysisSeat(engine: Engine, seat: number): Engine {
  const data = engine.players[seat]?.data;
  if (data) {
    data.analysis = true;
  }
  return engine;
}

/** The sandbox wallet target (§4.1) - the same magic numbers Game.vue's cancel-trigger compose
 * clone already uses to relax affordability (`pickCancelTriggerOpponent`), reused here rather than
 * invented fresh. Unlike that one-shot preview, analysis mode actually executes moves through
 * `gainReward`, so it needs the engine's `analysis` flag (§2.4) to keep sitting exactly at
 * MAX_CREDIT/MAX_ORE/MAX_KNOWLEDGE from silently eating a subsequent gain. */
const SANDBOX_WALLET: AnalysisResourceSnapshot = {
  credits: 30,
  ores: 15,
  knowledge: 15,
  qics: 10,
  victoryPoints: 0, // unused - VP is never granted, see AnalysisWallet.grant below
  power: { area1: 4, area2: 4, area3: 4, gaia: 0 },
};

export interface AnalysisWallet {
  /** The real player's resources at the moment analysis mode was entered, captured before
   * granting - the fixed point every displayed/net figure is measured against (§4.2/§4.3). */
  baseline: AnalysisResourceSnapshot;
  /** How much was added on top of `baseline` per resource, never subtracted (Math.max below) - a
   * player who already owns more than the sandbox target (e.g. qics have no engine cap) keeps every
   * bit of it rather than having analysis mode quietly take it away. victoryPoints is always 0: VP
   * is never inflated, so its net/displayed figures are plain current-minus-baseline. */
  grant: AnalysisResourceSnapshot;
}

/**
 * Grants the sandbox wallet (§4.1) directly on `engine`'s player data for `seat` - a direct field
 * assignment, exactly like the cancel-trigger clone's, so it bypasses `gainReward`'s caps entirely
 * regardless of the `analysis` flag. Also sets the flag itself, so every later legitimate gain
 * during play (a power action's reward, income, leech) is uncapped too. Returns `null` if the seat
 * has no player data (defensive; should not happen for a real seat index).
 */
export function grantSandboxWallet(engine: Engine, seat: number): AnalysisWallet | null {
  const data = engine.players[seat]?.data;
  if (!data) {
    return null;
  }
  data.analysis = true;
  const baseline = snapshotResources(data);
  const grant: AnalysisResourceSnapshot = {
    credits: Math.max(0, SANDBOX_WALLET.credits - baseline.credits),
    ores: Math.max(0, SANDBOX_WALLET.ores - baseline.ores),
    knowledge: Math.max(0, SANDBOX_WALLET.knowledge - baseline.knowledge),
    qics: Math.max(0, SANDBOX_WALLET.qics - baseline.qics),
    victoryPoints: 0,
    power: {
      area1: Math.max(0, SANDBOX_WALLET.power.area1 - baseline.power.area1),
      area2: Math.max(0, SANDBOX_WALLET.power.area2 - baseline.power.area2),
      area3: Math.max(0, SANDBOX_WALLET.power.area3 - baseline.power.area3),
      gaia: Math.max(0, SANDBOX_WALLET.power.gaia - baseline.power.gaia),
    },
  };
  data.credits += grant.credits;
  data.ores += grant.ores;
  data.knowledge += grant.knowledge;
  data.qics += grant.qics;
  data.power.area1 += grant.power.area1;
  data.power.area2 += grant.power.area2;
  data.power.area3 += grant.power.area3;
  data.power.gaia += grant.power.gaia;
  return { baseline, grant };
}

export interface AnalysisResourceDelta {
  /** current − grant − baseline (§4.3) - the line's net cost/gain for this resource so far. */
  net: number;
  /** current − grant (§4.2) - the real number, negative when the line has overdrawn it. */
  displayed: number;
}

export interface AnalysisCounter {
  credits: AnalysisResourceDelta;
  ores: AnalysisResourceDelta;
  knowledge: AnalysisResourceDelta;
  qics: AnalysisResourceDelta;
  victoryPoints: AnalysisResourceDelta;
  /** Power as a bowl-state delta (§4.3), not an invented scalar - before/after per area, both
   * already grant-adjusted back to real numbers. */
  power: {
    before: { area1: number; area2: number; area3: number; gaia: number };
    after: { area1: number; area2: number; area3: number; gaia: number };
  };
  /** False once any of credits/ores/knowledge/qics/victoryPoints has gone negative in displayed
   * terms - the sandbox wallet let the move happen, but it would not have been affordable for real. */
  feasible: boolean;
  /** 1-based index into the line's entries of the first move that made it infeasible; null while
   * still feasible. */
  infeasibleFromMove: number | null;
}

function feasibilityAt(snapshot: AnalysisResourceSnapshot, wallet: AnalysisWallet): boolean {
  return (
    snapshot.credits - wallet.grant.credits >= 0 &&
    snapshot.ores - wallet.grant.ores >= 0 &&
    snapshot.knowledge - wallet.grant.knowledge >= 0 &&
    snapshot.qics - wallet.grant.qics >= 0 &&
    snapshot.victoryPoints >= 0
  );
}

/** Diff-based counter (§4.3): never accumulated, always `current − baseline`, so gains from power
 * actions/income/leech fall out automatically as negative usage with no special-casing.
 * `snapshots` is `replayAnalysisLine`'s per-entry trail (one entry per successfully applied move,
 * in order) - used only to find the first move that made the line infeasible; `current` (the live
 * compose base's resources) is always the source of truth for the headline numbers themselves.
 *
 * `walletGrantedAt` is `replayAnalysisLine`'s own report of which snapshot the sandbox wallet first
 * applied to, and snapshots before it are skipped by the feasibility scan: a setup-phase line
 * (Phase 4/§11) collects a snapshot per setup move long before any wallet exists, and subtracting a
 * grant that had not happened yet from those makes every one of them look overdrawn - which showed
 * up as a flat "infeasible from move 1" the moment a round-0 line reached round 1, no matter what
 * was in it. Defaults to 0 (scan everything), which is right for every line whose origin already
 * carried the grant. */
export function computeAnalysisCounter(
  current: AnalysisResourceSnapshot,
  wallet: AnalysisWallet,
  snapshots: AnalysisResourceSnapshot[],
  walletGrantedAt = 0
): AnalysisCounter {
  const delta = (currentVal: number, grantVal: number, baseVal: number): AnalysisResourceDelta => ({
    net: currentVal - grantVal - baseVal,
    displayed: currentVal - grantVal,
  });

  let infeasibleFromMove: number | null = null;
  for (let i = Math.max(0, walletGrantedAt); i < snapshots.length; i++) {
    if (!feasibilityAt(snapshots[i], wallet)) {
      infeasibleFromMove = i + 1;
      break;
    }
  }

  return {
    credits: delta(current.credits, wallet.grant.credits, wallet.baseline.credits),
    ores: delta(current.ores, wallet.grant.ores, wallet.baseline.ores),
    knowledge: delta(current.knowledge, wallet.grant.knowledge, wallet.baseline.knowledge),
    qics: delta(current.qics, wallet.grant.qics, wallet.baseline.qics),
    victoryPoints: delta(current.victoryPoints, 0, wallet.baseline.victoryPoints),
    power: {
      before: { ...wallet.baseline.power },
      after: {
        area1: current.power.area1 - wallet.grant.power.area1,
        area2: current.power.area2 - wallet.grant.power.area2,
        area3: current.power.area3 - wallet.grant.power.area3,
        gaia: current.power.gaia - wallet.grant.power.gaia,
      },
    },
    feasible: infeasibleFromMove === null,
    infeasibleFromMove,
  };
}

export interface AnalysisLine {
  entries: AnalysisEntry[];
  baseRound: number;
  baseMoveCount: number;
}

function storageKey(seat: number): string {
  // Same convention as LostFleetNotes.vue's localKey(): a hosted game's `?game=<id>` and a
  // self-contained game's full launch query string both already uniquely identify "this game".
  const search = typeof window !== "undefined" ? window.location.search : "";
  return `analysis-mode:${search}:${seat}`;
}

export function loadAnalysisLine(seat: number): AnalysisLine | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(storageKey(seat));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.entries) ? (parsed as AnalysisLine) : null;
  } catch {
    return null;
  }
}

export function saveAnalysisLine(seat: number, line: AnalysisLine): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey(seat), JSON.stringify(line));
  }
}

/** §6/decision #13 - committing "clears the line", unlike a normal exit (decision #2), which keeps
 * it for later restoration. Removes the storage key outright rather than persisting an empty line,
 * so nothing is left for a later `loadAnalysisLine` to find. */
export function clearAnalysisLine(seat: number): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(storageKey(seat));
  }
}

/**
 * The solo switch (§2.5/§3.1) - makes every future round, from wherever `engine` is right now,
 * yours alone, via two pieces:
 *
 * 1. If round 1 has never started (`engine.passedPlayers` is still its declared-but-unassigned
 *    `undefined` - the real engine never touches it before the first `beginRoundStartPhase` call),
 *    pre-seed `passedPlayers = [seat]`. This is what steers `beginRoundStartPhase`'s own
 *    `turnOrder = passedPlayers || turnOrderAfterSetupAuction` fallback (`phase.ts:405`) the one
 *    time it actually consults an unset value - the real setup -> round 1 transition, still ahead
 *    if `engine` is mid-setup. **Must not fire once a round is already under way**: `passedPlayers`
 *    is also the CURRENT round's own live accumulator (`movePass` pushes onto it as players pass),
 *    so seeding it non-empty there would double-count this seat's own next pass into
 *    `[seat, seat]` the moment it happens.
 * 2. If `engine` is already sitting in `Phase.RoundMove` (entry landed mid-round, or the setup ->
 *    round 1 transition above already ran), `turnOrder` is still the real multiplayer list for the
 *    round in progress - shrink it directly, and reset `passedPlayers` to a fresh `[]` so this
 *    seat's own future pass accumulates cleanly (mirrors what `beginRoundStartPhase` itself already
 *    does at every ordinary round boundary).
 *
 * Either way, the loop is self-sustaining from here: `beginRoundStartPhase`'s
 * `turnOrder = passedPlayers` at every later boundary reads back exactly `[seat]`, since only this
 * seat ever passes again - this function only ever needs to run once (from `enterAnalysisMode`),
 * never on every replay step.
 *
 * Deliberately does NOT touch `engine.setup` (the array backing the `turnOrderAfterSetupAuction`
 * getter, which has no setter - the fallback above can only be steered via `passedPlayers`).
 * `beginLeechingPhase` (`phase.ts:561`) reads that SAME getter for a completely different purpose -
 * table-seating order, for who a new building offers leech to (`playersInTableOrderFrom`,
 * engine.ts) - so shrinking it would make every future leech offer silently vanish instead of
 * genuinely pausing for `resolveOpponentDecisions` (§2.8) to resolve. That would defeat the point of
 * decision #9 (income/Gaia/pass work via real engine code) and directly contradict what analysis
 * mode needs to demonstrate on a player's very first mine, in *either* the round-flow (Phase 3) or
 * setup-entry (Phase 4) case - `engine.setup` stays real, untouched, for the life of the clone.
 */
export function applySoloRoundFlow(engine: Engine, seat: number): void {
  if (engine.passedPlayers === undefined) {
    engine.passedPlayers = [seat];
  }
  if (engine.phase !== Phase.RoundMove) {
    return;
  }
  engine.turnOrder = [seat];
  engine.passedPlayers = [];
  engine.currentPlayer = seat;
  engine.tempCurrentPlayer = undefined;
  engine.clearAvailableCommands();
  engine.generateAvailableCommands();
}

/** The round-0 phases a faction seed (§11) can be applied from - everything between the board setup
 * and the first starting mine, i.e. every phase in which who ends up with which faction is still
 * open. `SetupBuilding` onwards is deliberately excluded: factions are loaded and mines are already
 * going down by then, so pass-and-play (§2.6) is what covers it and reseeding would silently
 * discard placements the player had already made. */
const FACTION_SEED_PHASES: Phase[] = [
  Phase.SetupBoard,
  Phase.SetupFactionBan,
  Phase.SetupFaction,
  Phase.SetupAuction,
  Phase.SetupSilentBid,
  Phase.SetupPreferenceBid,
];

/** Whether the round-0 faction seed (§11) applies to `engine` as it stands - i.e. whether the UI
 * should offer the "analyse as <faction>" picker at all. */
export function factionSeedAvailable(engine: Engine): boolean {
  return engine.round === Round.None && FACTION_SEED_PHASES.includes(engine.phase);
}

/**
 * The factions a seed can choose between (§11): everything the table has already claimed, plus
 * everything still on offer. Both halves matter, and which one carries the answer depends on how far
 * round 0 has gotten:
 *
 * - Mid-pick, the still-available list (the engine's own `ChooseFaction` data, so bans, expansion
 *   membership and the same-planet-colour restriction are all respected without re-deriving any of
 *   them here) is the interesting half.
 * - In an auction game's bid phase every faction is already claimed and NOTHING is on offer - the
 *   whole pool sits on the seats, and the auction has merely not decided yet who keeps which. That
 *   is the case this feature exists for, so the claimed half has to be choosable too: picking one an
 *   opponent currently holds is exactly the "what if the auction lands it on me" question.
 */
export function analysisFactionPool(engine: Engine, seat: number): Faction[] {
  const pool: Faction[] = [];
  for (const player of engine.players) {
    if (player.faction && !pool.includes(player.faction)) {
      pool.push(player.faction);
    }
  }
  const toMove = engine.playerToMove;
  const chooser = toMove === undefined ? seat : toMove;
  const available = engine.findAvailableCommand(chooser, Command.ChooseFaction);
  for (const faction of (available?.data as Faction[]) ?? []) {
    if (!pool.includes(faction)) {
      pool.push(faction);
    }
  }
  return pool;
}

/**
 * Turns "I want to analyse as `faction`" into the full seat-ordered lineup a seed entry stores.
 *
 * `seat` gets `faction`; whoever held it (if anyone) gives it up, and every seat left without one
 * is filled - first from the factions this reshuffle just freed, then from what is still on offer,
 * so a bid-phase swap trades the two seats' factions rather than pulling an unrelated one in.
 * Deterministic throughout: no randomness, so a stored line always replays to the same table.
 *
 * Throws when the pool cannot fill every seat, exactly like an illegal move entry would - the
 * caller (`replayAnalysisLine`) already treats a throw as "stop the line here".
 */
export function buildAnalysisLineup(engine: Engine, seat: number, faction: Faction): Faction[] {
  const lineup: (Faction | null)[] = engine.players.map((player) => player.faction ?? null);
  const previouslyHeld = lineup.filter((f): f is Faction => f !== null);
  const takenFrom = lineup.indexOf(faction);
  if (takenFrom !== -1) {
    lineup[takenFrom] = null;
  }
  lineup[seat] = faction;

  // Freed factions first (the seat that just lost `faction` should get this seat's own one back,
  // not a stranger from the pool), then whatever else the pool still offers.
  const leftovers = [...previouslyHeld, ...analysisFactionPool(engine, seat)].filter((f) => !lineup.includes(f));
  for (let i = 0; i < lineup.length; i++) {
    if (lineup[i] === null) {
      const next = leftovers.shift();
      if (!next) {
        throw new Error(`Not enough factions available to seat every player alongside ${faction}`);
      }
      lineup[i] = next;
    }
  }
  return lineup as Faction[];
}

/**
 * Applies a faction seed (§11) to the clone: assigns the lineup, then takes the engine's own exit
 * from faction selection (`endSetupFactionPhase`, exported from the engine for exactly this) so
 * faction boards load, Lost Fleet's terraforming costs and Moweyds' starting ship are dealt out, and
 * the setup building turn order is built by the same code a real game uses - none of which is
 * reimplemented here.
 *
 * Two fields are cleared per player before that hand-off:
 *
 * - `variant`, because it is the faction board of whatever faction that seat held BEFORE the seed,
 *   and `endSetupFactionPhase` prefers an existing one over looking up the new faction's.
 * - `data.bid`, because a bid recorded against the old faction is meaningless against the new one.
 *   Nothing charges it before final scoring, so a seeded line simply has no auction price in it -
 *   stated in the panel rather than guessed at.
 *
 * `engine.setup` is the faction list in table order, and `turnOrderAfterSetupAuction` reads player
 * order back out of it by looking up who holds each faction - so it has to keep matching the lineup
 * or every later turn order silently fills with -1. When the seed only permutes an already-complete
 * pool (the auction case) its existing order is kept, preserving the real table's turn order; when
 * the pool itself changed (mid-pick, where fewer factions had been claimed than there are seats) it
 * is rebuilt in seat order, which is the order a plain pick round would have produced anyway.
 */
export function applyFactionSeed(engine: Engine, lineup: Faction[]): void {
  if (!factionSeedAvailable(engine)) {
    throw new Error(`A faction seed cannot be applied in phase ${engine.phase}`);
  }
  if (lineup.length !== engine.players.length || new Set(lineup).size !== lineup.length) {
    throw new Error(`Invalid analysis faction lineup: ${JSON.stringify(lineup)}`);
  }
  const samePool = engine.setup.length === lineup.length && lineup.every((faction) => engine.setup.includes(faction));
  engine.setup = samePool ? engine.setup : [...lineup];
  engine.players.forEach((player, index) => {
    player.faction = lineup[index];
    player.variant = null;
    player.data.bid = 0;
  });
  endSetupFactionPhase(engine);
}

/** The two-round cap (§3.7): Pass is allowed while still in the round the line started on;
 * suppressed once the clone has advanced into its one bonus round - except round 6, the deliberate
 * exception (passing there ends the game for real, which is worth seeing). Exported so the UI can
 * explain a missing Pass button rather than leave it looking like it just vanished. */
export function passAllowed(round: number, baseRound: number): boolean {
  return round < baseRound + 1 || round === Round.LastRound;
}

/** Removes Command.Pass from the clone's available commands once the two-round cap forbids it, so
 * the button is simply never offered - the same "if you can't, the button doesn't exist" principle
 * affordability already uses (§2.3), applied here to a policy limit instead of a resource one. */
export function stripCappedPass(engine: Engine, baseRound: number): void {
  if (!passAllowed(engine.round, baseRound) && engine.availableCommands) {
    engine.availableCommands = engine.availableCommands.filter((c) => c.name !== Command.Pass);
  }
}

/**
 * Opponent decisions (§2.8) - your own mine can trigger a leech offer to an opponent
 * (`beginLeechingPhase`, move/phase.ts), and the engine pauses on `Phase.RoundLeech` waiting for
 * their answer; other phases can similarly pause on a faction choice or a brainstone placement.
 * Since opponents never actually play in analysis mode (decision #1), this resolves any such pause
 * automatically: `engine.autoMove()` first (the same faction-aware heuristics a real auto-leech
 * setting uses), then a plain Decline - exactly the move `autoMove()` itself composes for a firm
 * "no" (move/auto.ts) - for a leech offer its cost heuristics can't confidently decide on its own
 * (`auto-charge.ts`'s `askOrDeclineBasedOnCost` returns "ask" above an opponent's configured
 * comfort threshold). Without this fallback, a leech above that threshold would stall the entire
 * line on the analysis player's very first mine. Capped at a generous iteration count so a
 * genuinely unresolvable engine state can never spin forever.
 */
export function resolveOpponentDecisions(engine: Engine, seat: number): void {
  for (let i = 0; i < 50; i++) {
    const toMove = engine.playerToMove;
    if (toMove === undefined || toMove === seat) {
      return;
    }
    if (engine.autoMove()) {
      continue;
    }
    const decline = engine.findAvailableCommand(toMove, Command.Decline);
    if (!decline) {
      return; // Nothing this function knows how to resolve - stop rather than guess at a move.
    }
    const faction = engine.players[toMove].faction ?? `p${toMove + 1}`;
    engine.move(`${faction} ${Command.Decline} ${decline.data.offers[0].offer}`);
  }
}

/** Applies a leech adjustment (§4.4) directly to `seat`'s player data - `gainRewards`, not `.move()`,
 * since there is no move string for "gain power with nobody having offered it". `forced: true` skips
 * `gainRewards`' brainstone-destination interrupt (it would otherwise wait on a UI event that nothing
 * in analysis mode's replay loop can answer) and falls back to its normal heuristic placement, which
 * is exactly what a real leech resolved via `autoMove()` elsewhere in this file already does. Throws
 * on a non-positive or non-integer charge, exactly like an illegal move string throwing from
 * `engine.move()` - the caller (`replayAnalysisLine`) already treats "this entry threw" as "stop the
 * line here", so an invalid adjust entry is handled identically to an invalid move entry. */
function applyLeechAdjustment(engine: Engine, seat: number, charge: number): void {
  if (!Number.isInteger(charge) || charge <= 0) {
    throw new Error(`Invalid analysis leech adjustment: ${charge}`);
  }
  const data = engine.players[seat]?.data;
  if (!data) {
    throw new Error(`No player data for seat ${seat}`);
  }
  data.gainRewards([new Reward(charge, Resource.ChargePower)], true, Command.ChargePower);
}

/** Whether a real (already-committed) `move` string from `engine.moveHistory` was made by `seat` -
 * used for §3.5's staleness check, to tell "only opponents moved since this line was saved" apart
 * from "I moved myself" (the row that needs a keep/clear prompt instead of a silent replay). Mirrors
 * the exact prefix format `engine.ts`'s own `loadTurnMoves` parses a move's acting player from
 * (`p<N>`, 1-indexed, or the player's faction name) rather than inventing a second convention. */
export function moveBelongsToSeat(engine: Engine, move: string, seat: number): boolean {
  const spaceIndex = move.indexOf(" ");
  const token = spaceIndex === -1 ? move : move.slice(0, spaceIndex);
  if (/^p[1-7]$/.test(token)) {
    return +token[1] - 1 === seat;
  }
  return engine.players[seat]?.faction === token;
}

/**
 * Replays `entries` onto a fresh clone of `origin`, in order, stopping at the first one that
 * throws instead of crashing the caller - the only way to "un-apply" a command on an Engine
 * instance is to replay everything before it, which is what gives Undo/Reset their behavior for
 * free (pop the last entry / clear the list, then call this again).
 *
 * `seat`'s player data is re-marked uncapped (`markAnalysisSeat`, §3.4) after every reconstruction,
 * since the flag never survives the `JSON.parse(JSON.stringify(...))` round trip this function (and
 * every other clone in the analysis pipeline) relies on. After each entry lands, opponent decisions
 * are auto-resolved (§2.8) and the two-round cap's Pass suppression (§3.7) is reapplied, since both
 * depend on where the line has gotten to. `snapshots` carries one resource snapshot per
 * successfully applied entry, in order - `computeAnalysisCounter`'s only use for it is finding the
 * first entry that made the line infeasible (§4.3).
 *
 * The sandbox wallet reaches the clone by one of two routes, and **`origin`'s own phase is what
 * decides which** - not whether `initialWallet` happens to be set:
 *
 * - A mid-round entry had the grant applied to `analysisOrigin` itself by `enterAnalysisMode`, so
 *   every clone taken from it already carries the resources. Nothing to do here.
 * - A setup-phase entry (Phase 4/§11) has an origin from before round 1 even exists, so the grant
 *   belongs to a moment INSIDE the line - the first time its own pass-and-play reaches round 1's
 *   move phase. Replay always restarts from that same untopped-up origin, so that grant has to be
 *   re-applied on **every** pass, not just the one that first discovered it.
 *
 * Keying that off `!wallet` (as this did until the round-0 faction seed made setup lines routine)
 * silently broke the second case: the caller feeds the wallet it kept back in as `initialWallet`,
 * so from the next replay onwards the grant was never applied to the engine again - the clone
 * quietly reverted to the seat's real resources while the counter went on subtracting a grant that
 * was no longer there. Every number in a setup-started line was wrong from its second edit onwards.
 *
 * `walletGrantedAt` reports which snapshot index the grant first applied to, for
 * `computeAnalysisCounter`'s feasibility scan (see its own doc comment); it is 0 whenever the origin
 * already carried the grant. The returned `wallet` is what the caller should keep for its next call.
 */
export function replayAnalysisLine(
  origin: Engine,
  entries: AnalysisEntry[],
  seat: number,
  baseRound: number,
  initialWallet: AnalysisWallet | null
): {
  engine: Engine;
  applied: number;
  snapshots: AnalysisResourceSnapshot[];
  wallet: AnalysisWallet | null;
  walletGrantedAt: number;
} {
  let engine = markAnalysisSeat(Engine.fromData(JSON.parse(JSON.stringify(origin))), seat);
  let wallet = initialWallet;
  // See the doc comment above: an origin already in RoundMove carries the grant in its own player
  // data, so the lazy grant below must not fire for it; anything earlier has to (re-)apply it.
  let granted = origin.phase === Phase.RoundMove;
  let walletGrantedAt = 0;
  stripCappedPass(engine, baseRound);
  let applied = 0;
  const snapshots: AnalysisResourceSnapshot[] = [];
  for (const entry of entries) {
    const wasRoundMove = engine.phase === Phase.RoundMove;
    const copy = markAnalysisSeat(Engine.fromData(JSON.parse(JSON.stringify(engine))), seat);
    try {
      if (entry.kind === "move") {
        copy.move(entry.move);
        copy.generateAvailableCommandsIfNeeded();
      } else {
        // Neither of the two non-move entry kinds runs the engine's own move pipeline, so the
        // position's available commands (still whatever `engine` had beforehand) need an explicit
        // refresh - the same reason grantSandboxWallet's call site below regenerates after its own
        // direct resource injection. A faction seed does drive real phase machinery
        // (`endSetupFactionPhase`), but it is reached by a direct call rather than through
        // `Engine.move`, which is what would normally have regenerated them.
        if (entry.kind === "faction") {
          applyFactionSeed(copy, entry.lineup);
        } else {
          applyLeechAdjustment(copy, seat, entry.charge);
        }
        copy.clearAvailableCommands();
        copy.generateAvailableCommands();
      }
    } catch {
      break;
    }
    resolveOpponentDecisions(copy, seat);
    if (!granted && !wasRoundMove && copy.phase === Phase.RoundMove) {
      wallet = grantSandboxWallet(copy, seat);
      granted = true;
      walletGrantedAt = snapshots.length; // this entry's own snapshot, pushed below, already has it
      copy.clearAvailableCommands();
      copy.generateAvailableCommands();
    }
    stripCappedPass(copy, baseRound);
    engine = copy;
    applied++;
    const data = engine.players[seat]?.data;
    if (data) {
      snapshots.push(snapshotResources(data));
    }
  }
  return { engine, applied, snapshots, wallet, walletGrantedAt };
}

/** §6's queue cap: 1 move committed live plus `PremoveBar.vue`'s own 3-row queue limit - never
 * arbitrary, it's just what the existing premove machinery already allows. */
export const MAX_COMMITTABLE_MOVES = 4;

/**
 * The commit path's affordability gate (§6, decision #13). Only "move" entries are ever committed -
 * an `adjust` entry is analysis-only fiction (§4.4), so it is stripped out of the line entirely
 * (not merely skipped-but-counted) before replaying, and consequently every move after one is only
 * committable if it is STILL affordable **without** the leech it assumed: this replays the
 * move-only entries completely fresh, never reusing a wallet/feasibility result that was computed
 * with any adjust entries present.
 *
 * The fresh wallet has to be granted the same way `enterAnalysisMode` grants the real one: eagerly,
 * right here, if `origin` already sits in `Phase.RoundMove` - `replayAnalysisLine`'s own lazy grant
 * only fires on the TRANSITION into `Phase.RoundMove` (`!wasRoundMove && copy.phase ===
 * Phase.RoundMove`), which never happens for a line whose origin already starts there, so passing a
 * bare `null` through unconditionally would leave `wallet` permanently null for the (overwhelmingly
 * common) case of a line that started mid-round rather than in setup.
 *
 * Cuts the returned prefix at the first point that goes infeasible (mirrors
 * `computeAnalysisCounter`'s own `infeasibleFromMove`) - a line that only worked because of the
 * sandbox grant must never be committable - and separately at wherever the move-only replay itself
 * stops applying (`applied`, e.g. a move that depended on an adjust entry's power to even be legal,
 * not just affordable). A line that never left setup (`wallet` stays null throughout - setup moves
 * carry no cost, so nothing can go infeasible) commits every successfully-replayed move as-is.
 * Either way the result never exceeds `MAX_COMMITTABLE_MOVES`.
 *
 * Two whole-line disqualifications come first, both specific to a setup-phase line:
 *
 * - **A faction seed (§11) voids the entire line for commit purposes.** Every move after one was
 *   played on a table this seat only imagined - possibly as a faction it does not even hold - so
 *   nothing in it describes a move the real game would accept.
 * - **Only this seat's own moves are committable.** Setup pass-and-play (§2.6/decision #7) puts
 *   opponents' picks and mine placements in the line as ordinary entries, and committing one would
 *   dispatch a move for somebody else's seat. Truncates at the first foreign move rather than
 *   filtering them out, since committing move 3 without move 2 would not describe the same line.
 *   The replayed engine (not `origin`) resolves the faction prefixes, because a setup line is
 *   typically what assigned those factions in the first place.
 */
export function committableAnalysisMoves(
  origin: Engine,
  entries: AnalysisEntry[],
  seat: number,
  baseRound: number
): string[] {
  if (entries.some((entry) => entry.kind === "faction")) {
    return [];
  }
  const moveEntries = entries.filter((entry): entry is AnalysisMoveEntry => entry.kind === "move");
  if (moveEntries.length === 0) {
    return [];
  }
  let replayOrigin = origin;
  let initialWallet: AnalysisWallet | null = null;
  if (origin.phase === Phase.RoundMove) {
    replayOrigin = markAnalysisSeat(Engine.fromData(JSON.parse(JSON.stringify(origin))), seat);
    initialWallet = grantSandboxWallet(replayOrigin, seat);
  }
  const { engine, applied, snapshots, wallet, walletGrantedAt } = replayAnalysisLine(
    replayOrigin,
    moveEntries,
    seat,
    baseRound,
    initialWallet
  );
  const ownCount = ownMovePrefixLength(engine, moveEntries, seat);
  if (!wallet) {
    return moveEntries.slice(0, Math.min(applied, ownCount, MAX_COMMITTABLE_MOVES)).map((entry) => entry.move);
  }
  const counter = computeAnalysisCounter(snapshots[snapshots.length - 1], wallet, snapshots, walletGrantedAt);
  const feasibleCount = counter.feasible ? applied : counter.infeasibleFromMove - 1;
  return moveEntries.slice(0, Math.min(feasibleCount, ownCount, MAX_COMMITTABLE_MOVES)).map((entry) => entry.move);
}

/** How many of `moveEntries` from the start belong to `seat` - see `committableAnalysisMoves`' own
 * doc comment for why a foreign move truncates the committable prefix instead of being skipped. */
function ownMovePrefixLength(engine: Engine, moveEntries: AnalysisMoveEntry[], seat: number): number {
  const foreign = moveEntries.findIndex((entry) => !moveBelongsToSeat(engine, entry.move, seat));
  return foreign === -1 ? moveEntries.length : foreign;
}
