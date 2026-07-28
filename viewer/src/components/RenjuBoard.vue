<template>
  <div class="lf-renju" @click.stop>
    <div class="lf-renju-status" :class="{ over: status.over }" aria-live="polite">{{ statusLabel }}</div>

    <!-- The analysis meter, deliberately identical to the chess face's (ChessBoard.vue): the same
         text-free 3px pill above the board, white on the left. -->
    <div
      class="lf-renju-eval"
      :class="{ pending: evaluation === null && !evaluationUnavailable }"
      role="meter"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(evaluationWhitePercent)"
      :aria-valuetext="evaluationAriaText"
      :title="evaluationAriaText"
    >
      <span class="lf-renju-eval-white" :style="{ width: evaluationWhitePercent + '%' }" />
      <span class="lf-renju-eval-black" />
    </div>

    <div class="lf-renju-stage">
      <!-- Stones sit on the INTERSECTIONS of a 14x14 grid of lines, the traditional renju/gomoku
           board (unlike chess, which plays inside the squares). One SVG user unit is one grid step,
           so the whole board scales itself to whatever the research panel's own box happens to be -
           no measuring, no ResizeObserver. -->
      <svg
        class="lf-renju-board"
        :viewBox="`${-margin} ${-margin} ${feltSize} ${feltSize}`"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @pointermove="onPointerMove"
        @pointerleave="cancelLongPress"
        @pointercancel="cancelLongPress"
      >
        <rect class="lf-renju-felt" :x="-margin" :y="-margin" :width="feltSize" :height="feltSize" rx="0.4" ry="0.4" />
        <g class="lf-renju-grid">
          <line v-for="i in lines" :key="`h${i}`" :x1="0" :y1="i" :x2="size - 1" :y2="i" />
          <line v-for="i in lines" :key="`v${i}`" :x1="i" :y1="0" :x2="i" :y2="size - 1" />
        </g>
        <circle
          v-for="star in starPoints"
          :key="`s${star}`"
          class="lf-renju-star"
          :cx="star % size"
          :cy="Math.floor(star / size)"
          r="0.11"
        />

        <circle
          v-for="point in stones"
          :key="`p${point.index}`"
          class="lf-renju-stone"
          :class="[point.stone === 'b' ? 'black' : 'white', { winning: status.line.indexOf(point.index) !== -1 }]"
          :cx="point.column"
          :cy="point.row"
          r="0.44"
        />

        <!-- Two-tap placement: the first tap leaves a translucent ghost stone, the second on the
             same intersection commits it. A 15x15 grid inside this panel gives roughly 20px targets
             on a phone, so a single tap would be far too easy to misplace - and a stray tap on a
             board that is also a live Gaia move surface must never do anything irreversible. -->
        <circle
          v-if="ghost !== null"
          class="lf-renju-ghost"
          :class="effectiveColor === 'b' ? 'black' : 'white'"
          :cx="ghost % size"
          :cy="Math.floor(ghost / size)"
          r="0.44"
        />
        <circle
          v-if="lastMove !== null && ghost === null"
          class="lf-renju-last"
          :cx="lastMove % size"
          :cy="Math.floor(lastMove / size)"
          r="0.17"
        />

        <line
          v-if="winLine"
          class="lf-renju-win-line"
          :x1="winLine.x1"
          :y1="winLine.y1"
          :x2="winLine.x2"
          :y2="winLine.y2"
        />

        <rect
          v-for="point in points"
          :key="`h${point.index}`"
          class="lf-renju-hit"
          :x="point.column - 0.5"
          :y="point.row - 0.5"
          width="1"
          height="1"
          @click="onPointClick(point.index)"
        />
      </svg>

      <!-- Long-press reset confirmation, mirroring the chess face. -->
      <div v-if="showResetConfirm" class="lf-renju-overlay" @click.self="showResetConfirm = false">
        <div class="lf-renju-confirm">
          <div class="lf-renju-confirm-text">Reset the renju board?</div>
          <div class="lf-renju-confirm-actions">
            <button type="button" class="lf-renju-btn" @click="showResetConfirm = false">Cancel</button>
            <button type="button" class="lf-renju-btn danger" @click="confirmReset">Reset</button>
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
import { RenjuBackend, RenjuRow } from "../logic/renju-backend";
import { playerOfStone } from "../logic/renju-engine";
import { decidedEvaluation, evaluationDescription, RenjuEvaluation, RenjuEvaluator } from "../logic/renju-evaluation";
import {
  EMPTY_RENJU_BOARD,
  RENJU_CELLS,
  RENJU_SIZE,
  RENJU_STAR_POINTS,
  RenjuStatus,
  Stone,
  boardStatus,
  columnOf,
  isValidBoard,
  localRenjuStorageKey,
  parseLocalState,
  placeStone,
  rowOf,
  turnFor,
} from "../logic/renju";

