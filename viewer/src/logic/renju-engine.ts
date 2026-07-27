// A real gomoku engine for the renju face's advantage bar - the counterpart of the chess face's
// Stockfish worker (logic/chess-evaluation.ts), except there is no third-party gomoku engine to
// bolt on, so the search lives here.
//
// Why this shape:
//   * Chess gets its bar from a genuine alpha-beta search. A hand-waved "count some patterns" score
//     would move the renju bar around without ever being right about the thing that decides a
//     gomoku game - a forced sequence of fours and open threes - so this file does the same kind of
//     search chess does, just sized for a 15x15 board.
//   * The whole engine is pure and synchronous, with an explicit node budget, so the UI layer can
//     slice it across animation frames (logic/renju-evaluation.ts) without a Web Worker. That
//     matters: this project builds with vue-cli 4 / webpack 4, where an extra worker entry is a
//     build-config change; a node-budgeted pure function is not.
//   * Everything obeys the board's actual house rule (see logic/renju.ts): a line of EXACTLY five
//     wins, an overline of six or more does not. That rule is not cosmetic here - it changes which
//     moves are wins, so it's enforced in the terminal detection AND in the pattern weights.
//
// The evaluation has two layers, the same split any strong gomoku program uses:
//   1. A static score built from every 5-in-a-row "window" on the board. A window that holds only
//      one colour's stones is a live threat worth `PATTERN_WEIGHTS[count]`; a window holding both
//      colours is dead and worth nothing. Counting windows rather than runs is what makes broken
//      shapes (`XX.X`) and open-vs-closed shapes fall out for free: an open three sits inside three
//      live windows, a blocked three inside only one.
//   2. An alpha-beta search over the small set of moves that are actually relevant (empty points
//      within two intersections of a stone), with exact tactical shortcuts at every node - if I
//      have a five, I win; if my opponent has two, I've lost; if they have exactly one, my only
//      move is to block it. Plus a VCF (victory-by-continuous-four) search that follows forcing
//      four sequences far deeper than the main search's depth, which is where gomoku games are
//      really decided.

import { RENJU_CELLS, RENJU_SIZE, Stone } from "./renju";

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export type Player = typeof BLACK | typeof WHITE;

/**
 * A decided line is worth this much, minus the number of stones still to be played before the
 * winning one lands - so a faster win always outranks a slower one, and `winInPlies` reads as
 * "this many more stones hit the board". 0 means the game is already over.
 */
export const WIN_SCORE = 1_000_000_000;
/** Any |score| at least this large is a proven win/loss rather than a positional judgement. */
export const WIN_THRESHOLD = WIN_SCORE - 10_000;

/**
 * What one live 5-window is worth, indexed by how many of the mover's stones are already in it.
 * The ratios matter far more than the absolute numbers: a four must dominate any number of threes,
 * and a three any number of twos, because a single four is a forcing move and a stack of twos is
 * not.
 */
export const PATTERN_WEIGHTS = [0, 1, 12, 180, 3600, 1_000_000];

export function opponentOf(player: Player): Player {
  return player === BLACK ? WHITE : BLACK;
}

export function playerOfStone(stone: Stone): Player {
  return stone === "b" ? BLACK : WHITE;
}

