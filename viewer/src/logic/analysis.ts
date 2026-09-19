import Engine, {
  ANALYSIS_CHEAP_BUILD,
  Command,
  endSetupFactionPhase,
  Faction,
  Phase,
  Resource,
  Reward,
  Round,
} from "@gaia-project/engine";
import type { PremoveTiming } from "@gaia-project/engine/src/premove-types";

import { parseCommands } from "./recent";

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
  victoryPoints?: number;
  /** The engine's own tally of power the sandbox assumed this seat charged (§12) - absent on a
   * plain-JSON'd snapshot taken before the field existed, hence optional. */
  analysisAssumedPower?: number;
}

/** Enables explicit planning options while preserving the position's normal resource checks.
 * Re-applied after cloning because the flag is intentionally not serialized. */
export function markAnalysisSeat(engine: Engine, seat: number, assumedPower = 0): Engine {
  const data = engine.players[seat]?.data;
  if (data) {
    data.analysis = true;
    data.validatingFuturePremove = false;
    data.analysisAssumedPower = assumedPower;
  }
  return engine;
}

/** The assumed-power tally carried on `seat`'s player data, for handing to the next
 * `markAnalysisSeat` in a chain of clones. Reads 0 for a plain-JSON'd snapshot, which never carries
 * it (see `markAnalysisSeat`). */
export function assumedPowerOf(engine: Engine, seat: number): number {
  return engine.players[seat]?.data.analysisAssumedPower ?? 0;
}

/** The total power the player has told the sandbox to assume they charge - the sum of the line's
 * own `adjust` entries (§4.4), i.e. one per press of the Charge 1 button. Distinct from
 * `analysisAssumedPower`, which is what the engine topped up on its own to cover a power cost the
 * seat could not really pay: this one is the player's own declared leech, and it is the number they
 * would otherwise have to keep count of in their head. */
export function chargedPowerTotal(entries: AnalysisEntry[]): number {
  return entries.reduce((total, entry) => (entry.kind === "adjust" ? total + entry.charge : total), 0);
}

export interface AnalysisResourceChange {
  /** The resource's icon key, matching the viewer's own `Resource` kinds. */
  kind: "c" | "o" | "k" | "q" | "vp";
  /** Signed amount: positive for a gain, negative for a spend or deficit. */
  amount: number;
}

/** One overdrawn resource: how far below zero the plan has driven it. */
export type AnalysisOverdraft = AnalysisResourceChange;

/** Resource changes and simulation assumptions for the selected plan. */
export interface AnalysisStatus {
  /** Net resource change from the start of the selected plan, including the unfinished turn. */
  changes?: AnalysisResourceChange[];
  /** Empty when the line is genuinely affordable. */
  overdrawn: AnalysisOverdraft[];
  /** 0 unless a power cost was topped up (see engine `assumePowerForAnalysis`). */
  assumedPower: number;
  /** 0 unless the player pressed Charge 1 - see `chargedPowerTotal`. */
  chargedPower: number;
}

export function computeAnalysisStatus(
  data: AnalysisResourceView,
  chargedPower = 0,
  origin?: AnalysisResourceView
): AnalysisStatus {
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
  const changes: AnalysisResourceChange[] = origin
    ? (
        [
          ["c", "credits"],
          ["o", "ores"],
          ["k", "knowledge"],
          ["q", "qics"],
          ["vp", "victoryPoints"],
        ] as const
      )
        .map(([kind, field]) => ({ kind, amount: (data[field] ?? 0) - (origin[field] ?? 0) }))
        .filter(({ amount }) => amount !== 0)
    : [];
  return { changes, overdrawn, assumedPower: data.analysisAssumedPower ?? 0, chargedPower };
}

/** The stored shape BEFORE §13's tab strip - one line per game+seat. Kept solely so
 * `loadAnalysisLines` can migrate a value written by a viewer version that predates the tabs: master
 * deploys straight to production, so there are real in-progress games carrying one of these right
 * now, and dropping it on read would throw away work the player can see in the UI. */
export interface AnalysisLine {
  entries: AnalysisEntry[];
  baseRound: number;
  baseMoveCount: number;
}

