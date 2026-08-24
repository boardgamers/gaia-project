// Premove cancel triggers (docs/lost-fleet/PREMOVE_PLAN.md's premove design, extended by the
// cancel-trigger spec) - the shared decision module for "does anything watched by this seat's
// armed triggers appear in the committed moves since they were armed, and if so which one fires
// first". Designed so a client fast-path and a server-side automation function can import the same
// module (this .ts source directly, the same way premove-resolver.ts is structured), so
// online/offline evaluation can never drift.
//
// Structural/engine-agnostic on purpose - no "@gaia-project/engine" import here, and no import of
// viewer/src/logic/recent.ts either (that file pulls in the real engine's `Command` enum, which
// would drag a static "@gaia-project/engine" dependency into resolve-automation's bundle; that
// function only ever loads the engine dynamically via ../_shared/engine.bundle.js). This file
// duplicates the small slice of recent.ts's move-parsing it needs (parseCommands/cleanArg/hexArg)
// as plain strings instead, deliberately - see premove-resolver.ts's own doc comment for the same
// reasoning applied to engine types.
//
// Matching is on EFFECT, not on the literal move string (§2.1): a move is normalized into a set of
// "atoms", one per command in the line, each canonicalized so equivalent notations (a cube
// coordinate vs. a sector-relative one vs. an Interspace/Deep Space id for the same hex) and
// equivalent routes (a research step from a tech tile vs. a "free" tile vs. a faction's own special
// action) compare equal.

export type CancelTriggerKind = "move" | "leech";
export type LeechConfig = { mode: "gained" | "offered"; minPower: number };

export type CancelTriggerRow = {
  seq: number;
  kind: CancelTriggerKind;
  watchedSeat: number;
  move: string;
  atoms: string[];
  config: LeechConfig | Record<string, never>;
  match: "any" | "all";
  armedFromMoveCount: number;
};

export type SeatedMove = { seq: number; seat: number; move: string };

/** The only engine surface this file needs: canonicalizing a coordinate string to its unique
 * per-hex address, whatever notation it was written in (cube/sector-relative/Lost Fleet IS/DS). */
export type MapLike = { getS(coords: string): { toString(): string } };

type ParsedCommand = { command: string; args: string[] };

/** Local copy of recent.ts's parseCommands (see the file header for why this can't just import
 * that one) - identical behavior: strip the leading faction token, split on ".", drop any
 * parenthesized suffix, ignore empty segments. */
function parseCommandLine(move: string): ParsedCommand[] {
  const trimmed = move.trim();
  const factionIndex = trimmed.indexOf(" ");
  if (factionIndex === -1) {
    return [];
  }
  return trimmed
    .slice(factionIndex)
    .split(".")
    .flatMap((segment) => {
      const split = segment.split("(")[0].trim().split(/\s+/);
      if (split[0].length === 0) {
        return [];
      }
      return [{ command: split[0], args: split.slice(1) }];
    });
}

/** A move line's last argument can keep the "." that separates it from the next command, e.g.
 * "build m 3A4." (recent.ts's cleanArg, duplicated for the same reason as parseCommandLine). */
function cleanArg(arg: string | undefined): string {
  return (arg ?? "").replace(/\.+$/, "");
}

/** Which argument index of a command names the hex it happened on (recent.ts's hexArg table). */
const HEX_ARG_INDEX: Record<string, number> = {
  build: 1,
  gaiaFormTransdim: 0,
  lostPlanet: 0,
  placePowerRing: 0,
};

const FEDERATION_COMMAND = "federation";

/** §2.2 step 2's plumbing DROP list - applies only to candidateAtoms (the composer), never to
 * moveAtoms (normalizing an actual committed move for matching): "we compare against everything
 * they did; you just can't ask to watch plumbing." */
const PLUMBING_DROP = new Set(["spend", "burn", "brainstone", "charge", "decline", "income", "endturn"]);