export function toCells(board: string): Int8Array {
  const cells = new Int8Array(RENJU_CELLS);
  for (let index = 0; index < RENJU_CELLS; index++) {
    const value = board.charAt(index);
    cells[index] = value === "b" ? BLACK : value === "w" ? WHITE : EMPTY;
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Window tables, built once at module load.
//
// A "window" is five consecutive intersections in one of the four directions - the only shapes a
// five can ever occupy. Each window also remembers the intersection just before and just after it
// (-1 off-board), which is what makes the exactly-five rule cheap to enforce: a window that would
// complete into a six is worth nothing.
// ---------------------------------------------------------------------------

const DIRECTIONS: [number, number][] = [
  [1, 0], // -
  [0, 1], // |
  [1, 1], // \
  [1, -1], // /
];

function cellAt(column: number, row: number): number {
  return column < 0 || column >= RENJU_SIZE || row < 0 || row >= RENJU_SIZE ? -1 : row * RENJU_SIZE + column;
}

const windowCells: number[][] = [];
const windowBefore: number[] = [];
const windowAfter: number[] = [];

for (const [dx, dy] of DIRECTIONS) {
  for (let row = 0; row < RENJU_SIZE; row++) {
    for (let column = 0; column < RENJU_SIZE; column++) {
      const last = cellAt(column + dx * 4, row + dy * 4);
      if (last < 0) {
        continue;
      }
      const cells: number[] = [];
      for (let step = 0; step < 5; step++) {
        cells.push(cellAt(column + dx * step, row + dy * step));
      }
      windowCells.push(cells);
      windowBefore.push(cellAt(column - dx, row - dy));
      windowAfter.push(cellAt(column + dx * 5, row + dy * 5));
    }
  }
}

export const WINDOW_COUNT = windowCells.length;

const WINDOW_CELLS = new Int16Array(WINDOW_COUNT * 5);
const WINDOW_BEFORE = new Int16Array(WINDOW_COUNT);
const WINDOW_AFTER = new Int16Array(WINDOW_COUNT);
for (let w = 0; w < WINDOW_COUNT; w++) {
  for (let slot = 0; slot < 5; slot++) {
    WINDOW_CELLS[w * 5 + slot] = windowCells[w][slot];
  }
  WINDOW_BEFORE[w] = windowBefore[w];
  WINDOW_AFTER[w] = windowAfter[w];
}

/** Windows this intersection is a member of - the ones whose stone counts change when it's played. */
const MEMBER_WINDOWS: Int16Array[] = [];
/** Member windows plus the ones this intersection flanks - the ones whose VALUE can change. */
const TOUCHED_WINDOWS: Int16Array[] = [];
{
  const members: number[][] = Array.from({ length: RENJU_CELLS }, () => []);
  const touched: number[][] = Array.from({ length: RENJU_CELLS }, () => []);
  for (let w = 0; w < WINDOW_COUNT; w++) {
    for (let slot = 0; slot < 5; slot++) {
      const cell = WINDOW_CELLS[w * 5 + slot];
      members[cell].push(w);
      touched[cell].push(w);
    }
    for (const flank of [WINDOW_BEFORE[w], WINDOW_AFTER[w]]) {
      if (flank >= 0) {
        touched[flank].push(w);
      }
    }
  }
  for (let cell = 0; cell < RENJU_CELLS; cell++) {
    MEMBER_WINDOWS.push(Int16Array.from(members[cell]));
    TOUCHED_WINDOWS.push(Int16Array.from(touched[cell]));
  }
}

/** Intersections within Chebyshev distance 2 - the neighbourhood that makes a point worth playing. */
const NEIGHBOURHOOD: Int16Array[] = [];
for (let cell = 0; cell < RENJU_CELLS; cell++) {
  const column = cell % RENJU_SIZE;
  const row = Math.floor(cell / RENJU_SIZE);
  const near: number[] = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const neighbour = cellAt(column + dx, row + dy);
      if (neighbour >= 0) {
        near.push(neighbour);
      }
    }
  }
  NEIGHBOURHOOD.push(Int16Array.from(near));
}

// ---------------------------------------------------------------------------
// Position: the board plus every derived quantity the search needs, all maintained incrementally
// so making and unmaking a move costs a few dozen array writes instead of a full rescan.
// ---------------------------------------------------------------------------

export class Position {
  readonly cells: Int8Array;
  /** Per-window stone counts, indexed [window] for black and white respectively. */
  private readonly blackInWindow: Int8Array;
  private readonly whiteInWindow: Int8Array;
  /** How many stones sit within distance 2 of each intersection (the candidate-move test). */
  private readonly nearbyStones: Int8Array;
  /**
   * Windows holding exactly four of one colour and none of the other - the only windows that can
   * produce an immediate five. Maintained incrementally because winningMoves() is called twice per
   * search node, and rescanning all ~570 windows there dominated everything else.
   */
  private readonly blackFourWindows = new Set<number>();
  private readonly whiteFourWindows = new Set<number>();
  private blackScore = 0;
  private whiteScore = 0;
  private stones = 0;