/**
 * Several lines at once (§13) - "work out line A, work out line B, flip between them".
 *
 * `baseRound`/`baseMoveCount` sit on the SET, not on each line, because every line in it is rooted
 * at the same `analysisOrigin`: the sandbox clones the board once on entry and each line is just a
 * different sequence of turns played from that one point. That is what keeps staleness (§3.5) a
 * single decision for the whole set rather than a per-line one, and it is why switching lines is
 * only ever a replay - there is no second origin to rebuild.
 *
 * `active` is stored too, so leaving the sandbox and coming back reopens the line you were on
 * rather than dumping you back on Line 1.
 */
export interface AnalysisLineSet {
  /** Always at least one, even when that one is empty - Line 1 exists from the moment the sandbox
   * opens, so the strip never has a zero state to design for. */
  lines: AnalysisEntry[][];
  /** Index into `lines`. Always in range once `normalizeAnalysisLineSet` has seen the value. */
  active: number;
  baseRound: number;
  baseMoveCount: number;
  /** Last real move at the saved base, used to detect a rollback before trimming. */
  baseMove?: string;
}

/** How many lines the strip will hold. The cap is the header's width far more than localStorage's
 * quota: past this the tabs stop fitting one row on a phone, and a comparison you have to scroll
 * horizontally to read is not much of a comparison. */
export const MAX_ANALYSIS_LINES = 5;

/** Label the alternative plans without requiring players to name them. */
export function analysisLineLabel(index: number): string {
  return `Plan ${String.fromCharCode(65 + index)}`;
}

/** Forces the invariants the rest of the code assumes: at least one line, `active` inside it, and no
 * more than `MAX_ANALYSIS_LINES`. Applied on every read, so a hand-edited or truncated localStorage
 * value can never put the strip into a state with no open tab. */
export function normalizeAnalysisLineSet(set: AnalysisLineSet): AnalysisLineSet {
  const lines = set.lines.filter(Array.isArray).slice(0, MAX_ANALYSIS_LINES);
  if (lines.length === 0) {
    lines.push([]);
  }
  const active = Number.isInteger(set.active) ? Math.min(Math.max(set.active, 0), lines.length - 1) : 0;
  return { ...set, lines, active };
}

/** An empty set rooted at the given base - the sandbox's opening state, and what a cleared or
 * expired set is replaced by. */
export function emptyAnalysisLineSet(baseRound: number, baseMoveCount: number): AnalysisLineSet {
  return { lines: [[]], active: 0, baseRound, baseMoveCount };
}

/** Every entry across every line, for the "is there anything here at all" questions (the restore
 * prompt's count, and whether a stored set is worth prompting about). */
export function analysisLineSetSize(set: AnalysisLineSet): number {
  return set.lines.reduce((total, entries) => total + entries.length, 0);
}

function storageKey(seat: number, scope?: string): string {
  // BGS shares one iframe URL across games. Its initial move contains the game seed/name,
  // so hosted callers supply that stable identity instead of sharing a query-string key.
  if (scope !== undefined) return `analysis-mode:game:${scope}:${seat}`;
  const search = typeof window !== "undefined" ? window.location.search : "";
  return `analysis-mode:${search}:${seat}`;
}

/**
 * Reads the stored set, migrating a pre-tabs single line in place.
 *
 * Deliberately the SAME storage key as before rather than a v2 one: the two shapes are told apart by
 * which field they carry (`entries` vs `lines`), the migration is lossless, and a second key would
 * leave the old one behind for a later version to trip over. A stored value that is neither shape
 * reads as "nothing stored", exactly as an unparseable one always has.
 */
export function loadAnalysisLines(seat: number, scope?: string): AnalysisLineSet | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(seat, scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.lines)) {
      return normalizeAnalysisLineSet(parsed as AnalysisLineSet);
    }
    if (parsed && Array.isArray(parsed.entries)) {
      const line = parsed as AnalysisLine;
      return normalizeAnalysisLineSet({
        lines: [line.entries],
        active: 0,
        baseRound: line.baseRound,
        baseMoveCount: line.baseMoveCount,
      });
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAnalysisLines(seat: number, set: AnalysisLineSet, scope?: string): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey(seat, scope), JSON.stringify(normalizeAnalysisLineSet(set)));
    } catch {
      // A blocked/full browser store must not prevent playing or queuing a move.
    }
  }
}

