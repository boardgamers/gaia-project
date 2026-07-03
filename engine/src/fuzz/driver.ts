/**
 * FUZZER_PLAN.md §2 — game loop: init -> loop(generate, move, oracles) -> EndGame.
 *
 * Per game: clone options (§0 — the engine mutates the options object it's given),
 * `new Engine([init n seed], options)`, then loop: `generateAvailableCommandsIfNeeded()` →
 * random-player → `move()` → oracles. Hard cap on total lines so a stuck game is a
 * termination failure, not a hang. Every game records `{seed, options, moves}` so ANY
 * failure replays exactly.
 *
 * Line construction mirrors the real hosts (`viewer/src/self-contained.ts`, `move/auto.ts`):
 * a turn line is built incrementally against a copy of the committed engine; the copy is
 * committed only when `newTurn` is true (§J1). If playing an offered command throws, that is
 * itself a tier-1 finding (the generator only ever plays what the engine offered).
 */
import Engine, { EngineOptions } from "../engine";
import { chooseMovePart, GeneratorError, isConversionPart, PlayContext } from "./random-player";
import { conservationOracles } from "./oracles/conservation";
import { determinismMessages, runOracles, structuralOracles } from "./oracles/structural";
import { Oracle, OracleContext, OracleFailure } from "./oracles/types";
import { cloneEngine, cloneOptions } from "./state";
import { Rng, rngFromString } from "./rng";

export interface FuzzGameSpec {
  /** Engine seed (board/tiles randomization). */
  gameSeed: string;
  /** Fuzzer-side seed for move choices; defaults to gameSeed. */
  playSeed?: string;
  players: number;
  lostFleet: boolean;
}

export interface FuzzGameOptions {
  /** Hard cap on committed lines; exceeding it is a termination failure. */
  maxLines?: number;
  /** Cap on dot-separated parts within one line. */
  maxPartsPerLine?: number;
  /** Retries (fresh randomness) when a line runs into a DeadEnd / cannot complete. */
  maxLineRetries?: number;
  /** Run the determinism checks every N committed lines (0 = only at game end). */
  checkpointEvery?: number;
  /** Extra oracles (tier 2/3) on top of the always-on tier-1 structural set. */
  oracles?: Oracle[];
}

export interface FuzzGameResult {
  spec: FuzzGameSpec;
  /** Pristine options to replay with (never handed to an engine). */
  options: EngineOptions;
  /** Committed raw move lines, starting with the init line. Replaying these reproduces the game. */
  moves: string[];
  finished: boolean;
  failures: OracleFailure[];
  /** Line that was being played when a playability failure occurred (if any). */
  failingLine?: string;
  rounds: number;
  deadEndRetries: number;
  engine: Engine;
}

const DEFAULTS: Required<Omit<FuzzGameOptions, "oracles">> = {
  maxLines: 1500,
  maxPartsPerLine: 25,
  maxLineRetries: 8,
  checkpointEvery: 0,
};

export function baseOptions(spec: FuzzGameSpec): EngineOptions {
  // v1 scope (plan §2): standard faction variant, no auction, no customBoardSetup, no advancedRules.
  const options: EngineOptions = { factionVariant: "standard" };
  if (spec.lostFleet) {
    options.lostFleet = true;
  }
  return options;
}

