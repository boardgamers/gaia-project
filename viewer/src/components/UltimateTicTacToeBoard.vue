<template>
  <div class="lf-ultimate" @click.stop>
    <div class="lf-ultimate-status" :class="{ over: status.over }" aria-live="polite">{{ statusLabel }}</div>

    <div
      class="lf-ultimate-eval"
      role="meter"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(evaluationXPercent)"
      :aria-valuetext="evaluationAriaText"
      :title="evaluationAriaText"
    >
      <span class="lf-ultimate-eval-x" :style="{ width: evaluationXPercent + '%' }" />
      <span class="lf-ultimate-eval-o" />
    </div>

    <div ref="stage" class="lf-ultimate-stage">
      <div
        class="lf-ultimate-board"
        :style="boardSize === null ? undefined : { width: boardSize + 'px', height: boardSize + 'px' }"
        role="grid"
        aria-label="Ultimate tic-tac-toe board"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @pointermove="onPointerMove"
        @pointerleave="cancelLongPress"
        @pointercancel="cancelLongPress"
        @contextmenu.prevent
      >
        <div
          v-for="mini in miniBoards"
          :key="mini.index"
          class="lf-ultimate-mini"
          :class="{
            valid: validBoardSet.has(mini.index),
            dimmed: isDimmed(mini.index),
            resolved: mini.resolution !== null,
          }"
          role="rowgroup"
          :aria-label="miniBoardAriaLabel(mini)"
        >
          <button
            v-for="cell in mini.cells"
            :key="cell.index"
            type="button"
            class="lf-ultimate-cell"
            :class="[
              cell.mark,
              {
                last: cell.index === lastMove,
                playable: canPlace(cell.index),
              },
            ]"
            role="gridcell"
            :style="markFontStyle"
            :disabled="!canPlace(cell.index)"
            :aria-label="cellAriaLabel(cell.index)"
            @click="onCellClick(cell.index)"
          >
            {{ cell.mark ? cell.mark.toUpperCase() : "" }}
          </button>
          <div
            v-if="mini.resolution !== null"
            class="lf-ultimate-mini-result"
            :class="mini.resolution"
            :style="resultFontStyle"
            aria-hidden="true"
          >
            {{ mini.resolution === "draw" ? "–" : mini.resolution.toUpperCase() }}
          </div>
        </div>
      </div>

      <div v-if="showResetConfirm" class="lf-ultimate-overlay" @click.self="showResetConfirm = false">
        <div class="lf-ultimate-confirm">
          <div class="lf-ultimate-confirm-text">Reset Ultimate tic-tac-toe?</div>
          <div class="lf-ultimate-confirm-actions">
            <button type="button" class="lf-ultimate-btn" @click="showResetConfirm = false">Cancel</button>
            <button type="button" class="lf-ultimate-btn danger" @click="confirmReset">Reset</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Watch } from "vue-property-decorator";
import { PANEL_SWIPE_EVENT } from "../logic/panel-swipe";
import {
  offlineMinigameGameId,
  queueOfflineMinigameOp,
  readOfflineMinigameMirror,
} from "../logic/offline-minigame-sync";
import {
  UltimateEvaluation,
  UltimateEvaluator,
  ultimateEvaluationDescription,
} from "../logic/ultimate-tic-tac-toe-evaluation";
import { UltimateTicTacToeBackend, UltimateTicTacToeRow } from "../logic/ultimate-tic-tac-toe-backend";
import {
  EMPTY_ULTIMATE_BOARD,
  MiniResolution,
  ULTIMATE_CELLS,
  UltimateBoardStatus,
  UltimateMark,
  isLegalUltimateMove,
  isValidUltimateBoard,
  localUltimateStorageKey,
  markAt,
  miniBoardResolutions,
  parseUltimateLocalState,
  placeUltimateMark,
  turnForUltimateBoard,
  ultimateBoardStatus,
  ultimateCellIndex,
  validMiniBoards,
} from "../logic/ultimate-tic-tac-toe";

interface UltimateCell {
  index: number;
  mark: UltimateMark | null;
}

interface UltimateMiniBoard {
  index: number;
  resolution: MiniResolution;
  cells: UltimateCell[];
}