/**
 * What one tab has to say for itself (§13).
 *
 * A strip that only lets you SWITCH between lines does not actually let you compare them: the board
 * is replaced wholesale on every switch, so line A has to be held in your head while you look at
 * line B - which is the very thing the sandbox exists to stop you doing, and the same failure the
 * charged-power readout was added to fix (PROGRESS #188). Carrying each line's own outcome on its
 * own tab is what turns the strip into the comparison itself: the answer is on screen for every line
 * at once, and switching becomes something you do to CONTINUE a line, not to read it.
 *
 * `victoryPoints` is a delta against the origin rather than an absolute, because the absolute is the
 * same double-digit number on every tab and the difference between them is the whole question.
 */
export interface AnalysisLineSummary {
  /** "Plan A", "Plan B" - see `analysisLineLabel`. */
  label: string;
  /** Complete game turns, excluding simulation adjustments. */
  moves: number;
  /** VP this line ends on, minus the VP the seat started the sandbox with. */
  victoryPoints: number;
  /** True when the line spends more than the seat has - a VP total bought with resources that do not
   * exist is not comparable to one that is actually payable, so the tab has to say so. */
  overdrawn: boolean;
  /** How many game turns actually replayed. Below `moves` only after a re-anchor (§3.5) dropped part of
   * the line; the tab flags it so a truncated line is never silently compared as if it were whole. */
  applied: number;
}

/**
 * One tab's summary, by replaying its line against the shared origin.
 *
 * Every line in the set is rooted at the same `origin`, so this works for a line that is not open
 * just as well as for the one that is - which is the point: the strip needs all of their outcomes at
 * once. Callers are expected to memoize on (origin identity, entries), since replaying every line on
 * every click would otherwise multiply the sandbox's per-move cost by the number of tabs
 * (`PERFORMANCE.md`); nothing here caches on its own.
 */
export function summarizeAnalysisLine(
  origin: Engine,
  entries: AnalysisEntry[],
  seat: number,
  baseRound: number,
  index: number
): AnalysisLineSummary {
  const baseVictoryPoints = origin.players[seat]?.data.victoryPoints ?? 0;
  const label = analysisLineLabel(index);
  if (entries.length === 0) {
    return { label, moves: 0, victoryPoints: 0, overdrawn: false, applied: 0 };
  }
  const { engine, applied } = replayAnalysisLine(origin, entries, seat, baseRound);
  const data = engine.players[seat]?.data;
  return {
    label,
    moves: entries.filter((entry) => entry.kind === "move").length,
    victoryPoints: (data?.victoryPoints ?? baseVictoryPoints) - baseVictoryPoints,
    overdrawn: data ? computeAnalysisStatus(data).overdrawn.length > 0 : false,
    applied: entries.slice(0, applied).filter((entry) => entry.kind === "move").length,
  };
}

/** §6/decision #13 - committing "clears the line", unlike a normal exit (decision #2), which keeps
 * it for later restoration. Removes the storage key outright rather than persisting an empty line,
 * so nothing is left for a later `loadAnalysisLines` to find.
 *
 * With §13's tab strip that means ALL lines, not just the committed one, and deliberately so: every
 * other line in the set was an ALTERNATIVE to the move that has now been played for real, worked out
 * from a board state the game has since left. Keeping them would leave tabs sitting there whose
 * numbers describe a table that no longer exists. */
export function clearAnalysisLine(seat: number, scope?: string): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(storageKey(seat, scope));
    } catch {
      // The server queue remains independent of local sandbox persistence.
    }
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

/**
 * The seat has already passed this round (owner instruction, 2026-08-19). `applySoloRoundFlow` on its
 * own simply wiped `passedPlayers` and handed the seat a fresh turn - in a round it is out of, Pass
 * button and all - and `committableAnalysisMoves` then reported those moves as playable for real.
 * What a player who has passed actually wants to look at is the round they will next play.
 *
 * So roll the clone forward instead: every opponent still in `turnOrder` passes, through real engine
 * code, which runs the ordinary end-of-round machinery (scoring, income, Gaia) and lands in the next
 * round with `beginRoundStartPhase` reading `turnOrder = passedPlayers` - i.e. this seat, alone,
 * exactly as the solo flow wants it. Opponents pass rather than being auto-played, because the
 * sandbox's premise is that they never take a turn; their booster is handed straight back for the
 * same reason `resolveOpponentDecisions` hands back the round-0 one (the pool must show every tile
 * free except the one the sandbox seat itself holds).
 *
 * Returns whether the clone actually moved to a later round - `Game.vue` blocks Commit on that, since
 * a line played in round N+1 describes moves the real game, still sitting in round N, cannot accept.
 */