export function fuzzGame(spec: FuzzGameSpec, gameOptions: FuzzGameOptions = {}): FuzzGameResult {
  const cfg = { ...DEFAULTS, ...gameOptions };
  // Tier-1 structural + tier-2 conservation are always on; callers add tier-3 rules oracles.
  const oracles = [...structuralOracles(), ...conservationOracles(), ...(gameOptions.oracles ?? [])];
  const options = baseOptions(spec);
  const rng: Rng = rngFromString(spec.playSeed ?? spec.gameSeed);

  const initLine = `init ${spec.players} ${spec.gameSeed}`;
  const moves: string[] = [initLine];
  let engine = new Engine([initLine], cloneOptions(options));

  const result: FuzzGameResult = {
    spec,
    options,
    moves,
    finished: false,
    failures: [],
    rounds: 0,
    deadEndRetries: 0,
    engine,
  };

  const ctxFor = (current: Engine): OracleContext => ({
    engine: current,
    moves,
    options,
    players: spec.players,
    gameSeed: spec.gameSeed,
    lostFleet: spec.lostFleet,
  });

  for (const oracle of oracles) {
    oracle.startGame?.(ctxFor(engine));
  }

  let roundLines = 0;
  let lastRound = engine.round;

  while (!engine.ended && moves.length - 1 < cfg.maxLines) {
    const played = playOneLine(engine, rng, {
      roundLines,
      maxParts: cfg.maxPartsPerLine,
      maxRetries: cfg.maxLineRetries,
      players: spec.players,
    });

    result.deadEndRetries += played.deadEndRetries;

    if (played.kind === "throw") {
      result.failures.push({
        oracle: "tier1.structural.playable",
        citation: "FUZZER_PLAN.md §3 tier-1: playing an offered command never throws",
        message: `offered command threw when played: ${played.error}`,
      });
      result.failingLine = played.line;
      return result;
    }
    if (played.kind === "stuck") {
      result.failures.push({
        oracle: "tier1.structural.playable",
        citation: "FUZZER_PLAN.md §3 tier-1: every state offers a completable command sequence",
        message: `no line could be completed after ${cfg.maxLineRetries} retries (phase ${engine.phase}); last attempt: ${played.line}`,
      });
      result.failingLine = played.line;
      return result;
    }

    engine = played.engine;
    result.engine = engine;
    moves.push(played.line);

    if (engine.round !== lastRound) {
      lastRound = engine.round;
      roundLines = 0;
      result.rounds = Math.max(result.rounds, engine.round);
    } else {
      roundLines++;
    }

    const lineFailures = runOracles(oracles, ctxFor(engine), "afterLine");
    if (lineFailures.length > 0) {
      result.failures.push(...lineFailures);
      return result;
    }

    if (cfg.checkpointEvery > 0 && (moves.length - 1) % cfg.checkpointEvery === 0 && !engine.ended) {
      const messages = determinismMessages(ctxFor(engine));
      if (messages.length > 0) {
        result.failures.push(
          ...messages.map((message) => ({
            oracle: "tier1.structural.determinism",
            citation: "FUZZER_PLAN.md §3 tier-1; §J3 (deterministic from seed + moves)",
            message: `[checkpoint after line ${moves.length - 1}] ${message}`,
          }))
        );
        return result;
      }
    }
  }

  result.finished = engine.ended;

  if (!engine.ended) {
    result.failures.push({
      oracle: "tier1.structural.termination",
      citation: "FUZZER_PLAN.md §3 tier-1: games terminate within the move cap",
      message: `game did not reach EndGame within ${cfg.maxLines} lines (round ${engine.round}, phase ${engine.phase})`,
    });
    return result;
  }

  result.failures.push(...runOracles(oracles, ctxFor(engine), "atEnd"));
  return result;
}

type LinePlayResult =
  | { kind: "committed"; engine: Engine; line: string; deadEndRetries: number }
  | { kind: "throw"; error: string; line: string; deadEndRetries: number }
  | { kind: "stuck"; line: string; deadEndRetries: number };

function playOneLine(
  engine: Engine,
  rng: Rng,
  params: { roundLines: number; maxParts: number; maxRetries: number; players: number }
): LinePlayResult {
  const player = engine.playerToMove;
  const prefix = engine.player(player)?.faction ?? `p${player + 1}`;
  const snapshot = JSON.stringify(engine);
  const baseCommands = engine.generateAvailableCommandsIfNeeded();

  let deadEndRetries = 0;
  let lastAttempt = "";
  // First parts whose line ran into a forced DeadEnd. The engine deliberately offers actions
  // whose chained sub-decision can turn out to have no valid target (DeadEnd = "you have to
  // undo", enums.ts) — a real player undoes and picks something else, so the fuzzer bans that
  // first choice and retries rather than reporting the state as stuck.
  const bannedFirstParts = new Set<string>();

  for (let attempt = 0; attempt <= params.maxRetries; attempt++) {
    const parts: string[] = [];
    let copy: Engine | null = null;
    let commands = baseCommands;
    let conversions = 0;

    for (let i = 0; i < params.maxParts; i++) {
      const ctx: PlayContext = {
        rng,
        phase: (copy ?? engine).phase,
        roundLines: params.roundLines,
        conversionsInLine: conversions,
        playerCount: params.players,
      };
      let part = chooseMovePart(commands, (copy ?? engine).playerToMove, ctx);
      if (i === 0 && part !== null && bannedFirstParts.has(part)) {
        for (let reroll = 0; reroll < 20 && part !== null && bannedFirstParts.has(part); reroll++) {
          part = chooseMovePart(commands, (copy ?? engine).playerToMove, ctx);
        }
        if (part !== null && bannedFirstParts.has(part)) {
          part = null;
        }
      }
      if (part === null) {
        // Only DeadEnd (or nothing) offered mid-line: ban this line's opening choice and retry
        // with fresh randomness. Persistent across all retries => "stuck" (tier-1).
        deadEndRetries++;
        if (parts.length > 0) {
          bannedFirstParts.add(parts[0]);
        }
        break;
      }
      if (isConversionPart(part)) {
        conversions++;
      }
      parts.push(part);
      lastAttempt = `${prefix} ${parts.join(". ")}`;

      copy = cloneEngine(snapshot);
      try {
        copy.move(lastAttempt);
      } catch (err) {
        if (err instanceof GeneratorError) {
          throw err;
        }
        return { kind: "throw", error: err.message ?? String(err), line: lastAttempt, deadEndRetries };
      }

      if (copy.newTurn) {
        return { kind: "committed", engine: copy, line: lastAttempt, deadEndRetries };
      }
      commands = copy.generateAvailableCommandsIfNeeded();
    }
  }

  return { kind: "stuck", line: lastAttempt, deadEndRetries };
}
