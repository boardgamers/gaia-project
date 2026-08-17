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

/** The subset of a seat's `PlayerData` this module reads - satisfied both by a real instance and by
 * its plain-JSON'd form (the shape `analysisComposeBase` is stored as, per Game.vue's "replay from a
 * stable base" pattern), so nothing here ever needs an engine method. */
export interface AnalysisResourceView {
  credits: number;
  ores: number;
  knowledge: number;
  qics: number;
  /** The engine's own tally of power the sandbox assumed this seat charged (§12) - absent on a
   * plain-JSON'd snapshot taken before the field existed, hence optional. */
  analysisAssumedPower?: number;
}

/** Marks the analysis seat's player data as the sandbox seat (§3.4/§12, engine player-data.ts's
 * `analysis` flag): affordability stops being enforced for it, so an unaffordable move can be played
 * and the resulting debt shown, and `spendPower` tops up rather than driving a power bowl negative.
 * Must be re-applied after every `Engine.fromData` reconstruction in this file, since the flag is
 * deliberately absent from `toJSON()` and so never survives a serialize/deserialize round trip. */
export function markAnalysisSeat(engine: Engine, seat: number): Engine {
  const data = engine.players[seat]?.data;
  if (data) {
    data.analysis = true;
  }
  return engine;
}

/** One overdrawn resource: how far below zero the line has driven it. */
export interface AnalysisOverdraft {
  /** The resource's single-letter icon key, matching the viewer's own `Resource` kinds. */
  kind: "c" | "o" | "k" | "q";
  /** Always negative - the number the player board is showing in red. */
  amount: number;
}

/**
 * What the header needs to say about a line, and nothing more (§12).
 *
 * There used to be a full per-resource counter here, with a `displayed` figure (clone minus the
 * granted sandbox wallet) beside a `net` one, plus a power bowl delta and a per-entry feasibility
 * scan. All of it existed to undo the fake wallet analysis mode used to inject. Nothing injects
 * anything now - the seat keeps its real resources and simply goes negative - so the player board is
 * already showing every one of those numbers, live, in the place players actually read them. What is
 * left is the two facts the board CANNOT show: a compact overdraft summary for when the board is
 * scrolled off screen on mobile, and how much power the sandbox assumed you charged.
 */
export interface AnalysisStatus {
  /** Empty when the line is genuinely affordable. */
  overdrawn: AnalysisOverdraft[];
  /** 0 unless a power cost was topped up (see engine `assumePowerForAnalysis`). */
  assumedPower: number;
}

