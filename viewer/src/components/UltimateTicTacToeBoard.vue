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
            resolved: mini.resolution !== null,
            won: mini.resolution === 'x' || mini.resolution === 'o',
            drawn: mini.resolution === 'draw',
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
  UltimateEvaluation,
  UltimateEvaluator,
  ultimateEvaluationDescription,
} from "../logic/ultimate-tic-tac-toe-evaluation";
import {
  UltimateTicTacToeBackend,
  UltimateTicTacToeRow,
} from "../logic/ultimate-tic-tac-toe-backend";
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

  private applyRow(row: UltimateTicTacToeRow) {
    this.xUser = row.x_user;
    this.xUser2 = row.x_user_2 ?? null;
    this.oUser = row.o_user;
    this.oUser2 = row.o_user_2 ?? null;
    this.xNextUser = row.x_next_user ?? null;
    this.oNextUser = row.o_next_user ?? null;
    if (isValidUltimateBoard(row.board) && row.board !== this.board) {
      this.board = row.board;
    }
    this.lastMove =
      typeof row.last_move === "number" && row.last_move >= 0 && row.last_move < ULTIMATE_CELLS
        ? row.last_move
        : null;
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
    window.localStorage.setItem(
      this.localStorageKey,
      JSON.stringify({ board: this.board, lastMove: this.lastMove })
    );
  }

  async confirmReset() {
    this.showResetConfirm = false;
    if (!this.online) {
      this.board = EMPTY_ULTIMATE_BOARD;
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
    return !this.online || this.isDesignatedMover ? this.turn : null;
  }

  canPlace(index: number): boolean {
    return (
      !this.showResetConfirm &&
      !this.status.over &&
      this.effectiveMark !== null &&
      isLegalUltimateMove(this.board, this.lastMove, index)
    );
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
    return mover
      ? `${mover} (${this.turn.toUpperCase()}) · ${route}`
      : `${this.turn.toUpperCase()} to move · ${route}`;
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
.lf-ultimate {
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

.lf-ultimate-status {
  flex: 0 0 auto;
  padding-bottom: 2px;
  overflow: hidden;
  color: var(--ui-text-muted, #666);
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.over {
    color: var(--ui-primary, #247b0a);
  }
}

.lf-ultimate-eval {
  position: relative;
  display: flex;
  width: 100%;
  height: 6px;
  flex: 0 0 6px;
  align-self: center;
  margin-bottom: 3px;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--ui-border-strong, #555);
  border-radius: 2px;
  background: #b13b58;
}

.lf-ultimate-eval-x {
  height: 100%;
  flex: 0 0 auto;
  background: #31b9b1;
  transition: width 0.25s ease-out;
}

.lf-ultimate-eval-o {
  height: 100%;
  min-width: 0;
  flex: 1 1 auto;
  background: #b13b58;
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
  gap: 4px;
  padding: 3px;
  box-sizing: border-box;
  border: 2px solid #172e62;
  border-radius: 5px;
  background: #172e62;
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
  gap: 1px;
  padding: 2px;
  border: 1px solid #6f7f9c;
  border-radius: 3px;
  background: #d8deea;
  transition: background-color 120ms ease, box-shadow 120ms ease;

  &.valid {
    z-index: 1;
    background: #fff1a8;
    box-shadow: 0 0 0 2px #efb400, 0 0 7px rgba(239, 180, 0, 0.75);
  }

  &.resolved {
    background: #d7dce5;
    box-shadow: none;
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
  border-radius: 1px;
  background: var(--ui-surface, #fff);
  color: var(--ui-text, #222);
  font-size: clamp(0.48rem, 1.45vw, 0.82rem);
  font-weight: 800;
  line-height: 1;

  &.x {
    color: #087e79;
  }

  &.o {
    color: #a42043;
  }

  &.playable {
    cursor: pointer;
  }

  &.playable:hover,
  &.playable:focus-visible {
    z-index: 1;
    outline: 2px solid var(--ui-primary, #247b0a);
    outline-offset: -2px;
  }

  &.last {
    z-index: 1;
    box-shadow: inset 0 0 0 2px #e14335;
  }

  &:disabled {
    opacity: 1;
  }
}

.lf-ultimate-mini-result {
  position: absolute;
  z-index: 2;
  inset: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  font-size: clamp(1.35rem, 5.4vw, 2.7rem);
  font-weight: 900;
  line-height: 1;
  pointer-events: none;

  &.x {
    background: rgba(49, 185, 177, 0.78);
    color: #064d4a;
  }

  &.o {
    background: rgba(201, 80, 108, 0.78);
    color: #67142a;
  }

  &.draw {
    background: rgba(117, 126, 142, 0.72);
    color: #fff;
  }
}

.lf-ultimate-overlay {
  position: absolute;
  z-index: 4;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}

.lf-ultimate-confirm {
  max-width: 90%;
  padding: 10px 12px;
  border-radius: 4px;
  background: var(--ui-surface, #fff);
  color: var(--ui-text, inherit);
  text-align: center;
}

.lf-ultimate-confirm-text {
  margin-bottom: 8px;
  font-size: 0.8rem;
}

.lf-ultimate-confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.lf-ultimate-btn {
  padding: 0 6px;
  border: 1px solid var(--ui-border-strong, #888);
  border-radius: 3px;
  background: var(--ui-surface, #fff);
  color: var(--ui-text, inherit);
  font-size: 0.7rem;
  line-height: 1.4;
  cursor: pointer;

  &.danger {
    border-color: #a5281b;
    background: #c0392b;
    color: #fff;
  }
}
</style>
