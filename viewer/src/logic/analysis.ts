import Engine from "@gaia-project/engine";

// Analysis mode (docs/lost-fleet/ANALYSIS_MODE_PLAN.md) - a local, non-committing sandbox clone of
// the board. The "line" is the ordered list of turns played inside it. Persistence is localStorage
// only, per game + seat (§3.3/§3.4) - never the database, and never a serialized engine (schema
// drift would corrupt a stored save; storing move strings and replaying them sidesteps that).

export interface AnalysisEntry {
  kind: "move";
  move: string;
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
 * Replays `entries` onto a fresh clone of `origin`, in order, stopping at the first one that
 * throws instead of crashing the caller - the only way to "un-apply" a command on an Engine
 * instance is to replay everything before it, which is what gives Undo/Reset their behavior for
 * free (pop the last entry / clear the list, then call this again).
 */
export function replayAnalysisLine(origin: Engine, entries: AnalysisEntry[]): { engine: Engine; applied: number } {
  let engine = Engine.fromData(JSON.parse(JSON.stringify(origin)));
  let applied = 0;
  for (const entry of entries) {
    const copy = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    try {
      copy.move(entry.move);
      copy.generateAvailableCommandsIfNeeded();
    } catch {
      break;
    }
    engine = copy;
    applied++;
  }
  return { engine, applied };
}