export function advancePastOwnPass(engine: Engine, seat: number): boolean {
  if (engine.phase !== Phase.RoundMove || !engine.passedPlayers?.includes(seat)) {
    return false;
  }
  const startingRound = engine.round;
  // Bounded by the table size; the loop exits on its own as soon as control is back on this seat.
  for (let i = 0; i < 10; i++) {
    const toMove = engine.playerToMove;
    if (toMove === undefined || toMove === seat || engine.phase !== Phase.RoundMove) {
      break;
    }
    const player = engine.players[toMove];
    const faction = player.faction ?? `p${toMove + 1}`;
    const boosters = engine.findAvailableCommand(toMove, Command.Pass)?.data?.boosters ?? [];
    if (
      !tryMoves(
        engine,
        boosters.map((booster) => `${faction} ${Command.Pass} ${booster}`)
      )
    ) {
      break;
    }
    const picked = player.data.tiles.booster;
    if (picked !== undefined) {
      player.removeRoundBoosterEvents();
      player.data.tiles.booster = undefined;
      engine.tiles.boosters[picked] = true;
    }
    engine.generateAvailableCommandsIfNeeded();
  }
  return engine.round > startingRound;
}

/**
 * Everything that has to be true of a clone before the player is handed the board: the solo turn
 * order, opponents' pending decisions resolved, and the solo turn order again.
 *
 * The order is not arbitrary and the repetition is not redundant. `applySoloRoundFlow` only acts in
 * `Phase.RoundMove`, so it has to come first for the ordinary off-turn entry (shrink the turn order
 * and control is already back - `resolveOpponentDecisions` then finds nothing to do and cannot
 * `autoMove()` an opponent into taking a real turn). But a clone parked anywhere else - a leech
 * answer, an income or Gaia choice, an opponent's starting mine - needs resolving FIRST, and lands in
 * `RoundMove` with the OPPONENT still on turn, so the solo shrink has to run again afterwards. Both
 * calls are cheap and the second is a no-op whenever the first already landed it.
 *
 * Skipping the second call is exactly what left `reanchorAnalysisLine` half-fixed: it resolved the
 * pause and then rendered the opponent's own turn.
 */