interface RenjuPoint {
  index: number;
  row: number;
  column: number;
}

interface RenjuStone extends RenjuPoint {
  stone: Stone;
}

@Component
export default class RenjuBoard extends Vue {
  private unsubscribe: (() => void) | null = null;
  private evaluator: RenjuEvaluator | null = null;

  evaluation: RenjuEvaluation | null = null;
  evaluationUnavailable = false;

  board = EMPTY_RENJU_BOARD;
  lastMove: number | null = null;
  ghost: number | null = null;
  showResetConfirm = false;

  blackUser: string | null = null;
  blackUser2: string | null = null;
  whiteUser: string | null = null;
  whiteUser2: string | null = null;
  blackNextUser: string | null = null;
  whiteNextUser: string | null = null;
  myUserId: string | null = null;
  online = false;

  // long-press bookkeeping
  private pressTimer: number | null = null;
  private pressStart: { x: number; y: number } | null = null;
  private suppressClick = false;

  async mounted() {
    this.$root.$on(PANEL_SWIPE_EVENT, this.cancelForPanelSwipe);
    this.myUserId = this.backend?.userId ?? null;
    this.startEvaluation();
    if (this.backend) {
      this.online = true;
      await this.connect(this.backend);
    } else {
      this.goOffline();
    }
  }

  beforeDestroy() {
    this.$root.$off(PANEL_SWIPE_EVENT, this.cancelForPanelSwipe);
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.evaluator?.destroy();
    this.evaluator = null;
    this.clearPressTimer();
  }

  // ---- analysis meter -----------------------------------------------------

  private startEvaluation() {
    try {
      this.evaluator = new RenjuEvaluator((evaluation) => {
        this.evaluation = evaluation;
        this.evaluationUnavailable = false;
      });
    } catch (error) {
      // The meter is an extra, never a reason for the board itself to fail to render.
      this.evaluator = null;
      this.evaluationUnavailable = true;
    }
    this.evaluateCurrentPosition();
  }

  /**
   * Kept in step with the position by a watcher, exactly like the chess face. A finished game is
   * reported straight from the board's own status - there is nothing left to search.
   */
  @Watch("board")
  @Watch("lastMove")
  private evaluateCurrentPosition() {
    if (!this.evaluator) {
      return;
    }
    const status = this.status;
    if (status.over) {
      this.evaluator.cancel();
      this.evaluation = decidedEvaluation(status.winner ? playerOfStone(status.winner) : null);
      return;
    }
    this.evaluator.analyze(this.board);
  }

  // ---- setup / sync -------------------------------------------------------

  private get backend(): RenjuBackend | null {
    return this.$store.state.renjuBackend ?? null;
  }

  private get localStorageKey(): string {
    return localRenjuStorageKey(typeof window === "undefined" ? "" : window.location.search);
  }

  private async connect(backend: RenjuBackend) {
    this.unsubscribe = backend.subscribe((row) => this.applyRow(row));
    try {
      await this.fetchRow();
    } catch (e) {
      // The shared board is unavailable (an unmigrated stack, or a transient outage). Fall back to
      // the same local pass-and-play the offline viewer uses rather than showing a dead board.
      this.goOffline();
    }
  }