function canonicalizeHex(coord: string, map: MapLike): string {
  try {
    return map.getS(coord).toString();
  } catch {
    // Unrecognized/malformed coordinate (e.g. a future notation this build doesn't know yet) -
    // fall back to the cleaned raw text rather than throwing out of a matcher that runs against
    // arbitrary recorded history (mirrors recent.ts's hexMovesByHex's own defensive catch).
    return coord;
  }
}

/** One command's args, canonicalized: hex-bearing positions through the map, FormFederation's
 * comma-separated hex list canonicalized member-by-member and sorted, everything else lowercased. */
function canonicalizeArgs(command: string, args: string[], map: MapLike): string[] {
  const hexIndex = HEX_ARG_INDEX[command];
  return args.map((raw, index) => {
    const cleaned = cleanArg(raw);
    if (command === FEDERATION_COMMAND && index === 0) {
      return cleaned
        .split(",")
        .map((c) => canonicalizeHex(c, map))
        .sort()
        .join(",");
    }
    if (hexIndex === index) {
      return canonicalizeHex(cleaned, map);
    }
    return cleaned.toLowerCase();
  });
}

function encodeAtom(command: string, args: string[]): string {
  return [command, ...args].join(":");
}

/** Normalizes one committed move line into its atom set (§2.2 - no plumbing filtering here: an
 * actual move is normalized in full, since the composer can never offer a plumbing atom in the
 * first place, so no trigger can ever contain one to match against). */
export function moveAtoms(move: string, map: MapLike): string[] {
  const commands = parseCommandLine(move);
  const atoms = commands.map((c) => encodeAtom(c.command, canonicalizeArgs(c.command, c.args, map)));
  return [...new Set(atoms)];
}

/** §2.4 - which command forms offer a loosened ("any") form, and how many of their leading
 * (already-canonicalized) args survive into it. `build` keeps its building type and drops only the
 * hex ("any lab, anywhere"); every other listed form collapses entirely to `command:*`. Forms not
 * in this table have no loosening - candidateAtoms returns `any: null` for them. */
const LOOSE_KEEP_PREFIX: Record<string, number> = {
  build: 1,
  up: 0,
  tech: 0,
  action: 0,
  special: 0,
  pass: 0,
  federation: 0,
};

function looseAtom(command: string, canonicalArgs: string[]): string | null {
  const keep = LOOSE_KEEP_PREFIX[command];
  if (keep === undefined) {
    return null;
  }
  return encodeAtom(command, [...canonicalArgs.slice(0, keep), "*"]);
}

const BUILDING_LABELS: Record<string, string> = {
  m: "a mine",
  ts: "a trading station",
  lab: "a research lab",
  ac1: "an academy",
  ac2: "an academy",
  pi: "the planetary institute",
  gf: "a gaiaformer",
};

/** Plain-language text for one candidate atom's refine-screen row (§8.3). Cosmetic only - never
 * used for matching, so it doesn't need to be exhaustive for every command in the game. */
function describeCommand(command: string, args: string[]): string {
  switch (command) {
    case "build":
      return `Build ${BUILDING_LABELS[args[0]?.toLowerCase()] ?? args[0]} at ${args[1]}`;
    case "up":
      return `Advance ${args[0]}`;
    case "tech":
      return `Take the tech tile at ${args[0]}`;
    case "action":
      return `Take board action ${args[0]}`;
    case "special":
      return `Use special action ${args[0]}`;
    case "pass":
      return `Pass, taking booster ${args[0]}`;
    case "federation":
      return `Form a federation${args[1] ? ` (tile ${args[1]})` : ""}`;
    case "charge":
      return `Charge ${args[0]}`;
    case "decline":
      return `Decline ${args[0]}`;
    default:
      return args.length > 0 ? `${command} ${args.join(" ")}` : command;
  }
}

/** Atoms of a composed move, exact + loose form + label, for the refine chips (§2.3/§2.4). This is
 * the ONLY place the plumbing DROP list is applied - actual-move normalization (moveAtoms) never
 * filters. Unknown commands are default-kept (§2.2): a new command surfaces as an over-broad
 * trigger candidate, never a silently-missed one. Deduped by exact atom text, first-seen order. */