  constructor(cells: Int8Array) {
    this.cells = new Int8Array(cells);
    this.blackInWindow = new Int8Array(WINDOW_COUNT);
    this.whiteInWindow = new Int8Array(WINDOW_COUNT);
    this.nearbyStones = new Int8Array(RENJU_CELLS);
    for (let w = 0; w < WINDOW_COUNT; w++) {
      for (let slot = 0; slot < 5; slot++) {
        const value = this.cells[WINDOW_CELLS[w * 5 + slot]];
        if (value === BLACK) {
          this.blackInWindow[w]++;
        } else if (value === WHITE) {
          this.whiteInWindow[w]++;
        }
      }
    }
    for (let cell = 0; cell < RENJU_CELLS; cell++) {
      if (this.cells[cell] !== EMPTY) {
        this.stones++;
        const near = NEIGHBOURHOOD[cell];
        for (let i = 0; i < near.length; i++) {
          this.nearbyStones[near[i]]++;
        }
      }
    }
    for (let w = 0; w < WINDOW_COUNT; w++) {
      this.blackScore += this.windowValue(w, BLACK);
      this.whiteScore += this.windowValue(w, WHITE);
      this.trackFourWindow(w);
    }
  }

  /** Keeps the four-window sets in step with this window's current stone counts. */
  private trackFourWindow(w: number) {
    const black = this.blackInWindow[w];
    const white = this.whiteInWindow[w];
    if (black === 4 && white === 0) {
      this.blackFourWindows.add(w);
    } else {
      this.blackFourWindows.delete(w);
    }
    if (white === 4 && black === 0) {
      this.whiteFourWindows.add(w);
    } else {
      this.whiteFourWindows.delete(w);
    }
  }

  get stoneCount(): number {
    return this.stones;
  }

  /** Black opens, so black is to move exactly while the colours are level. */
  get sideToMove(): Player {
    let black = 0;
    let white = 0;
    for (let cell = 0; cell < RENJU_CELLS; cell++) {
      if (this.cells[cell] === BLACK) {
        black++;
      } else if (this.cells[cell] === WHITE) {
        white++;
      }
    }
    return black === white ? BLACK : WHITE;
  }

  /**
   * What one window is worth to `player` right now. Zero if the opponent has poisoned it, or if
   * filling it would produce an overline (which this board's rules say is NOT a win) - that guard
   * is why windows track their flanking intersections at all.
   */
  private windowValue(w: number, player: Player): number {
    const mine = player === BLACK ? this.blackInWindow[w] : this.whiteInWindow[w];
    const theirs = player === BLACK ? this.whiteInWindow[w] : this.blackInWindow[w];
    if (mine === 0 || theirs > 0) {
      return 0;
    }
    if (mine >= 4) {
      const before = WINDOW_BEFORE[w];
      const after = WINDOW_AFTER[w];
      if ((before >= 0 && this.cells[before] === player) || (after >= 0 && this.cells[after] === player)) {
        return 0; // completing this window makes six or more, which does not win here
      }
    }
    return PATTERN_WEIGHTS[mine];
  }

  place(index: number, player: Player) {
    const touched = TOUCHED_WINDOWS[index];
    for (let i = 0; i < touched.length; i++) {
      const w = touched[i];
      this.blackScore -= this.windowValue(w, BLACK);
      this.whiteScore -= this.windowValue(w, WHITE);
    }
    this.cells[index] = player;
    const members = MEMBER_WINDOWS[index];
    for (let i = 0; i < members.length; i++) {
      if (player === BLACK) {
        this.blackInWindow[members[i]]++;
      } else {
        this.whiteInWindow[members[i]]++;
      }
    }
    for (let i = 0; i < touched.length; i++) {
      const w = touched[i];
      this.blackScore += this.windowValue(w, BLACK);
      this.whiteScore += this.windowValue(w, WHITE);
      this.trackFourWindow(w);
    }
    const near = NEIGHBOURHOOD[index];
    for (let i = 0; i < near.length; i++) {
      this.nearbyStones[near[i]]++;
    }
    this.stones++;
  }