  // Self-contained/offline pass-and-play: either colour can be played, with a separate persisted
  // position for each offline Gaia game. No Supabase client or network request is involved.
  private goOffline() {
    this.online = false;
    const stored = parseLocalState(window.localStorage.getItem(this.localStorageKey));
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

  private applyRow(row: RenjuRow) {
    this.blackUser = row.black_user;
    this.blackUser2 = row.black_user_2 ?? null;
    this.whiteUser = row.white_user;
    this.whiteUser2 = row.white_user_2 ?? null;
    this.blackNextUser = row.black_next_user ?? null;
    this.whiteNextUser = row.white_next_user ?? null;
    if (isValidBoard(row.board) && row.board !== this.board) {
      this.board = row.board;
      this.ghost = null;
    }
    this.lastMove =
      typeof row.last_move === "number" && row.last_move >= 0 && row.last_move < RENJU_CELLS ? row.last_move : null;
  }

  // ---- interaction --------------------------------------------------------

  onPointClick(index: number) {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (this.showResetConfirm || this.status.over) {
      return;
    }
    if (this.board.charAt(index) !== "." || !this.effectiveColor) {
      this.ghost = null;
      return;
    }
    if (this.ghost !== index) {
      this.ghost = index;
      return;
    }
    this.commitStone(index);
  }

  private commitStone(index: number) {
    const stone = this.effectiveColor;
    if (!stone) {
      return;
    }
    const previousBoard = this.board;
    const nextBoard = placeStone(previousBoard, index, stone);
    if (!nextBoard) {
      return;
    }
    this.board = nextBoard;
    this.lastMove = index;
    this.ghost = null;

    if (!this.online) {
      this.persistOffline();
      return;
    }
    this.backend
      ?.move(previousBoard, nextBoard, index)
      .then((storedBoard) => {
        if (storedBoard !== nextBoard) {
          // Someone played first; the RPC handed back the current position.
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

  // ---- reset --------------------------------------------------------------

  async confirmReset() {
    this.showResetConfirm = false;
    this.ghost = null;
    if (!this.online) {
      this.board = EMPTY_RENJU_BOARD;
      this.lastMove = null;
      this.persistOffline();
      return;
    }
    if (!this.backend) {
      return;
    }
    try {
      await this.backend.reset();
      await this.fetchRow();
    } catch (error) {
      // The board stays usable/read-only rather than growing an error banner in the panel.
    }
  }

  // ---- long press (reset) -------------------------------------------------

  onPointerDown(e: PointerEvent) {
    if (this.showResetConfirm) {
      return;
    }
    this.pressStart = { x: e.clientX, y: e.clientY };
    this.clearPressTimer();
    this.pressTimer = window.setTimeout(() => {
      this.suppressClick = true;
      this.showResetConfirm = true;
      this.ghost = null;
    }, 600);
  }

  onPointerMove(e: PointerEvent) {
    if (!this.pressStart) {
      return;
    }
    const dx = e.clientX - this.pressStart.x;
    const dy = e.clientY - this.pressStart.y;
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
    this.ghost = null;
  }

  private clearPressTimer() {
    if (this.pressTimer !== null) {
      window.clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  // ---- derived ------------------------------------------------------------

  get size(): number {
    return RENJU_SIZE;
  }

  // One SVG user unit is one grid step. The outermost lines carry a stone whose radius is 0.44, so
  // the board's own margin has to clear that plus a hair of breathing room.
  get margin(): number {
    return 0.9;
  }

  get feltSize(): number {
    return RENJU_SIZE - 1 + this.margin * 2;
  }

  get lines(): number[] {
    return Array.from({ length: RENJU_SIZE }, (_, i) => i);
  }

  get starPoints(): number[] {
    return RENJU_STAR_POINTS;
  }

  get points(): RenjuPoint[] {
    return Array.from({ length: RENJU_CELLS }, (_, index) => ({
      index,
      row: rowOf(index),
      column: columnOf(index),
    }));
  }

  get stones(): RenjuStone[] {
    const placed: RenjuStone[] = [];
    for (let index = 0; index < this.board.length; index++) {
      const value = this.board.charAt(index);
      if (value === "b" || value === "w") {
        placed.push({ index, row: rowOf(index), column: columnOf(index), stone: value });
      }
    }
    return placed;
  }

  get turn(): Stone {
    return turnFor(this.board);
  }

  get status(): RenjuStatus {
    return boardStatus(this.board, this.lastMove);
  }

  get winLine(): Record<string, number> | null {
    const line = this.status.line;
    if (line.length < 2) {
      return null;
    }
    const first = line[0];
    const last = line[line.length - 1];
    return {
      x1: columnOf(first),
      y1: rowOf(first),
      x2: columnOf(last),
      y2: rowOf(last),
    };
  }

  get isBlackMember(): boolean {
    return !!this.myUserId && (this.blackUser === this.myUserId || this.blackUser2 === this.myUserId);
  }

  get isWhiteMember(): boolean {
    return !!this.myUserId && (this.whiteUser === this.myUserId || this.whiteUser2 === this.myUserId);
  }

  get blackMover(): string | null {
    return this.blackNextUser ?? this.blackUser ?? this.blackUser2;
  }

  get whiteMover(): string | null {
    return this.whiteNextUser ?? this.whiteUser ?? this.whiteUser2;
  }

  get isDesignatedMover(): boolean {
    if (!this.myUserId) {
      return false;
    }
    const isMember = this.turn === "b" ? this.isBlackMember : this.isWhiteMember;
    return isMember && (this.turn === "b" ? this.blackMover : this.whiteMover) === this.myUserId;
  }

  // Which colour the local user may play: their designated relay turn online, or either side
  // offline (one device, pass-and-play).
  get effectiveColor(): Stone | null {
    if (!this.online) {
      return this.turn;
    }
    return this.isDesignatedMover ? this.turn : null;
  }

  get evaluationWhitePercent(): number {
    return this.evaluation?.whitePercent ?? 50;
  }

  get evaluationAriaText(): string {
    return evaluationDescription(this.evaluation, this.evaluationUnavailable);
  }

  get statusLabel(): string {
    const status = this.status;
    if (status.winner) {
      const nickname = this.nicknameFor(status.winner === "b" ? this.blackMover : this.whiteMover);
      return nickname ? `${nickname} wins` : `${status.winner === "b" ? "Black" : "White"} wins`;
    }
    if (status.draw) {
      return "Draw";
    }
    if (this.ghost !== null) {
      return "Tap again to place";
    }
    const nickname = this.nicknameFor(this.turn === "b" ? this.blackMover : this.whiteMover);
    return nickname ? `${nickname} to move` : `${this.turn === "b" ? "Black" : "White"} to move`;
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
// Shares the minimal drawer-face language of UltimateTicTacToeBoard.vue and ChessBoard.vue: a flat
// board with hairline lines, one accent color for every interaction hint, and a 3px advantage pill.
// Any change to that shared vocabulary belongs in all three files.
.lf-renju {
  --lf-felt: #ffffff;
  --lf-grid: #98a2b3;
  --lf-accent: #0b5ed7;
  --lf-accent-ring: rgba(11, 94, 215, 0.55);

  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  align-items: stretch;
  padding: 4px;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--ui-board-canvas, #fff);
}

// Like the chess squares, the playing surface stays a light neutral in dark mode (only muted): the
// stones are black and white ink, so a dark board would cost the black stones all of their contrast.
:root[data-theme="dark"] .lf-renju {
  --lf-felt: #ccd3dd;
  --lf-grid: #78849a;
  --lf-accent: #1f5fbd;
  --lf-accent-ring: rgba(31, 95, 189, 0.65);
}

.lf-renju-status {
  flex: 0 0 auto;
  padding-bottom: 3px;
  color: var(--ui-text-muted, #666);
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  line-height: 1.2;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.over {
    color: var(--ui-text, #222);
    font-weight: 600;
  }
}

// Deliberately identical to ChessBoard.vue's `.lf-chess-eval` block - the drawer faces are meant to
// read as the same instrument, so any change here belongs there too.
.lf-renju-eval {
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
  background: #3a3f47;
  opacity: 0.85;

  &.pending {
    opacity: 0.5;
  }
}

.lf-renju-eval-white {
  height: 100%;
  flex: 0 0 auto;
  background: #e9ecf1;
  transition: width 0.25s ease-out;
}

.lf-renju-eval-black {
  height: 100%;
  min-width: 0;
  flex: 1 1 auto;
  background: #3a3f47;
}

.lf-renju-stage {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
}

.lf-renju-board {
  width: 100%;
  height: 100%;
  // This board fills the entire research panel, so a finger landing anywhere on it must still
  // scroll the page vertically (owner report), while a two-finger gesture must retain native pinch
  // zoom. Horizontal one-finger drags remain available to the drawer. A long press still works
  // because it needs a stationary finger; any scroll or pinch produces pointercancel as intended.
  touch-action: pan-y pinch-zoom;
  user-select: none;
}

.lf-renju-felt {
  fill: var(--lf-felt);
  stroke: var(--ui-border, #d6dce6);
  stroke-width: 0.04;
}

.lf-renju-grid line {
  stroke: var(--lf-grid);
  stroke-width: 0.03;
}

.lf-renju-star {
  fill: var(--lf-grid);
}

// Flat ink discs rather than lacquered stones: one fill, one hairline edge, no second color.
.lf-renju-stone {
  stroke-width: 0.04;

  &.black {
    fill: #21262e;
    stroke: #21262e;
  }

  &.white {
    fill: #ffffff;
    stroke: #7d8798;
  }

  &.winning {
    stroke: var(--lf-accent);
    stroke-width: 0.1;
  }
}

.lf-renju-ghost {
  opacity: 0.4;
  stroke-width: 0.04;
  pointer-events: none;

  &.black {
    fill: #21262e;
    stroke: #21262e;
  }

  &.white {
    fill: #ffffff;
    stroke: #7d8798;
  }
}

.lf-renju-last {
  fill: none;
  stroke: var(--lf-accent);
  stroke-width: 0.08;
  pointer-events: none;
}

.lf-renju-win-line {
  stroke: var(--lf-accent-ring);
  stroke-width: 0.1;
  stroke-linecap: round;
  pointer-events: none;
}

.lf-renju-hit {
  fill: transparent;
  cursor: pointer;
}

.lf-renju-overlay {
  position: absolute;
  z-index: 4;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ui-backdrop, rgba(0, 0, 0, 0.45));
}

.lf-renju-confirm {
  max-width: 90%;
  padding: 12px 14px;
  border: 1px solid var(--ui-border, #d6dce6);
  border-radius: 8px;
  background: var(--ui-surface, #fff);
  box-shadow: 0 6px 20px var(--ui-shadow, rgba(0, 0, 0, 0.2));
  color: var(--ui-text, inherit);
  text-align: center;
}

.lf-renju-confirm-text {
  margin-bottom: 10px;
  font-size: 0.78rem;
}

.lf-renju-confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.lf-renju-btn {
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