export function candidateAtoms(
  move: string,
  map: MapLike
): Array<{ exact: string; any: string | null; label: string }> {
  const seen = new Set<string>();
  const result: Array<{ exact: string; any: string | null; label: string }> = [];
  for (const c of parseCommandLine(move)) {
    if (PLUMBING_DROP.has(c.command)) {
      continue;
    }
    const canonicalArgs = canonicalizeArgs(c.command, c.args, map);
    const exact = encodeAtom(c.command, canonicalArgs);
    if (seen.has(exact)) {
      continue;
    }
    seen.add(exact);
    result.push({ exact, any: looseAtom(c.command, canonicalArgs), label: describeCommand(c.command, c.args) });
  }
  return result;
}

/** A stored atom (exact, or loose with a trailing "*") matches an actual atom when the command
 * matches and every stored position before a trailing "*" equals the actual one there (§2.4) - a
 * trailing "*" leaves everything from that position on unconstrained, otherwise every position must
 * match exactly, including the argument count. Exported so the refine/leech-config UI's own
 * "would have fired" preview (§8.3/§8.4) can reuse the exact same comparison instead of a second,
 * potentially drifting copy. */
export function atomMatches(stored: string, actual: string): boolean {
  const s = stored.split(":");
  const a = actual.split(":");
  if (s[0] !== a[0]) {
    return false;
  }
  if (s[s.length - 1] === "*") {
    for (let i = 1; i < s.length - 1; i++) {
      if (s[i] !== a[i]) {
        return false;
      }
    }
    return true;
  }
  return s.length === a.length && s.every((part, i) => part === a[i]);
}

/** §2.6 - the leading integer of a "<N>pw" arg, e.g. "2pw" -> 2. */
function leadingPowerAmount(arg: string | undefined): number | null {
  const amount = parseInt(arg ?? "", 10);
  return Number.isNaN(amount) ? null : amount;
}

/** §2.6 - a leech trigger's own scan of ONE move already known to belong to the owner's own watched
 * seat: does it contain a charge/decline atom meeting the trigger's mode/threshold? Returns the
 * matched atom text (also what the notice renders) or null. */
function leechMatch(move: SeatedMove, config: LeechConfig, map: MapLike): string | null {
  for (const atom of moveAtoms(move.move, map)) {
    const [command, arg] = atom.split(":");
    if (command !== "charge" && (command !== "decline" || config.mode !== "offered")) {
      continue;
    }
    const amount = leadingPowerAmount(arg);
    if (amount !== null && amount >= config.minPower) {
      return atom;
    }
  }
  return null;
}

/** §2 - the one decision function. Scans committed moves in chronological order and, for each,
 * checks every armed trigger whose watched seat played it and whose arm-time is behind it; returns
 * the first (move, trigger) pair that matches, or null. Chronological-move-first order is what
 * makes "whichever matches first" mean what actually happened first in the game, not merely
 * whichever trigger happens to sit first in the caller's array. */
export function matchCancelTriggers(
  triggers: CancelTriggerRow[],
  moves: SeatedMove[],
  map: MapLike
): { trigger: CancelTriggerRow; matchedMove: SeatedMove; atom: string } | null {
  const orderedMoves = [...moves].sort((a, b) => a.seq - b.seq);
  for (const move of orderedMoves) {
    for (const trigger of triggers) {
      if (move.seat !== trigger.watchedSeat || move.seq <= trigger.armedFromMoveCount) {
        continue;
      }
      if (trigger.kind === "leech") {
        const atom = leechMatch(move, trigger.config as LeechConfig, map);
        if (atom) {
          return { trigger, matchedMove: move, atom };
        }
        continue;
      }
      const actualAtoms = moveAtoms(move.move, map);
      for (const stored of trigger.atoms) {
        const hit = actualAtoms.find((actual) => atomMatches(stored, actual));
        if (hit) {
          return { trigger, matchedMove: move, atom: hit };
        }
      }
    }
  }
  return null;
}