@Component
export default class UltimateTicTacToeBoard extends Vue {
  private unsubscribe: (() => void) | null = null;
  private evaluator: UltimateEvaluator | null = null;
  private boardResizeObserver: ResizeObserver | null = null;
  private pressTimer: number | null = null;
  private pressStart: { x: number; y: number } | null = null;
  private suppressClick = false;

  board = EMPTY_ULTIMATE_BOARD;
  lastMove: number | null = null;
  showResetConfirm = false;
  evaluation: UltimateEvaluation | null = null;
  boardSize: number | null = null;

  xUser: string | null = null;
  xUser2: string | null = null;
  oUser: string | null = null;
  oUser2: string | null = null;
  xNextUser: string | null = null;
  oNextUser: string | null = null;
  myUserId: string | null = null;
  online = false;
  // Offline inside a copy of an online game: plays by the online rules and queues every move for
  // upload (logic/offline-minigame-sync.ts), rather than being a free pass-and-play board.
  mirrored = false;

  async mounted() {
    this.$root.$on(PANEL_SWIPE_EVENT, this.cancelForPanelSwipe);
    this.myUserId = this.backend?.userId ?? null;
    this.evaluator = new UltimateEvaluator((evaluation) => {
      this.evaluation = evaluation;
    });
    this.evaluateCurrentPosition();
    this.$nextTick(() => this.observeBoardSize());
    if (this.backend) {
      this.online = true;
      await this.connect(this.backend);
    } else {
      this.goOffline();
    }
  }

  beforeDestroy() {
    this.$root.$off(PANEL_SWIPE_EVENT, this.cancelForPanelSwipe);
    this.unsubscribe?.();
    this.evaluator?.destroy();
    this.evaluator = null;
    this.boardResizeObserver?.disconnect();
    this.boardResizeObserver = null;
    window.removeEventListener("resize", this.measureBoardSize);
    this.clearPressTimer();
  }

  private observeBoardSize() {
    this.measureBoardSize();
    const stage = this.$refs.stage as HTMLElement | undefined;
    if (!stage || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", this.measureBoardSize);
      return;
    }
    this.boardResizeObserver = new ResizeObserver(() => this.measureBoardSize());
    this.boardResizeObserver.observe(stage);
  }

  private measureBoardSize() {
    const stage = this.$refs.stage as HTMLElement | undefined;
    if (!stage) {
      return;
    }
    const size = Math.floor(Math.min(stage.clientWidth, stage.clientHeight));
    if (size > 0 && size !== this.boardSize) {
      this.boardSize = size;
    }
  }

  @Watch("board")
  @Watch("lastMove")
  private evaluateCurrentPosition() {
    this.evaluator?.analyze(this.board, this.lastMove);
  }

  private get backend(): UltimateTicTacToeBackend | null {
    return this.$store.state.ultimateTicTacToeBackend ?? null;
  }

  private get localStorageKey(): string {
    const search = typeof window === "undefined" ? "" : window.location.search;
    return localUltimateStorageKey(search);
  }

  private async connect(backend: UltimateTicTacToeBackend) {
    this.unsubscribe = backend.subscribe((row) => this.applyRow(row));
    try {
      await this.fetchRow();
    } catch {
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.goOffline();
    }
  }

  private goOffline() {
    this.online = false;
    const mirror = readOfflineMinigameMirror(this.offlineGameId);
    const row = mirror?.rows?.ultimate as UltimateTicTacToeRow | undefined;
    if (mirror && row) {
      this.mirrored = true;
      this.myUserId = mirror.userId;
      this.applyAssignments(row);
    }
    const stored = parseUltimateLocalState(window.localStorage.getItem(this.localStorageKey));
    if (stored) {
      this.board = stored.board;
      this.lastMove = stored.lastMove;
    }
  }

  private async fetchRow() {
    if (!this.backend) {
      return;
    }
    const row = await this.backend.load();
    if (row) {
      this.applyRow(row);
    }
  }

  /** Who plays which mark - also carried offline by a mirrored copy, see ChessBoard.vue. */
  private applyAssignments(row: UltimateTicTacToeRow) {
    this.xUser = row.x_user;
    this.xUser2 = row.x_user_2 ?? null;
    this.oUser = row.o_user;
    this.oUser2 = row.o_user_2 ?? null;
    this.xNextUser = row.x_next_user ?? null;
    this.oNextUser = row.o_next_user ?? null;
  }