  undo(index: number) {
    const value = this.cells[index];
    if (value === EMPTY) {
      return;
    }
    const player = value as Player;
    const touched = TOUCHED_WINDOWS[index];
    for (let i = 0; i < touched.length; i++) {
      const w = touched[i];
      this.blackScore -= this.windowValue(w, BLACK);
      this.whiteScore -= this.windowValue(w, WHITE);
    }
    this.cells[index] = EMPTY;
    const members = MEMBER_WINDOWS[index];
    for (let i = 0; i < members.length; i++) {
      if (player === BLACK) {
        this.blackInWindow[members[i]]--;
      } else {
        this.whiteInWindow[members[i]]--;
      }
    }
    for (let i = 0; i < touched.length; i++) {
      const w = touched[i];
      this.blackScore += this.windowValue(w, BLACK);
      this.whiteScore += this.windowValue(w, WHITE);
      this.trackFourWindow(w);
    }
    const near = NEIGHBOURHOOD[index];
    for (let i = 0; i < near.length; i++) {
      this.nearbyStones[near[i]]--;
    }
    this.stones--;
  }

  /** The static score from `player`'s point of view: my live shapes minus theirs. */
  score(player: Player): number {
    return player === BLACK ? this.blackScore - this.whiteScore : this.whiteScore - this.blackScore;
  }

  /**
   * Empty intersections worth considering: everything within two steps of a stone. On an empty
   * board that set is empty, so the centre point is offered instead.
   */
  candidates(): number[] {
    const moves: number[] = [];
    for (let cell = 0; cell < RENJU_CELLS; cell++) {
      if (this.cells[cell] === EMPTY && this.nearbyStones[cell] > 0) {
        moves.push(cell);
      }
    }
    if (moves.length === 0) {
      moves.push(Math.floor(RENJU_CELLS / 2));
    }
    return moves;
  }

  /**
   * Every empty intersection where `player` would complete a five right now - the exact, rules-
   * accurate set of immediate wins. A window holding four of `player`'s stones and nothing else has
   * exactly one empty intersection, and that intersection is the win, unless a flanking stone would
   * turn the five into a forbidden overline.
   */
  winningMoves(player: Player): number[] {
    const fourWindows = player === BLACK ? this.blackFourWindows : this.whiteFourWindows;
    const wins: number[] = [];
    for (const w of fourWindows) {
      const before = WINDOW_BEFORE[w];
      const after = WINDOW_AFTER[w];
      if ((before >= 0 && this.cells[before] === player) || (after >= 0 && this.cells[after] === player)) {
        continue; // would be an overline, which does not win
      }
      for (let slot = 0; slot < 5; slot++) {
        const cell = WINDOW_CELLS[w * 5 + slot];
        if (this.cells[cell] === EMPTY) {
          if (wins.indexOf(cell) === -1) {
            wins.push(cell);
          }
          break;
        }
      }
    }
    return wins;
  }

