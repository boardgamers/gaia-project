import Engine, { Command, Phase, Round } from "@gaia-project/engine";

// Analysis mode (docs/lost-fleet/ANALYSIS_MODE_PLAN.md) - a local, non-committing sandbox clone of
// the board. The "line" is the ordered list of turns played inside it. Persistence is localStorage
// only, per game + seat (§3.3/§3.4) - never the database, and never a serialized engine (schema
// drift would corrupt a stored save; storing move strings and replaying them sidesteps that).

export interface AnalysisEntry {
  kind: "move";
  move: string;
}

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
 * compose base's resources) is always the source of truth for the headline numbers themselves. */
export function computeAnalysisCounter(
  current: AnalysisResourceSnapshot,
  wallet: AnalysisWallet,
  snapshots: AnalysisResourceSnapshot[]
): AnalysisCounter {
  const delta = (currentVal: number, grantVal: number, baseVal: number): AnalysisResourceDelta => ({
    net: currentVal - grantVal - baseVal,
    displayed: currentVal - grantVal,
  });

  let infeasibleFromMove: number | null = null;
  for (let i = 0; i < snapshots.length; i++) {
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

/**
 * The solo switch (§2.5/§3.1) - shrinks `turnOrder` to just `seat` and clears `passedPlayers`, so a
 * pass empties the list and triggers the engine's own real `cleanUpPhase` -> `beginRoundStartPhase`
 * -> `beginIncomePhase` -> `beginGaiaPhase` -> back to `RoundMove` (move/phase.ts), all genuine
 * engine code. `beginRoundStartPhase`'s own `turnOrder = passedPlayers` (now always `[seat]`, since
 * only this seat ever passes again) keeps the loop self-sustaining from here on - this only needs
 * to run once, which is why it is called directly from `enterAnalysisMode` rather than on every
 * replay step (today's entry gate only ever offers entry already at `Phase.RoundMove`, round >= 1).
 *
 * Deliberately does NOT touch `engine.setup` (the backing array behind the `turnOrderAfterSetupAuction`
 * getter, which has no setter). `beginRoundStartPhase` does fall back to it when `passedPlayers` is
 * still `undefined`, but that fallback only ever fires on the real game's own setup -> round 1
 * transition, which - for entry always at round >= 1 - has already happened before analysis mode
 * exists. `turnOrderAfterSetupAuction` is also `beginLeechingPhase`'s table-seating order for who a
 * new building offers leech to (`playersInTableOrderFrom`, engine.ts) - shrinking it would make
 * every future leech offer silently vanish instead of genuinely pausing for `resolveOpponentDecisions`
 * (§2.8) to resolve, which defeats the point of decision #9 (income/Gaia/pass work via real engine
 * code) and directly contradicts what analysis mode needs to demonstrate on a player's very first
 * mine.
 */
export function applySoloRoundFlow(engine: Engine, seat: number): void {
  if (engine.phase !== Phase.RoundMove || engine.round < Round.Round1) {
    return;
  }
  engine.turnOrder = [seat];
  engine.passedPlayers = [];
  engine.currentPlayer = seat;
  engine.tempCurrentPlayer = undefined;
  engine.clearAvailableCommands();
  engine.generateAvailableCommands();
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
 */
export function replayAnalysisLine(
  origin: Engine,
  entries: AnalysisEntry[],
  seat: number,
  baseRound: number
): { engine: Engine; applied: number; snapshots: AnalysisResourceSnapshot[] } {
  let engine = markAnalysisSeat(Engine.fromData(JSON.parse(JSON.stringify(origin))), seat);
  stripCappedPass(engine, baseRound);
  let applied = 0;
  const snapshots: AnalysisResourceSnapshot[] = [];
  for (const entry of entries) {
    const copy = markAnalysisSeat(Engine.fromData(JSON.parse(JSON.stringify(engine))), seat);
    try {
      copy.move(entry.move);
      copy.generateAvailableCommandsIfNeeded();
    } catch {
      break;
    }
    resolveOpponentDecisions(copy, seat);
    stripCappedPass(copy, baseRound);
    engine = copy;
    applied++;
    const data = engine.players[seat]?.data;
    if (data) {
      snapshots.push(snapshotResources(data));
    }
  }
  return { engine, applied, snapshots };
}