  /** The offline game id this board's local key and its op log hang off. */
  private get offlineGameId(): string {
    return offlineMinigameGameId(typeof window === "undefined" ? "" : window.location.search);
  }

  private applyRow(row: UltimateTicTacToeRow) {
    this.applyAssignments(row);
    if (isValidUltimateBoard(row.board) && row.board !== this.board) {
      this.board = row.board;
    }
    this.lastMove =
      typeof row.last_move === "number" && row.last_move >= 0 && row.last_move < ULTIMATE_CELLS ? row.last_move : null;
  }

  onCellClick(index: number) {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (!this.canPlace(index)) {
      return;
    }
    const previousBoard = this.board;
    const nextBoard = placeUltimateMark(previousBoard, this.lastMove, index);
    if (!nextBoard) {
      return;
    }
    this.board = nextBoard;
    this.lastMove = index;
    if (!this.online) {
      this.persistOffline();
      if (this.mirrored) {
        queueOfflineMinigameOp(this.offlineGameId, "ultimate", {
          kind: "move",
          previous: previousBoard,
          next: nextBoard,
          index,
        });
      }
      return;
    }
    this.backend
      ?.move(previousBoard, nextBoard, index)
      .then((storedBoard) => {
        if (storedBoard !== nextBoard) {
          this.fetchRow().catch(() => undefined);
        }
      })
      .catch(() => {
        this.fetchRow().catch(() => undefined);
      });
  }

  private persistOffline() {
    window.localStorage.setItem(this.localStorageKey, JSON.stringify({ board: this.board, lastMove: this.lastMove }));
  }

  async confirmReset() {
    this.showResetConfirm = false;
    if (!this.online) {
      this.board = EMPTY_ULTIMATE_BOARD;
      this.lastMove = null;
      this.persistOffline();
      if (this.mirrored) {
        queueOfflineMinigameOp(this.offlineGameId, "ultimate", { kind: "reset" });
      }
      return;
    }
    if (!this.backend) {
      return;
    }
    try {
      await this.backend.reset();
      await this.fetchRow();
    } catch {
      // Keep the current board visible if the shared reset fails.
    }
  }

  onPointerDown(event: PointerEvent) {
    if (this.showResetConfirm || event.button > 0) {
      return;
    }
    this.pressStart = { x: event.clientX, y: event.clientY };
    this.clearPressTimer();
    this.pressTimer = window.setTimeout(() => {
      this.suppressClick = true;
      this.showResetConfirm = true;
    }, 600);
  }

  onPointerMove(event: PointerEvent) {
    if (!this.pressStart) {
      return;
    }
    const dx = event.clientX - this.pressStart.x;
    const dy = event.clientY - this.pressStart.y;
    if (dx * dx + dy * dy > 100) {
      this.cancelLongPress();
    }
  }

  onPointerUp() {
    this.cancelLongPress();
  }

  cancelLongPress() {
    this.pressStart = null;
    this.clearPressTimer();
  }

  private cancelForPanelSwipe() {
    this.cancelLongPress();
    this.showResetConfirm = false;
  }