  /**
   * How much the static score improves for `player` if they play `cell` - the move-ordering key.
   * Deliberately read-only: computing it by actually placing and unplacing the stone was the single
   * most expensive thing the search did, and only the windows this intersection belongs to can
   * change. (The overline guard is skipped here; ordering does not have to be exact, and the search
   * itself re-checks every line against the real rule.)
   */
  moveGain(cell: number, player: Player): number {
    const mineInWindow = player === BLACK ? this.blackInWindow : this.whiteInWindow;
    const theirsInWindow = player === BLACK ? this.whiteInWindow : this.blackInWindow;
    const windows = MEMBER_WINDOWS[cell];
    let gain = 0;
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      if (theirsInWindow[w] > 0) {
        continue; // dead window: worth nothing before or after
      }
      const mine = mineInWindow[w];
      gain += PATTERN_WEIGHTS[mine + 1] - PATTERN_WEIGHTS[mine];
    }
    return gain;
  }

  /** Whether `player` already has an exactly-five on the board (the game is over). */
  hasFive(player: Player): boolean {
    const mineInWindow = player === BLACK ? this.blackInWindow : this.whiteInWindow;
    for (let w = 0; w < WINDOW_COUNT; w++) {
      if (mineInWindow[w] !== 5) {
        continue;
      }
      const before = WINDOW_BEFORE[w];
      const after = WINDOW_AFTER[w];
      if ((before >= 0 && this.cells[before] === player) || (after >= 0 && this.cells[after] === player)) {
        continue; // an overline is not a five
      }
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchOptions {
  /** Plies of full-width search (tactical extensions can go deeper). */
  maxDepth: number;
  /** Hard cap on visited nodes; the search abandons the current depth once it's spent. */
  nodeBudget: number;
  /** How many plies of forcing-four sequences to follow. 0 disables VCF. */
  vcfDepth?: number;
  /** Candidate moves kept at the root and at inner nodes respectively. */
  rootWidth?: number;
  innerWidth?: number;
}

export interface SearchResult {
  /** Score from BLACK's point of view. */
  score: number;
  depth: number;
  nodes: number;
  /** Set when the search proved a win: who wins, and in how many plies from this position. */
  winner: Player | null;
  winInPlies: number | null;
  /** True when the node budget cut the search short before finishing `depth`. */
  exhausted: boolean;
}

const ABORTED = { aborted: true };

class SearchContext {
  nodes = 0;
  constructor(readonly budget: number) {}
  tick() {
    if (++this.nodes > this.budget) {
      throw ABORTED;
    }
  }
}

/**
 * VCF: can `player` force a win using only moves that make a four? Every four forces the opponent
 * to answer on the single completing point, so these lines are extremely narrow and can be followed
 * far deeper than the main search. Returns the number of plies to the win, or null.
 */
function victoryByContinuousFour(
  position: Position,
  player: Player,
  depth: number,
  context: SearchContext
): number | null {
  context.tick();
  const opponent = opponentOf(player);
  if (position.winningMoves(player).length > 0) {
    return 1;
  }
  if (depth <= 0) {
    return null;
  }
  // If the opponent is already threatening a five, our "forcing" moves are not forcing at all -
  // they'd simply lose to it. Blocking is not part of a VCF, so give up on this line.
  if (position.winningMoves(opponent).length > 0) {
    return null;
  }

  for (const move of forcingCandidates(position, player)) {
    context.tick(); // each trial placement costs real work, so it counts against the budget
    position.place(move, player);
    const fivePoints = position.winningMoves(player);
    if (fivePoints.length === 0) {
      position.undo(move); // the gain filter let this through but it makes no five point
      continue;
    }
    if (fivePoints.length > 1) {
      position.undo(move);
      // Two completing points: they block one (stone 2) and I finish on the other (stone 3). The
      // opponent cannot escape by counter-attacking, because the entry check above already proved
      // they have no five of their own to race me with.
      return 3;
    }
    const block = fivePoints[0];
    position.place(block, opponent);
    // The forced block may itself complete the opponent's own five, which ends the game in their
    // favour instead - that line is not a win for us.
    const blockWins = position.hasFive(opponent);
    const deeper = blockWins ? null : victoryByContinuousFour(position, player, depth - 2, context);
    position.undo(block);
    position.undo(move);
    if (deeper !== null) {
      return deeper + 2;
    }
  }
  return null;
}

/**
 * Orders candidate moves by what the point is worth to the mover, plus most of what it is worth to
 * the opponent - the strongest move in gomoku is very often the one that kills the other side's
 * shape rather than the one that builds your own.
 */
function orderedMoves(position: Position, player: Player, width: number): number[] {
  const opponent = opponentOf(player);
  // Ordering matters even when nothing is trimmed: alpha-beta prunes far more when the best move is
  // tried first.
  return position
    .candidates()
    .map((move) => ({ move, value: position.moveGain(move, player) + position.moveGain(move, opponent) * 0.85 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, width)
    .map((entry) => entry.move);
}

/**
 * The only moves a VCF ever needs to try: those that could complete a four. A four-making move must
 * land in a window that already holds three of my stones and none of theirs, so its ordering gain
 * is at least the three-to-four step - a cheap, exact filter that keeps the forcing search narrow.
 */
const FOUR_GAIN = PATTERN_WEIGHTS[4] - PATTERN_WEIGHTS[3];

function forcingCandidates(position: Position, player: Player): number[] {
  return position.candidates().filter((move) => position.moveGain(move, player) >= FOUR_GAIN);
}

function negamax(
  position: Position,
  player: Player,
  depth: number,
  ply: number,
  alpha: number,
  beta: number,
  options: SearchOptions,
  context: SearchContext
): number {
  context.tick();
  const opponent = opponentOf(player);

  // Exact tactics first, at every node including leaves - a search that stops one ply before a five
  // is worse than no search at all.
  const myWins = position.winningMoves(player);
  if (myWins.length > 0) {
    return WIN_SCORE - (ply + 1); // I place the winning stone next
  }
  const theirWins = position.winningMoves(opponent);
  if (theirWins.length > 1) {
    // Two five-points and only one block available: I move, then they finish.
    return -(WIN_SCORE - (ply + 2));
  }

  let moves: number[];
  if (theirWins.length === 1) {
    // Forced: block, or lose. Extend past the nominal depth - the reply is free of branching.
    if (ply >= options.maxDepth + 12) {
      return position.score(player);
    }
    moves = theirWins;
  } else {
    if (depth <= 0) {
      return position.score(player);
    }
    moves = orderedMoves(position, player, ply === 0 ? options.rootWidth ?? 20 : options.innerWidth ?? 10);
  }

  let best = -Infinity;
  for (const move of moves) {
    position.place(move, player);
    const value = -negamax(
      position,
      opponent,
      theirWins.length === 1 ? depth : depth - 1,
      ply + 1,
      -beta,
      -alpha,
      options,
      context
    );
    position.undo(move);
    if (value > best) {
      best = value;
    }
    if (best > alpha) {
      alpha = best;
    }
    if (alpha >= beta) {
      break;
    }
  }
  return best;
}

function decidedResult(score: number, depth: number, nodes: number, exhausted: boolean): SearchResult {
  const decided = Math.abs(score) >= WIN_THRESHOLD;
  return {
    score,
    depth,
    nodes,
    winner: decided ? (score > 0 ? BLACK : WHITE) : null,
    winInPlies: decided ? WIN_SCORE - Math.abs(score) : null,
    exhausted,
  };
}

/**
 * Iterative deepening, one root move at a time.
 *
 * The unit of work is deliberately a single root move rather than a whole depth: at the settings
 * this ships with, a full depth-6 pass takes a couple of hundred milliseconds, which is a visible
 * stutter if it runs in one go, while one root child is a handful of milliseconds. That's what lets
 * the UI layer run a genuine search on the main thread without a Web Worker - it just calls step()
 * until it wants to yield.
 *
 * `result` is always readable and always reflects the deepest FULLY completed pass, so a search cut
 * short by the node budget degrades to a shallower answer instead of no answer.
 */
export class IterativeSearch {
  private readonly perspective: number;
  private readonly opponent: Player;
  private depth = 2;
  private rootMoves: number[] | null = null;
  private rootIndex = 0;
  private alpha = -Infinity;
  private bestThisDepth = -Infinity;
  private score: number;
  private completedDepth = 0;
  private nodes = 0;
  private exhausted = false;
  private done = false;
  private vcfPending: boolean;

  constructor(
    private readonly position: Position,
    private readonly sideToMove: Player,
    private readonly options: SearchOptions
  ) {
    this.perspective = sideToMove === BLACK ? 1 : -1;
    this.opponent = opponentOf(sideToMove);
    this.score = position.score(sideToMove) * this.perspective;
    this.vcfPending = (options.vcfDepth ?? 0) > 0;

    // A position that is already decided needs no search at all.
    if (position.hasFive(BLACK) || position.hasFive(WHITE)) {
      this.score = position.hasFive(BLACK) ? WIN_SCORE : -WIN_SCORE;
      this.done = true;
      this.vcfPending = false;
    }
  }

  get finished(): boolean {
    return this.done;
  }

  get result(): SearchResult {
    return decidedResult(this.score, this.completedDepth, this.nodes, this.exhausted);
  }

  /** Does one slice of work. Returns false once there is nothing left to do. */
  step(): boolean {
    if (this.done) {
      return false;
    }
    if (this.depth > this.options.maxDepth) {
      this.runVictoryByContinuousFour();
      this.done = true;
      return false;
    }
    if (this.rootMoves === null && !this.beginDepth()) {
      return !this.done;
    }
    this.searchOneRootMove();
    return !this.done;
  }

  /** Runs the whole search to completion. */
  run(): SearchResult {
    while (this.step()) {
      // one root move per iteration
    }
    return this.result;
  }

  private remainingBudget(): number {
    return Math.max(1, this.options.nodeBudget - this.nodes);
  }

  /** Sets up a new depth, resolving the root's own tactics first. Returns false if it finished. */
  private beginDepth(): boolean {
    const myWins = this.position.winningMoves(this.sideToMove);
    if (myWins.length > 0) {
      this.score = (WIN_SCORE - 1) * this.perspective;
      this.completedDepth = Math.max(this.completedDepth, 1);
      this.done = true;
      return false;
    }
    const theirWins = this.position.winningMoves(this.opponent);
    if (theirWins.length > 1) {
      this.score = -(WIN_SCORE - 2) * this.perspective;
      this.completedDepth = Math.max(this.completedDepth, 1);
      this.done = true;
      return false;
    }
    // A single five-point has to be blocked; everything else is a normal ordered move list.
    this.rootMoves =
      theirWins.length === 1 ? theirWins : orderedMoves(this.position, this.sideToMove, this.options.rootWidth ?? 20);
    this.rootIndex = 0;
    this.alpha = -Infinity;
    this.bestThisDepth = -Infinity;
    return true;
  }

  private searchOneRootMove() {
    const moves = this.rootMoves as number[];
    const move = moves[this.rootIndex++];
    const context = new SearchContext(this.remainingBudget());
    let value: number;
    this.position.place(move, this.sideToMove);
    try {
      value = -negamax(
        this.position,
        this.opponent,
        this.depth - 1,
        1,
        -Infinity,
        -this.alpha,
        { ...this.options, maxDepth: this.depth },
        context
      );
    } catch (error) {
      this.position.undo(move);
      this.nodes += context.nodes;
      if (error !== ABORTED) {
        throw error;
      }
      // Out of budget mid-move: keep the deepest completed depth and stop deepening, but still let
      // the (cheap, narrow) forcing search have its say.
      this.exhausted = true;
      this.runVictoryByContinuousFour();
      this.done = true;
      return;
    }
    this.position.undo(move);
    this.nodes += context.nodes;

    if (value > this.bestThisDepth) {
      this.bestThisDepth = value;
    }
    if (value > this.alpha) {
      this.alpha = value;
    }
    if (this.rootIndex < moves.length) {
      return; // more root moves at this depth
    }

    this.score = this.bestThisDepth * this.perspective;
    this.completedDepth = this.depth;
    this.rootMoves = null;
    if (Math.abs(this.bestThisDepth) >= WIN_THRESHOLD) {
      this.vcfPending = false; // already proven; a deeper search cannot improve on it
      this.done = true;
      return;
    }
    this.depth += 2;
  }

  /**
   * The main search is wide but shallow; VCF is narrow and deep, and finds the forcing wins a
   * depth-6 search cannot reach. Only the side to move is checked: a forcing sequence belonging to
   * the player who does NOT have the move is not a proven win at all, because their opponent moves
   * first and can break it up. (Same asymmetry a chess engine's "mate in N" has.)
   */
  private runVictoryByContinuousFour() {
    if (!this.vcfPending || Math.abs(this.score) >= WIN_THRESHOLD) {
      return;
    }
    this.vcfPending = false;
    const context = new SearchContext(this.remainingBudget());
    try {
      const plies = victoryByContinuousFour(this.position, this.sideToMove, this.options.vcfDepth ?? 0, context);
      if (plies !== null) {
        this.score = (WIN_SCORE - plies) * this.perspective;
      }
    } catch (error) {
      if (error !== ABORTED) {
        throw error;
      }
      this.exhausted = true;
    }
    this.nodes += context.nodes;
  }
}

/**
 * Searches one position to `options.maxDepth`, or as deep as the node budget allows, and reports
 * the result from BLACK's point of view.
 */
export function searchPosition(position: Position, sideToMove: Player, options: SearchOptions): SearchResult {
  return new IterativeSearch(position, sideToMove, options).run();
}

/** Convenience wrapper: search straight from a board string. */
export function analyzeBoard(board: string, sideToMove: Player, options: SearchOptions): SearchResult {
  return searchPosition(new Position(toCells(board)), sideToMove, options);
}