export function settleAnalysisClone(engine: Engine, seat: number): void {
  applySoloRoundFlow(engine, seat);
  resolveOpponentDecisions(engine, seat);
  applySoloRoundFlow(engine, seat);
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
  // `BanFaction` as well as `ChooseFaction`: in the ban round nobody holds a faction yet AND nothing
  // is on offer to choose, so reading only the latter returned an EMPTY pool and the picker silently
  // never rendered - the one phase `FACTION_SEED_PHASES` whitelists where the seed did not work. The
  // ban command's own data is the still-unbanned pool, which is exactly the right list, and it
  // shrinks by one with every ban already played, so bans are respected without re-deriving them.
  const offered = [
    engine.findAvailableCommand(chooser, Command.ChooseFaction)?.data,
    engine.findAvailableCommand(chooser, Command.BanFaction)?.data,
  ];
  for (const faction of offered.flatMap((data) => (data as Faction[]) ?? [])) {
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
          offers.length
            ? offers.map((offer) => `${faction} ${Command.Decline} ${offer}`)
            : [`${faction} ${Command.Decline}`]
        )
      ) {
        continue;
      }
    }
    // The round-0 booster pick (owner instruction): setup pass-and-play (§2.6/decision #7) exists so
    // the player can place everyone's starting mines, not so they have to choose a booster for each
    // opponent - an opponent's booster is worth nothing in a sandbox where they never take a turn.
    // Taken first-available rather than randomly, so a stored line always replays the same table -
    // but only to satisfy the engine's own turn-order bookkeeping (phaseSetupBooster won't advance
    // to round 1 until every seat in turnOrder has completed this move). It is immediately handed
    // back, mirroring exactly what a real mid-round Pass does when a player gives up their old
    // booster (player.ts's `pass()`): opponents must not actually keep a booster (owner instruction
    // - the pool should show every tile as available except the one the sandbox seat itself
    // picked), and this is the same undo the engine already relies on elsewhere, not a new one.
    const booster = engine.findAvailableCommand(toMove, Command.ChooseRoundBooster);
    if (booster) {
      const boosters = booster.data?.boosters ?? [];
      if (
        tryMoves(
          engine,
          boosters.map((b) => `${faction} ${Command.ChooseRoundBooster} ${b}`)
        )
      ) {
        const player = engine.players[toMove];
        const picked = player.data.tiles.booster;
        if (picked !== undefined) {
          player.removeRoundBoosterEvents();
          player.data.tiles.booster = undefined;
          engine.tiles.boosters[picked] = true;
        }
        continue;
      }
    }
    // Opponents' STARTING MINES (owner instruction, 2026-08-19). Setup pass-and-play used to hand the
    // player every seat's placements to make by hand - decision #7's original reading of §2.6 - and
    // the owner's answer is "no mine placement for other factions": you pick a faction and place your
    // own. The engine has no auto-play for this (`autoMove()` returns false in `Phase.SetupBuilding`)
    // and it refuses to advance to round 1 until every seat has placed, so the sandbox places them.
    // First offer from the opponent's OWN available command, so bans/range/planet rules are the
    // engine's to enforce and a stored line always replays the same board.
    if (engine.phase === Phase.SetupBuilding) {
      const build = engine.findAvailableCommand(toMove, Command.Build);
      const offers = build?.data?.buildings ?? [];
      if (
        tryMoves(
          engine,
          offers.map((b) => `${faction} ${Command.Build} ${b.building} ${b.coordinates}`)
        )
      ) {
        continue;
      }
    }
    // Opponents cannot answer prompts in a solo preview. Use the engine's income/brainstone
    // heuristics even when their live preferences require a manual answer. Restore those settings
    // afterwards; the planning player's own choices are never automated here.
    const settings = engine.players[toMove].settings;
    const { autoIncome, autoBrainstone } = settings;
    try {
      settings.autoIncome = true;
      settings.autoBrainstone = true;
      if (engine.autoMove()) {
        continue;
      }
    } catch {
      break;
    } finally {
      settings.autoIncome = autoIncome;
      settings.autoBrainstone = autoBrainstone;
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
 * line here", so an invalid adjust entry is handled identically to an invalid move entry.
 *
 * Exported because the Charge 1 button also has to apply a charge OUTSIDE the replay loop: pressed
 * mid-turn, the charge belongs on the board as displayed (Game.vue's `analysisPendingCharge`), and
 * only becomes a line entry once the turn it was pressed during completes. */
export function applyLeechAdjustment(engine: Engine, seat: number, charge: number): void {
  if (!Number.isInteger(charge) || charge <= 0) {
    throw new Error(`Invalid analysis leech adjustment: ${charge}`);
  }
  const data = engine.players[seat]?.data;
  if (!data) {
    throw new Error(`No player data for seat ${seat}`);
  }
  data.gainRewards([new Reward(charge, Resource.ChargePower)], true, Command.ChargePower);
}

/** Identify a real move's seat using either its faction or the engine's p<N> notation. */
export function moveBelongsToSeat(engine: Engine, move: string, seat: number): boolean {
  const spaceIndex = move.indexOf(" ");
  const token = spaceIndex === -1 ? move : move.slice(0, spaceIndex);
  if (/^p[1-7]$/.test(token)) {
    return +token[1] - 1 === seat;
  }
  return engine.players[seat]?.faction === token;
}

/** Count main decisions, excluding automatic power and income responses. */
export function ownMoveCount(engine: Engine, moves: string[], seat: number): number {
  return moves.filter(
    (move) => moveBelongsToSeat(engine, move, seat) && !/^\S+\s+(?:charge|decline|income|brainstone)\b/.test(move)
  ).length;
}

/** Compare actions, ignoring display annotations, coordinate aliases and the 3c price guard.
 * The guard changes when an upgrade may execute, not which upgrade was played. */
function analysisMoveKey(engine: Engine, move: string): string {
  return JSON.stringify(
    parseCommands(move).map(({ command, args }) => {
      if (command === Command.Build) args = args.slice(0, 2);
      if (command === Command.Pass || command === Command.UpgradeResearch) args = args.slice(0, 1);
      return [
        command,
        ...args.map((arg) =>
          arg
            .split(",")
            .map((token) => {
              if (!/^(?:-?\d+x-?\d+|\d+[AB]\d+|IS\d+|DS\d+_\d+)$/.test(token)) return token;
              try {
                const { q, r } = engine.map.parse(token);
                return `${q}x${r}`;
              } catch {
                return token;
              }
            })
            .join(",")
        ),
      ];
    })
  );
}

/** Trim only a matching prefix actually present in this seat's new real history.
 * A repeatable action (research, for example) is consumed once per real turn. An invalid
 * alternative is never mistaken for a played move. Assumed charges leading into a consumed
 * turn go with it, so they cannot be added again on top of the real board. */
export function dropPlayedAnalysisPrefix(
  engine: Engine,
  entries: AnalysisEntry[],
  seat: number,
  playedMoves: string[]
): { entries: AnalysisEntry[]; dropped: number } {
  let consumed = 0;
  let dropped = 0;
  for (const move of playedMoves) {
    if (!moveBelongsToSeat(engine, move, seat)) continue;
    let next = consumed;
    while (entries[next]?.kind === "adjust") next++;
    const entry = entries[next];
    if (entry?.kind !== "move" || !moveBelongsToSeat(engine, entry.move, seat)) continue;
    if (analysisMoveKey(engine, entry.move) === analysisMoveKey(engine, move)) {
      consumed = next + 1;
      dropped++;
    }
  }
  return { entries: consumed ? entries.slice(consumed) : entries, dropped };
}

/**
 * Replays `entries` onto a fresh clone of `origin`, in order, stopping at the first one that
 * throws instead of crashing the caller - the only way to "un-apply" a command on an Engine
 * instance is to replay everything before it, which is what gives Undo/Reset their behavior for
 * free (pop the last entry / clear the list, then call this again).
 *
 * `seat`'s player data is re-marked as the sandbox seat (`markAnalysisSeat`, §3.4/§12) after every
 * reconstruction, since the flag never survives the `JSON.parse(JSON.stringify(...))` round trip this
 * function (and every other clone in the analysis pipeline) relies on. Resource checks stay active:
 * an unaffordable entry stops replay at the last valid position, including for older saved drafts.
 *
 * After each entry lands, opponent decisions are auto-resolved and solo turn order is restored,
 * including after income and other round transitions.
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
  let engine = markAnalysisSeat(
    Engine.fromData(JSON.parse(JSON.stringify(origin))),
    seat,
    assumedPowerOf(origin, seat)
  );
  // Recompute choices using this position's resources and explicit planning options.
  engine.clearAvailableCommands();
  engine.generateAvailableCommands();
  let applied = 0;
  for (const entry of entries) {
    const copy = markAnalysisSeat(
      Engine.fromData(JSON.parse(JSON.stringify(engine))),
      seat,
      assumedPowerOf(engine, seat)
    );
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
    // Finishing income/setup can enter a round with the real multiplayer turn order. Reapply the
    // solo turn order after resolving opponents, just as when entering or rebasing a preview.
    settleAnalysisClone(copy, seat);
    // Unconditional, and it has to come after the decisions above. `Engine.executeMove` nulls the
    // command list after every successful move, including the declines `resolveOpponentDecisions`
    // plays - and nothing downstream regenerates it, because `Commands.vue` reads
    // `engine.availableCommands` straight off the store. A null list renders as an empty command area
    // with only the Back button in it, which was the reported "I built inside leech range, the log
    // shows the opponents declining, and then I'm stuck": the declines had worked exactly as intended
    // and simply left the position with no commands generated for it.
    copy.generateAvailableCommandsIfNeeded();
    engine = copy;
    applied++;
  }
  return { engine, applied };
}

// Bound both previews and server submissions to three turns.
export const MAX_COMMITTABLE_MOVES = 3;

/** Moves that can be submitted now, replayed without simulated charges. Faction changes and
 * other players' moves cannot be submitted. The returned prefix stops at the first invalid move. */
export function committableAnalysisMoves(
  origin: Engine,
  entries: AnalysisEntry[],
  seat: number,
  baseRound: number
): string[] {
  return analysisCommitPrefix(origin, entries, seat, baseRound).moves;
}

/** Why the committable prefix stops where it does - the one thing `committableAnalysisMoves`' bare
 * `string[]` could not say, and the sentence the commit confirmation (`AnalysisCommitConfirm.vue`)
 * has to put in front of the player before anything leaves the sandbox. `null` means the whole line
 * is committable and nothing was left behind.
 *
 * The first two void the entire line rather than truncating it; the rest cut it at one move. */
export type AnalysisCommitCut =
  /** §11's faction seed: every move after it was played as a faction this seat may not even hold. */
  | "faction"
  /** The move stopped applying at all once the line's `adjust` entries were stripped out. */
  | "illegal"
  /** The move left a resource below zero, i.e. it only worked because the sandbox lets you overspend. */
  | "overdrawn"
  /** The move's power cost was topped up (§12) - as hypothetical as an `adjust` entry. */
  | "assumed-power"
  /** Setup pass-and-play put another seat's move here; committing it would move for somebody else. */
  | "foreign"
  /** `MAX_COMMITTABLE_MOVES` - the line is fine, there is just nowhere left to put the rest. */
  | "cap";

/** The committable prefix plus the reason it ends there. See `committableAnalysisMoves` (the thin
 * wrapper above) for the full account of the rules; this is the same computation, reporting its cut.
 * `affordableTurns` is 0 for future premoves, 1 when the first move plays now, or Infinity for offline
 * submission. Future turns may include explicitly simulated charges while checking the plan,
 * but those adjustments are never submitted. The server rechecks actual resources at execution. */
export function analysisCommitPrefix(
  origin: Engine,
  entries: AnalysisEntry[],
  seat: number,
  baseRound: number,
  affordableTurns = Infinity
): { moves: string[]; cut: AnalysisCommitCut | null } {
  if (entries.some((entry) => entry.kind === "faction")) {
    return { moves: [], cut: "faction" };
  }
  const moveEntries = entries.filter((entry): entry is AnalysisMoveEntry => entry.kind === "move");
  if (moveEntries.length === 0) {
    return { moves: [], cut: null };
  }
  // A move played now must work without simulated charges. Future moves may use charges the
  // player explicitly simulated, while still obeying every cost in that simulated position.
  const replayPrefix = (count: number) => {
    const prefix =
      count <= affordableTurns
        ? moveEntries.slice(0, count)
        : entries.slice(0, entries.indexOf(moveEntries[count - 1]) + 1);
    return replayAnalysisLine(origin, prefix, seat, baseRound);
  };
  let affordable = 0;
  let cut: AnalysisCommitCut | null = null;
  for (let count = 1; count <= moveEntries.length; count++) {
    const { engine, applied } = replayPrefix(count);
    const expected = count <= affordableTurns ? count : entries.indexOf(moveEntries[count - 1]) + 1;
    if (applied < expected) {
      cut = "illegal";
      break;
    }
    const data = engine.players[seat]?.data;
    if (!data) {
      cut = "illegal";
      break;
    }
    const status = computeAnalysisStatus(data);
    if (count <= affordableTurns && status.overdrawn.length > 0) {
      cut = "overdrawn";
      break;
    }
    if (count <= affordableTurns && status.assumedPower > 0) {
      cut = "assumed-power";
      break;
    }
    if (count <= affordableTurns && isCheapAnalysisBuild(moveEntries[count - 1].move)) {
      // A turn played now must already have the neighbour price. Future premoves retain the
      // qualifier and are checked on their actual turn, without granting a simulated discount.
      const real = Engine.fromData(JSON.parse(JSON.stringify(origin)));
      try {
        for (const entry of moveEntries.slice(0, count)) {
          real.forcePremovePreviewTurn(seat);
          real.move(entry.move);
        }
      } catch {
        cut = "illegal";
        break;
      }
    }
    affordable = count;
    if (count >= MAX_COMMITTABLE_MOVES) {
      cut = count < moveEntries.length ? "cap" : null;
      break;
    }
  }
  if (affordable === 0) {
    return { moves: [], cut };
  }
  const { engine } = replayPrefix(affordable);
  const ownCount = ownMovePrefixLength(engine, moveEntries, seat);
  const length = Math.min(affordable, ownCount, MAX_COMMITTABLE_MOVES);
  // A foreign move is the better explanation whenever it lands at or before wherever the replay
  // stopped: the line does not end because of this seat's resources, it ends because the next turn
  // belongs to somebody else - which is also the usual reason the replay could not apply it.
  if (ownCount < moveEntries.length && ownCount <= affordable) {
    cut = "foreign";
  }
  return {
    moves: moveEntries.slice(0, length).map((entry) => entry.move),
    cut: length < moveEntries.length ? cut : null,
  };
}

/** A simulated neighbour becomes an explicit maximum-price constraint in a queued upgrade. */
export function isCheapAnalysisBuild(move: string): boolean {
  return new RegExp(`\\bbuild\\s+\\S+\\s+\\S+\\s+${ANALYSIS_CHEAP_BUILD}(?=\\s*(?:\\.|$))`).test(move);
}

/** How many of `moveEntries` from the start belong to `seat` - see `committableAnalysisMoves`' own
 * doc comment for why a foreign move truncates the committable prefix instead of being skipped. */
function ownMovePrefixLength(engine: Engine, moveEntries: AnalysisMoveEntry[], seat: number): number {
  const foreign = moveEntries.findIndex((entry) => !moveBelongsToSeat(engine, entry.move, seat));
  return foreign === -1 ? moveEntries.length : foreign;
}

/** What pressing Commit is actually about to do, in the shape the confirmation modal
 * (`AnalysisCommitConfirm.vue`) reads it: which single move goes live, which ones queue behind it as
 * premoves, and what is being left behind. Built by `planAnalysisCommit`, whose inputs are the only
 * three things outside the line itself that bound a commit - whether the real game is waiting on
 * this seat, whether there is a premove queue at all, and how much room is left in it. */
export interface AnalysisCommitPlan {
  /** Round and phase for each submitted move, in live-then-queued order. */
  timings?: PremoveTiming[];
  /** A submitted upgrade must keep the 3c neighbour price. */
  simulatedNeighbour?: boolean;
  /** Played for real immediately. `null` off turn, where there is no live move to play - see
   * `Game.vue`'s `commitAnalysisLine`. */
  live: string | null;
  /** Queued as Sequential premoves, in line order, behind `live`. */
  queued: string[];
  /** Everything in the line that stays behind. Never committed, and cleared with the line. */
  dropped: string[];
  /** Why the line itself stops where it does - null when the line was not the limit. */
  cut: AnalysisCommitCut | null;
  /** Which limit actually bound this commit: the line's own feasibility, the premove queue's
   * remaining room, or the absence of a queue entirely in self-contained/hot-seat play. */
  limit: "line" | "queue" | "no-premoves";
}

/** §6/decision #13, made explicit so the player can read it before pressing anything. Applies the
 * two caps that live outside the line (the three-move limit and hosted-only premoves) to
 * the committable prefix, and reports what is left behind either way. */
export function planAnalysisCommit(args: {
  /** The committable prefix - `analysisCommitPrefix().moves`. */
  committable: string[];
  /** That prefix's cut reason. */
  cut: AnalysisCommitCut | null;
  /** Every "move" entry in the line, committable or not, in order. */
  lineMoves: string[];
  /** Whether the REAL game (not the clone) is waiting on this seat. */
  onTurn: boolean;
  /** Hosted play has a premove queue; self-contained/hot-seat does not. */
  hosted: boolean;
  /** Number of planned turns allowed after any move played immediately. The submitted plan replaces the queue. */
  queueRoom: number;
}): AnalysisCommitPlan {
  const { committable, cut, lineMoves, onTurn, hosted, queueRoom } = args;
  const room = Math.max(0, queueRoom);
  const allowed = hosted ? committable.slice(0, onTurn ? 1 + room : room) : onTurn ? committable.slice(0, 1) : [];
  const live = onTurn && allowed.length > 0 ? allowed[0] : null;
  const queued = live !== null ? allowed.slice(1) : allowed;
  const limit: AnalysisCommitPlan["limit"] =
    allowed.length < committable.length ? (hosted ? "queue" : "no-premoves") : "line";
  return {
    live,
    queued,
    ...(lineMoves.slice(0, allowed.length).some(isCheapAnalysisBuild) ? { simulatedNeighbour: true } : {}),
    dropped: lineMoves.slice(allowed.length),
    cut: limit === "line" ? cut : null,
    limit,
  };
}