  private clearPressTimer() {
    if (this.pressTimer !== null) {
      window.clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  get turn(): UltimateMark {
    return turnForUltimateBoard(this.board);
  }

  get status(): UltimateBoardStatus {
    return ultimateBoardStatus(this.board);
  }

  get validBoardSet(): Set<number> {
    return new Set(validMiniBoards(this.board, this.lastMove));
  }

  /**
   * Everything that is not in play right now fades back, so the board that must be entered is the
   * only thing at full strength. Once the game is over nothing is playable any more, so dimming
   * would just grey out the whole result - the finished board stays fully lit instead.
   */
  isDimmed(miniBoard: number): boolean {
    return !this.status.over && !this.validBoardSet.has(miniBoard);
  }

  get miniBoards(): UltimateMiniBoard[] {
    const resolutions = miniBoardResolutions(this.board);
    return Array.from({ length: 9 }, (_, miniBoard) => ({
      index: miniBoard,
      resolution: resolutions[miniBoard],
      cells: Array.from({ length: 9 }, (_, cell) => {
        const index = ultimateCellIndex(miniBoard, cell);
        return { index, mark: markAt(this.board, index) };
      }),
    }));
  }

  get xMover(): string | null {
    return this.xNextUser ?? this.xUser ?? this.xUser2;
  }

  get oMover(): string | null {
    return this.oNextUser ?? this.oUser ?? this.oUser2;
  }

  get isDesignatedMover(): boolean {
    if (!this.myUserId) {
      return false;
    }
    const member =
      this.turn === "x"
        ? this.xUser === this.myUserId || this.xUser2 === this.myUserId
        : this.oUser === this.myUserId || this.oUser2 === this.myUserId;
    return member && (this.turn === "x" ? this.xMover : this.oMover) === this.myUserId;
  }

  get effectiveMark(): UltimateMark | null {
    return (!this.online && !this.mirrored) || this.isDesignatedMover ? this.turn : null;
  }

  canPlace(index: number): boolean {
    return (
      !this.showResetConfirm &&
      !this.status.over &&
      this.effectiveMark !== null &&
      isLegalUltimateMove(this.board, this.lastMove, index)
    );
  }

  /**
   * Marks are sized from the measured board the way ChessBoard.vue sizes its pieces - a fixed share
   * of one cell - so an X or an O fills its cell instead of floating in the middle of it. The CSS
   * `clamp()` stays as the fallback for before the first measurement (and in jsdom).
   */
  get markFontStyle(): Record<string, string> | undefined {
    return this.boardSize === null ? undefined : { fontSize: `${Math.max(8, (this.boardSize / 9) * 0.74)}px` };
  }

  /** The ghost mark over a decided mini board, sized against the mini board rather than the cell. */
  get resultFontStyle(): Record<string, string> | undefined {
    return this.boardSize === null ? undefined : { fontSize: `${Math.max(12, (this.boardSize / 3) * 0.7)}px` };
  }

  get evaluationXPercent(): number {
    return this.evaluation?.xPercent ?? 50;
  }

  get evaluationAriaText(): string {
    return ultimateEvaluationDescription(this.evaluation);
  }

  get statusLabel(): string {
    if (this.status.winner) {
      return `${this.status.winner.toUpperCase()} wins`;
    }
    if (this.status.draw) {
      return "Draw";
    }
    const forced = validMiniBoards(this.board, this.lastMove);
    const route = forced.length === 1 ? `board ${forced[0] + 1}` : "free move";
    const mover = this.nicknameFor(this.turn === "x" ? this.xMover : this.oMover);
    return mover ? `${mover} (${this.turn.toUpperCase()}) · ${route}` : `${this.turn.toUpperCase()} to move · ${route}`;
  }

  miniBoardAriaLabel(mini: UltimateMiniBoard): string {
    if (mini.resolution === "draw") {
      return `Small board ${mini.index + 1}, drawn`;
    }
    if (mini.resolution) {
      return `Small board ${mini.index + 1}, won by ${mini.resolution.toUpperCase()}`;
    }
    return `Small board ${mini.index + 1}${this.validBoardSet.has(mini.index) ? ", valid" : ""}`;
  }

  cellAriaLabel(index: number): string {
    const mini = Math.floor(index / 9) + 1;
    const cell = (index % 9) + 1;
    const mark = markAt(this.board, index);
    return `Small board ${mini}, cell ${cell}${mark ? `, ${mark.toUpperCase()}` : ""}`;
  }

  private nicknameFor(userId: string | null): string {
    if (!userId) {
      return "";
    }
    const seatUsers: Record<number, string | null> = this.$store.state.seatUsers ?? {};
    const players = this.$store.state.data?.players ?? [];
    for (const seat of Object.keys(seatUsers)) {
      const seatIndex = Number(seat);
      if (seatUsers[seatIndex] === userId) {
        return String(players[seatIndex]?.name ?? "").trim();
      }
    }
    return "";
  }
}
</script>

<style lang="scss" scoped>
// The board is deliberately drawn as one flat surface with hairlines rather than as 81 tiles on a
// frame: hierarchy comes from line *color* (major grid strong, minor grid barely there) and from
// opacity (mini boards that cannot be played fade back), not from borders, fills and glows.
.lf-ultimate {
  // X is the white side and O the black one - the same two inks the chess and renju faces use, so
  // the drawer never introduces a third piece palette. The advantage strip reads the same way:
  // white on the left is X, exactly as White is on the left of the chess strip.
  // The board is a light slate rather than white even in light mode: a white X on a white board
  // would be nothing but its own outline, the same reason the dark board is mid-slate and not black.
  --lf-board: #dde3ec;
  --lf-board-edge: #b9c2d0;
  --lf-piece-white: #ffffff;
  --lf-piece-white-edge: #000000;
  --lf-piece-black: #000000;
  --lf-piece-black-edge: rgba(0, 0, 0, 0.9);
  --lf-eval-white: #e9ecf1;
  --lf-eval-black: #3a3f47;
  --lf-line-major: #97a1b1;
  --lf-line-minor: rgba(33, 37, 41, 0.11);
  --lf-accent-soft: rgba(11, 94, 215, 0.18);
  --lf-active-tint: rgba(11, 94, 215, 0.07);
  --lf-hover-tint: rgba(33, 37, 41, 0.06);

  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding: 4px;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--ui-board-canvas, #fff);
}

// Mid-slate in dark mode for the same reason as the chess and renju faces: the marks are black and
// white ink, so a board as dark as the panel would leave every O with nothing to sit against.
:root[data-theme="dark"] .lf-ultimate {
  --lf-board: #4c5666;
  --lf-board-edge: #6d7889;
  --lf-piece-white: #f7f9fc;
  --lf-piece-white-edge: #0d1116;
  --lf-piece-black: #10141a;
  --lf-piece-black-edge: rgba(233, 238, 245, 0.45);
  --lf-eval-white: #e9ecf1;
  --lf-eval-black: #596375;
  --lf-line-major: #8b95a5;
  --lf-line-minor: rgba(241, 244, 248, 0.16);
  --lf-accent-soft: rgba(111, 159, 251, 0.24);
  --lf-active-tint: rgba(111, 159, 251, 0.16);
  --lf-hover-tint: rgba(241, 244, 248, 0.1);
}

.lf-ultimate-status {
  flex: 0 0 auto;
  padding-bottom: 3px;
  overflow: hidden;
  color: var(--ui-text-muted, #666);
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.over {
    color: var(--ui-text, #222);
    font-weight: 600;
  }
}

// A hairline advantage strip: no frame, no gloss, just the two mark colors meeting.
.lf-ultimate-eval {
  position: relative;
  display: flex;
  width: 100%;
  height: 3px;
  flex: 0 0 3px;
  align-self: center;
  margin-bottom: 6px;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 999px;
  background: var(--lf-eval-black);
  opacity: 0.85;
}

.lf-ultimate-eval-x {
  height: 100%;
  flex: 0 0 auto;
  background: var(--lf-eval-white);
  transition: width 0.25s ease-out;
}

.lf-ultimate-eval-o {
  height: 100%;
  min-width: 0;
  flex: 1 1 auto;
  background: var(--lf-eval-black);
}

.lf-ultimate-stage {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
}

.lf-ultimate-board {
  display: grid;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  flex: 0 1 auto;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  aspect-ratio: 1;
  gap: 0;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--lf-board-edge);
  border-radius: 6px;
  background: var(--lf-board);
  touch-action: pan-y pinch-zoom;
  user-select: none;
}

.lf-ultimate-mini {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 0;
  transition: opacity 160ms ease, background-color 160ms ease;

  // The 3x3 of mini boards is separated by the only strong lines on the whole board.
  &:not(:nth-child(3n)) {
    border-right: 1px solid var(--lf-line-major);
  }

  &:nth-child(-n + 6) {
    border-bottom: 1px solid var(--lf-line-major);
  }

  &.valid {
    background: var(--lf-active-tint);
  }

  // Mini boards that cannot be entered on this move step back instead of competing for attention -
  // far enough to be clearly out of play, but not so far that their marks stop being readable.
  &.dimmed {
    opacity: 0.42;
  }
}

.lf-ultimate-cell {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ui-text, #222);
  font-size: clamp(0.6rem, 2vw, 1.2rem);
  font-weight: 700;
  line-height: 1;
  transition: background-color 120ms ease;

  &:not(:nth-child(3n)) {
    border-right: 1px solid var(--lf-line-minor);
  }

  &:nth-child(-n + 6) {
    border-bottom: 1px solid var(--lf-line-minor);
  }

  // Both marks are the same letterform weight, so each carries a hairline edge in the opposite ink
  // - that edge, not the fill, is what keeps a white X readable on a light board and a black O on a
  // dark one. Same rule as the chess pieces and the renju stones.
  &.x {
    color: var(--lf-piece-white);
    text-shadow: 0 0 1px var(--lf-piece-white-edge), 0 1px 1px var(--lf-piece-white-edge),
      1px 0 1px var(--lf-piece-white-edge), -1px 0 1px var(--lf-piece-white-edge), 0 -1px 1px var(--lf-piece-white-edge);
  }

  &.o {
    color: var(--lf-piece-black);
    text-shadow: 0 0 1px var(--lf-piece-black-edge), 0 1px 1px var(--lf-piece-black-edge),
      1px 0 1px var(--lf-piece-black-edge), -1px 0 1px var(--lf-piece-black-edge), 0 -1px 1px var(--lf-piece-black-edge);
  }

  &.playable {
    cursor: pointer;
  }

  &.playable:hover {
    background: var(--lf-hover-tint);
  }

  &.playable:focus-visible {
    z-index: 1;
    outline: 2px solid var(--ui-focus, #0b5ed7);
    outline-offset: -2px;
  }

  // The most recent move is marked by the same quiet accent wash the chess face uses for its own
  // last move, rather than a red frame.
  &.last {
    background: var(--lf-accent-soft);
  }

  &:disabled {
    opacity: 1;
  }
}

// A decided mini board collapses to a single large ghost glyph; its individual marks stay readable
// underneath at low contrast instead of being covered by an opaque block.
.lf-ultimate-mini.resolved .lf-ultimate-cell {
  opacity: 0.3;
}

.lf-ultimate-mini-result {
  position: absolute;
  z-index: 2;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(1.35rem, 5.4vw, 2.7rem);
  font-weight: 600;
  line-height: 1;
  opacity: 0.7;
  pointer-events: none;

  &.x {
    color: var(--lf-piece-white);
    text-shadow: 0 0 1px var(--lf-piece-white-edge), 0 1px 1px var(--lf-piece-white-edge),
      1px 0 1px var(--lf-piece-white-edge), -1px 0 1px var(--lf-piece-white-edge), 0 -1px 1px var(--lf-piece-white-edge);
  }

  &.o {
    color: var(--lf-piece-black);
    text-shadow: 0 0 1px var(--lf-piece-black-edge), 0 1px 1px var(--lf-piece-black-edge),
      1px 0 1px var(--lf-piece-black-edge), -1px 0 1px var(--lf-piece-black-edge), 0 -1px 1px var(--lf-piece-black-edge);
  }

  &.draw {
    color: var(--ui-text-muted, #667085);
    font-size: clamp(1rem, 4vw, 2rem);
    opacity: 0.45;
  }
}

.lf-ultimate-overlay {
  position: absolute;
  z-index: 4;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ui-backdrop, rgba(0, 0, 0, 0.45));
}

.lf-ultimate-confirm {
  max-width: 90%;
  padding: 12px 14px;
  border: 1px solid var(--ui-border, #d6dce6);
  border-radius: 8px;
  background: var(--ui-surface, #fff);
  box-shadow: 0 6px 20px var(--ui-shadow, rgba(0, 0, 0, 0.2));
  color: var(--ui-text, inherit);
  text-align: center;
}

.lf-ultimate-confirm-text {
  margin-bottom: 10px;
  font-size: 0.78rem;
}

.lf-ultimate-confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.lf-ultimate-btn {
  padding: 2px 10px;
  border: 1px solid var(--ui-border, #d6dce6);
  border-radius: 999px;
  background: transparent;
  color: var(--ui-text-muted, #667085);
  font-size: 0.7rem;
  line-height: 1.4;
  cursor: pointer;

  &.danger {
    border-color: transparent;
    background: var(--ui-danger-solid, #b42332);
    color: #fff;
  }
}
</style>