export function computeAnalysisStatus(data: AnalysisResourceView): AnalysisStatus {
  const overdrawn: AnalysisOverdraft[] = [];
  const add = (kind: AnalysisOverdraft["kind"], amount: number) => {
    if (amount < 0) {
      overdrawn.push({ kind, amount });
    }
  };
  add("c", data.credits);
  add("o", data.ores);
  add("k", data.knowledge);
  add("q", data.qics);
  return { overdrawn, assumedPower: data.analysisAssumedPower ?? 0 };
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
 * Opponent decisions (§2.8) - your own building can trigger a leech offer to an opponent
 * (`beginLeechingPhase`, move/phase.ts), and the engine pauses on `Phase.RoundLeech` waiting for
 * their answer; other phases can similarly pause on a faction choice or a brainstone placement.
 * Since opponents never actually play in analysis mode (decision #1), this resolves any such pause so
 * control comes straight back to the analysis seat.
 *
 * **Declines first, deliberately** (owner instruction, §12). This used to try `engine.autoMove()`
 * first and only fall back to Decline, which made the outcome depend on the opponent's own auto-charge
 * settings and heuristics - and when those returned "ask", or when the fallback's own `engine.move`
 * threw, the pause survived. A surviving pause is not a cosmetic problem: analysis mode forces
 * `canPlay` true, so `Commands.vue` then renders the OPPONENT's accept/decline buttons and the player
 * cannot continue their own line - the reported bug. An opponent's leech is worth nothing in a sandbox
 * where they never build, so the deterministic answer is always "no thanks".
 *
 * Every failure here is swallowed rather than propagated: this runs OUTSIDE `replayAnalysisLine`'s own
 * try/catch (it has to - it fixes up the state after a move rather than being one), so a throw would
 * take out the whole click and freeze the board mid-line. Leaving a pause unresolved is survivable
 * (Game.vue's `analysisBlockedBySeat` catches it and offers a way out); throwing is not.
 */
export function resolveOpponentDecisions(engine: Engine, seat: number): void {
  for (let i = 0; i < 50; i++) {
    const toMove = engine.playerToMove;
    if (toMove === undefined || toMove === seat) {
      break;
    }
    const faction = engine.players[toMove].faction ?? `p${toMove + 1}`;
    const decline = engine.findAvailableCommand(toMove, Command.Decline);
    if (decline) {
      // Answer every offer on the table, not just offers[0]: a single building can offer more than
      // one charge amount, and picking the wrong one throws rather than declining.
      const offers = (decline.data?.offers ?? []).map((o) => o.offer);
      if (
        tryMoves(
          engine,
          offers.map((offer) => `${faction} ${Command.Decline} ${offer}`)
        )
      ) {
        continue;
      }
    }
    // The round-0 booster pick (owner instruction): setup pass-and-play (§2.6/decision #7) exists so
    // the player can place everyone's starting mines, not so they have to choose a booster for each
    // opponent - an opponent's booster is worth nothing in a sandbox where they never take a turn.
    // Taken first-available rather than randomly, so a stored line always replays the same table.
    const booster = engine.findAvailableCommand(toMove, Command.ChooseRoundBooster);
    if (booster) {
      const boosters = booster.data?.boosters ?? [];
      if (
        tryMoves(
          engine,
          boosters.map((b) => `${faction} ${Command.ChooseRoundBooster} ${b}`)
        )
      ) {
        continue;
      }
    }
    // Not a leech offer (a brainstone placement, an income choice, a faction pick): the engine's own
    // heuristics are the right answer for those, and they cannot be expressed as a Decline.
    try {
      if (engine.autoMove()) {
        continue;
      }
    } catch {
      break;
    }
    break; // Nothing this function knows how to resolve - stop rather than guess at a move.
  }
  abandonLeechPhase(engine, seat);
}

/**
 * The last resort behind `resolveOpponentDecisions`' loop: if the clone is STILL sitting in
 * `Phase.RoundLeech` once the loop has given up, force it back to the analysis seat's move phase.
 *
 * The loop declines through real engine code and normally lands this itself; this covers the case
 * where some offer it does not know how to answer survives. A surviving leech pause is not cosmetic -
 * analysis mode forces `canPlay` true, so `Commands.vue` renders the OPPONENT's accept/decline
 * buttons and the player's own line cannot continue. Dropping the remaining sources is exactly what
 * declining them all would have produced (a decline changes nothing but `declined`), so nothing is
 * lost by taking the shortcut.
 */
function abandonLeechPhase(engine: Engine, seat: number): void {
  if (engine.phase !== Phase.RoundLeech) {
    return;
  }
  engine.leechSources = [];
  engine.tempTurnOrder = [];
  engine.tempCurrentPlayer = undefined;
  engine.currentPlayer = seat;
  engine.changePhase(Phase.RoundMove);
  engine.clearAvailableCommands();
}

/** Plays the first of `moves` that the engine accepts, on `engine` itself; returns whether any stuck.
 * Each attempt runs against a throwaway clone first, so a rejected guess never half-applies. */
function tryMoves(engine: Engine, moves: string[]): boolean {
  for (const move of moves) {
    try {
      const probe = Engine.fromData(JSON.parse(JSON.stringify(engine)));
      probe.move(move);
    } catch {
      continue;
    }
    try {
      engine.move(move);
      return true;
    } catch {
      return false;
    }
  }
  return false;
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
 * `seat`'s player data is re-marked as the sandbox seat (`markAnalysisSeat`, §3.4/§12) after every
 * reconstruction, since the flag never survives the `JSON.parse(JSON.stringify(...))` round trip this
 * function (and every other clone in the analysis pipeline) relies on. That flag is now the whole
 * mechanism: with affordability lifted in the engine, the seat keeps its real resources and simply
 * goes negative, so there is no wallet to grant, carry between calls, or subtract back out - the
 * player board reads the true numbers straight off the replayed engine.
 *
 * After each entry lands, opponent decisions are auto-resolved (§2.8) and the two-round cap's Pass
 * suppression (§3.7) is reapplied, since both depend on where the line has gotten to.
 */
export function replayAnalysisLine(
  origin: Engine,
  entries: AnalysisEntry[],
  seat: number,
  baseRound: number
): {
  engine: Engine;
  applied: number;
} {
  let engine = markAnalysisSeat(Engine.fromData(JSON.parse(JSON.stringify(origin))), seat);
  // Regenerate before anything reads them: `Engine.fromData` carries over the command list `origin`
  // was serialized with, and that list was built while affordability still applied to this seat. With
  // the flag now set, the same position offers strictly more (§12) - without this an empty line shows
  // the real game's buttons, so entering analysis mode appeared to change nothing until the first
  // move happened to regenerate them.
  engine.clearAvailableCommands();
  engine.generateAvailableCommands();
  stripCappedPass(engine, baseRound);
  let applied = 0;
  for (const entry of entries) {
    const copy = markAnalysisSeat(Engine.fromData(JSON.parse(JSON.stringify(engine))), seat);
    try {
      if (entry.kind === "move") {
        copy.move(entry.move);
        copy.generateAvailableCommandsIfNeeded();
      } else {
        // Neither non-move entry kind runs the engine's own move pipeline, so the position's available
        // commands (still whatever `engine` had beforehand) need an explicit refresh. A faction seed
        // does drive real phase machinery (`endSetupFactionPhase`), but it is reached by a direct call
        // rather than through `Engine.move`, which is what would normally have regenerated them.
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
    // Unconditional, and it has to come after the decisions above. `Engine.executeMove` nulls the
    // command list after every successful move, including the declines `resolveOpponentDecisions`
    // plays - and nothing downstream regenerates it, because `Commands.vue` reads
    // `engine.availableCommands` straight off the store. A null list renders as an empty command area
    // with only the Back button in it, which was the reported "I built inside leech range, the log
    // shows the opponents declining, and then I'm stuck": the declines had worked exactly as intended
    // and simply left the position with no commands generated for it. `stripCappedPass` below also
    // silently did nothing whenever this happened, for the same reason.
    copy.generateAvailableCommandsIfNeeded();
    stripCappedPass(copy, baseRound);
    engine = copy;
    applied++;
  }
  return { engine, applied };
}

/** §6's queue cap: 1 move committed live plus `PremoveBar.vue`'s own 3-row queue limit - never
 * arbitrary, it's just what the existing premove machinery already allows. */
export const MAX_COMMITTABLE_MOVES = 4;

/**
 * The commit path's affordability gate (§6, decision #13). Only "move" entries are ever committed -
 * an `adjust` entry is analysis-only fiction (§4.4), so it is stripped out of the line entirely
 * (not merely skipped-but-counted) before replaying, and consequently every move after one is only
 * committable if it is STILL affordable **without** the leech it assumed: this replays the
 * move-only entries completely fresh.
 *
 * Affordability is now simply "did any resource end up negative" (§12) - the sandbox no longer hands
 * the seat resources it does not have, so an overdrawn line is visible in the player data itself. The
 * returned prefix is cut at the first move that leaves the seat overdrawn, since a line that only
 * worked by overspending must never be committable, and separately at wherever the move-only replay
 * stops applying (`applied`, e.g. a move that depended on an adjust entry's power to even be legal).
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
 *
 * A power cost that had to be topped up (`analysisAssumedPower`, §12) also blocks the commit: the
 * move is only legal in the sandbox because power was assumed, so it is exactly as hypothetical as an
 * `adjust` entry.
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
  // Replay one move at a time so the cut lands on the first move that overdrew, rather than only
  // being able to say "somewhere in this line". Each pass restarts from `origin`, exactly as every
  // other replay in this file does.
  let affordable = 0;
  for (let count = 1; count <= moveEntries.length; count++) {
    const { engine, applied } = replayAnalysisLine(origin, moveEntries.slice(0, count), seat, baseRound);
    if (applied < count) {
      break;
    }
    const data = engine.players[seat]?.data;
    if (!data) {
      break;
    }
    const status = computeAnalysisStatus(data);
    if (status.overdrawn.length > 0 || status.assumedPower > 0) {
      break;
    }
    affordable = count;
    if (count >= MAX_COMMITTABLE_MOVES) {
      break;
    }
  }
  if (affordable === 0) {
    return [];
  }
  const { engine } = replayAnalysisLine(origin, moveEntries.slice(0, affordable), seat, baseRound);
  const ownCount = ownMovePrefixLength(engine, moveEntries, seat);
  return moveEntries.slice(0, Math.min(affordable, ownCount, MAX_COMMITTABLE_MOVES)).map((entry) => entry.move);
}

/** How many of `moveEntries` from the start belong to `seat` - see `committableAnalysisMoves`' own
 * doc comment for why a foreign move truncates the committable prefix instead of being skipped. */
function ownMovePrefixLength(engine: Engine, moveEntries: AnalysisMoveEntry[], seat: number): number {
  const foreign = moveEntries.findIndex((entry) => !moveBelongsToSeat(engine, entry.move, seat));
  return foreign === -1 ? moveEntries.length : foreign;
}
