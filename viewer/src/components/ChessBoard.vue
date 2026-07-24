<template>
  <div class="lf-chess" ref="root" @click.stop>
    <!-- The analysis meter is deliberately text-free and reads as the board's thin top edge. -->
    <div
      class="lf-chess-eval"
      ref="meter"
      :class="{ pending: evaluation === null && !evaluationUnavailable }"
      :style="meterStyle"
      role="meter"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(evaluationWhitePercent)"
      :aria-valuetext="evaluationAriaText"
      :title="evaluationAriaText"
    >
      <span class="lf-chess-eval-white" :style="{ width: evaluationWhitePercent + '%' }" />
      <span class="lf-chess-eval-black" />
    </div>

    <!-- The board is border-box sized so all eight files remain inside the narrow sidebar. -->
    <div
      class="lf-chess-board"
      ref="board"
      :style="boardStyle"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointermove="onPointerMove"
      @pointerleave="cancelLongPress"
      @pointercancel="cancelLongPress"
    >
      <div
        v-for="cell in cells"
        :key="cell.square"
        class="lf-chess-square"
        :data-square="cell.square"
        :aria-label="cell.square"
        :class="{
          light: cell.light,
          dark: !cell.light,
          selected: cell.square === selected,
          target: legalTargets.indexOf(cell.square) !== -1,
          capture: legalTargets.indexOf(cell.square) !== -1 && cell.piece !== null,
        }"
        @click="onSquareClick(cell)"
      >
        <span
          v-if="cell.piece"
          class="lf-chess-piece"
          :class="[cell.piece.color === 'w' ? 'white' : 'black', `piece-${cell.piece.type}`]"
          :style="{ fontSize: pieceFont + 'px' }"
          >{{ glyph(cell.piece) }}</span
        >
        <span v-if="legalTargets.indexOf(cell.square) !== -1 && !cell.piece" class="lf-chess-dot" />
      </div>

      <!-- Promotion picker, shown over the board when a pawn reaches the last rank. -->
      <div v-if="promotion" class="lf-chess-overlay" @click.self="promotion = null">
        <div class="lf-chess-promo">
          <button
            v-for="p in ['q', 'r', 'b', 'n']"
            :key="p"
            type="button"
            class="lf-chess-promo-btn"
            :class="promotion.color === 'w' ? 'white' : 'black'"
            @click="choosePromotion(p)"
          >
            {{ promoGlyph(p) }}
          </button>
        </div>
      </div>

      <!-- Long-press reset confirmation. -->
      <div v-if="showResetConfirm" class="lf-chess-overlay" @click.self="showResetConfirm = false">
        <div class="lf-chess-confirm">
          <div class="lf-chess-confirm-text">Reset the chess board?</div>
          <div class="lf-chess-confirm-actions">
            <button type="button" class="lf-chess-btn" @click="showResetConfirm = false">Cancel</button>
            <button type="button" class="lf-chess-btn danger" @click="confirmReset">Reset</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Watch } from "vue-property-decorator";
import { ChessEvaluation, StockfishEvaluator, evaluationDescription } from "../logic/chess-evaluation";
import { ChessInstance, createChess } from "../logic/chess-lib";
import { ChessBackend, ChessRow } from "../logic/chess-backend";
import {
  Cell,
  DisplaySquare,
  Orientation,
  START_FEN,
  boardOrientation,
  displaySquares,
  localChessStorageKey,
  pieceGlyph,
  promotionRank,
} from "../logic/chess";

@Component
export default class ChessBoard extends Vue {
  private chess: ChessInstance | null = null;
  private unsubscribe: (() => void) | null = null;
  // Typed loosely: ResizeObserver isn't in this repo's TS 3.9 DOM lib.
  private resizeObserver: any = null;
  private resizeFallback: (() => void) | null = null;
  private evaluator: StockfishEvaluator | null = null;

  fen = START_FEN;
  whiteUser: string | null = null;
  whiteUser2: string | null = null;
  blackUser: string | null = null;
  blackUser2: string | null = null;
  whiteNextUser: string | null = null;
  blackNextUser: string | null = null;
  myUserId: string | null = null;
  online = false;

  selected: string | null = null;
  selectedPiece: Cell = null;
  legalTargets: string[] = [];
  promotion: { from: string; to: string; color: Orientation } | null = null;
  showResetConfirm = false;
  evaluation: ChessEvaluation | null = null;
  evaluationUnavailable = false;
  evaluationResult: string | null = null;

  pieceFont = 18;
  boardSize = 0;

  // long-press bookkeeping
  private pressTimer: number | null = null;
  private pressStart: { x: number; y: number } | null = null;
  private suppressClick = false;

  async mounted() {
    this.chess = createChess(START_FEN);
    this.$root.$on("lf::chess-panel-swipe", this.cancelForPanelSwipe);
    this.online = this.backend !== null;
    this.myUserId = this.backend?.userId ?? null;
    this.$nextTick(() => this.observeSize());
    if (this.backend) {
      await this.connect(this.backend);
    } else {
      this.goOffline();
    }
    this.startEvaluation();
  }

  beforeDestroy() {
    this.$root.$off("lf::chess-panel-swipe", this.cancelForPanelSwipe);
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.resizeFallback) {
      window.removeEventListener("resize", this.resizeFallback);
    }
    this.clearPressTimer();
    this.evaluator?.destroy();
    this.evaluator = null;
  }

  // ---- setup / sync -------------------------------------------------------

  private observeSize() {
    const root = this.$refs.root as HTMLElement | undefined;
    if (!root) {
      return;
    }
    const measure = () => {
      const meter = this.$refs.meter as HTMLElement | undefined;
      const style = window.getComputedStyle(root);
      const horizontalPadding = parseFloat(style.paddingLeft || "0") + parseFloat(style.paddingRight || "0");
      const verticalPadding = parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0");
      const availableWidth = Math.max(0, root.clientWidth - horizontalPadding);
      const measuredHeight = root.clientHeight - verticalPadding - (meter?.offsetHeight ?? 0) - 2;
      const availableHeight = measuredHeight > 0 ? measuredHeight : availableWidth;
      const size = Math.max(0, Math.floor(Math.min(availableWidth, availableHeight)));
      this.boardSize = size;
      this.pieceFont = Math.max(10, (size / 8) * 0.74);
    };
    measure();
    const RO = (window as any).ResizeObserver;
    if (typeof RO !== "undefined") {
      this.resizeObserver = new RO(measure);
      this.resizeObserver.observe(root);
    } else {
      this.resizeFallback = measure;
      window.addEventListener("resize", measure);
    }
  }

  private startEvaluation() {
    this.evaluator = new StockfishEvaluator(
      (evaluation) => {
        this.evaluation = evaluation;
        this.evaluationUnavailable = false;
      },
      () => {
        this.evaluation = null;
        this.evaluationUnavailable = true;
      }
    );
    this.evaluateCurrentPosition();
  }

  @Watch("fen")
  private evaluateCurrentPosition() {
    if (!this.chess) {
      return;
    }
    if (this.chess.in_checkmate()) {
      this.evaluator?.cancel();
      const whiteWon = this.chess.turn() === "b";
      this.evaluation = {
        kind: "mate",
        value: whiteWon ? 1 : -1,
        depth: 0,
        whitePercent: whiteWon ? 100 : 0,
      };
      this.evaluationResult = whiteWon ? "1-0" : "0-1";
      return;
    }
    if (this.chess.in_draw()) {
      this.evaluator?.cancel();
      this.evaluation = { kind: "cp", value: 0, depth: 0, whitePercent: 50 };
      this.evaluationResult = "½-½";
      return;
    }
    this.evaluation = null;
    this.evaluationResult = null;
    this.evaluator?.analyze(this.fen);
  }

  private async connect(backend: ChessBackend) {
    this.unsubscribe = backend.subscribe((row) => this.applyRow(row));
    try {
      await this.fetchRow();
    } catch (e) {
      // Keep the compact face uncluttered if the hosted chess service is temporarily unavailable.
    }
  }

  // Self-contained/offline pass-and-play: either side can be moved, with a separate persisted board
  // for each offline Gaia game. No Supabase client or network request is involved.
  private goOffline() {
    this.online = false;
    const stored = window.localStorage.getItem(this.localStorageKey);
    if (stored && this.chess && this.chess.load(stored)) {
      this.fen = stored;
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

  private get backend(): ChessBackend | null {
    return this.$store.state.chessBackend ?? null;
  }

  private get localStorageKey(): string {
    return localChessStorageKey(typeof window === "undefined" ? "" : window.location.search);
  }

  private applyRow(row: ChessRow) {
    this.whiteUser = row.white_user;
    this.whiteUser2 = row.white_user_2 ?? null;
    this.blackUser = row.black_user;
    this.blackUser2 = row.black_user_2 ?? null;
    this.whiteNextUser = row.white_next_user ?? null;
    this.blackNextUser = row.black_next_user ?? null;
    this.applyFen(row.fen);
  }

  private applyFen(fen: string) {
    if (!this.chess || fen === this.fen) {
      // still refresh seats-driven UI even if the position is unchanged
      this.fen = fen;
      return;
    }
    if (this.chess.load(fen)) {
      this.fen = fen;
      this.clearSelection();
    }
  }

  // ---- interaction --------------------------------------------------------

  onSquareClick(cell: DisplaySquare) {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (!this.chess || this.promotion || this.showResetConfirm || this.gameOver) {
      return;
    }
    const movingColor = this.effectiveColor;
    // Nothing selected yet: pick up one of my own pieces, on my turn only.
    if (this.selected === null) {
      this.trySelect(cell, movingColor);
      return;
    }
    if (cell.square === this.selected) {
      this.clearSelection();
      return;
    }
    if (this.legalTargets.indexOf(cell.square) !== -1) {
      this.attemptMove(this.selected, cell.square);
      return;
    }
    // Clicked elsewhere: re-select if it's another of my pieces, otherwise clear.
    this.clearSelection();
    this.trySelect(cell, movingColor);
  }

  private trySelect(cell: DisplaySquare, movingColor: Orientation | null) {
    if (!this.chess || !cell.piece || !movingColor) {
      return;
    }
    if (cell.piece.color !== movingColor || this.chess.turn() !== movingColor) {
      return; // not your piece, or not your turn
    }
    this.selected = cell.square;
    this.selectedPiece = cell.piece;
    this.legalTargets = this.chess.moves({ square: cell.square, verbose: true }).map((m) => m.to);
  }

  private attemptMove(from: string, to: string) {
    if (!this.chess) {
      return;
    }
    // A pawn reaching the last rank must choose a promotion piece first.
    if (
      this.selectedPiece &&
      this.selectedPiece.type === "p" &&
      to.charAt(1) === promotionRank(this.selectedPiece.color as Orientation)
    ) {
      this.promotion = { from, to, color: this.selectedPiece.color as Orientation };
      return;
    }
    this.commitMove(from, to);
  }

  choosePromotion(piece: string) {
    if (!this.promotion) {
      return;
    }
    const { from, to } = this.promotion;
    this.promotion = null;
    this.commitMove(from, to, piece);
  }

  private commitMove(from: string, to: string, promotion?: string) {
    if (!this.chess) {
      return;
    }
    const prevFen = this.fen;
    const result = this.chess.move({ from, to, promotion });
    if (!result) {
      // Illegal (shouldn't happen - targets come from chess.js) - resync to be safe.
      this.chess.load(prevFen);
      this.clearSelection();
      return;
    }
    const nextFen = this.chess.fen();
    this.fen = nextFen;
    this.clearSelection();

    if (!this.online) {
      window.localStorage.setItem(this.localStorageKey, nextFen);
      return;
    }
    this.backend
      ?.move(prevFen, nextFen)
      .then((storedFen) => {
        if (storedFen !== nextFen) {
          // Someone moved first; the RPC handed back the current board.
          this.applyFen(storedFen);
          this.fetchRow().catch(() => undefined);
        }
      })
      .catch(() => this.fetchRow().catch(() => undefined));
  }

  private clearSelection() {
    this.selected = null;
    this.selectedPiece = null;
    this.legalTargets = [];
  }

  // ---- reset --------------------------------------------------------------

  async confirmReset() {
    this.showResetConfirm = false;
    if (!this.online) {
      if (this.chess) {
        this.chess.load(START_FEN);
        this.fen = START_FEN;
        window.localStorage.setItem(this.localStorageKey, START_FEN);
        this.clearSelection();
      }
      return;
    }
    if (!this.backend) {
      return;
    }
    try {
      await this.backend.reset();
      await this.fetchRow();
    } catch (error) {
      // The board stays usable/read-only without adding an error banner above the compact board.
    }
  }

  // ---- long press (reset) -------------------------------------------------

  onPointerDown(e: PointerEvent) {
    if (this.promotion || this.showResetConfirm) {
      return;
    }
    this.pressStart = { x: e.clientX, y: e.clientY };
    this.clearPressTimer();
    this.pressTimer = window.setTimeout(() => {
      this.suppressClick = true;
      this.showResetConfirm = true;
      this.clearSelection();
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
  }

  private clearPressTimer() {
    if (this.pressTimer !== null) {
      window.clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  // ---- derived ------------------------------------------------------------

  get isWhiteMember(): boolean {
    return !!this.myUserId && (this.whiteUser === this.myUserId || this.whiteUser2 === this.myUserId);
  }

  get isBlackMember(): boolean {
    return !!this.myUserId && (this.blackUser === this.myUserId || this.blackUser2 === this.myUserId);
  }

  get myColor(): Orientation | null {
    if (this.isWhiteMember && this.isBlackMember) {
      void this.fen;
      return this.chess?.turn() ?? "w";
    }
    return this.isWhiteMember ? "w" : this.isBlackMember ? "b" : null;
  }

  get whiteMover(): string | null {
    return this.whiteNextUser ?? this.whiteUser ?? this.whiteUser2;
  }

  get blackMover(): string | null {
    return this.blackNextUser ?? this.blackUser ?? this.blackUser2;
  }

  get isDesignatedMover(): boolean {
    if (!this.myUserId || !this.chess) {
      return false;
    }
    void this.fen;
    const turn = this.chess.turn() as Orientation;
    const isMember = turn === "w" ? this.isWhiteMember : this.isBlackMember;
    return isMember && (turn === "w" ? this.whiteMover : this.blackMover) === this.myUserId;
  }

  // Which colour the local user is allowed to move: their designated relay turn online, or either
  // side offline. Teammates share a colour in 3-4 player games but alternate who may actually move.
  get effectiveColor(): Orientation | null {
    if (!this.online) {
      return this.chess ? this.chess.turn() : "w";
    }
    return this.isDesignatedMover && this.chess ? (this.chess.turn() as Orientation) : null;
  }

  get orientation(): Orientation {
    // `chess` is an imperative library instance; `fen` is its reactive version token.
    void this.fen;
    return boardOrientation(this.online, this.myColor, this.chess?.turn() ?? "w");
  }

  get cells(): DisplaySquare[] {
    if (!this.chess) {
      return [];
    }
    void this.fen;
    return displaySquares(this.chess.board(), this.orientation);
  }

  get boardStyle(): Record<string, string> | undefined {
    return this.boardSize > 0
      ? {
          width: `${this.boardSize}px`,
          height: `${this.boardSize}px`,
        }
      : undefined;
  }

  get meterStyle(): Record<string, string> | undefined {
    return this.boardSize > 0 ? { width: `${this.boardSize}px` } : undefined;
  }

  get evaluationWhitePercent(): number {
    return this.evaluation?.whitePercent ?? 50;
  }

  get evaluationAriaText(): string {
    if (this.evaluationResult) {
      return `Game result ${this.evaluationResult}`;
    }
    return evaluationDescription(this.evaluation, this.evaluationUnavailable);
  }

  get gameOver(): boolean {
    void this.fen;
    return this.chess ? this.chess.game_over() : false;
  }

  glyph(piece: Cell): string {
    return pieceGlyph(piece);
  }

  promoGlyph(type: string): string {
    return pieceGlyph({ type, color: this.promotion ? this.promotion.color : "w" });
  }
}
</script>

<style lang="scss" scoped>
.lf-chess {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 2px;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--ui-surface, #fff);
}

.lf-chess-btn {
  border: 1px solid var(--ui-border-strong, #888);
  background: var(--ui-surface, #fff);
  color: var(--ui-text, inherit);
  border-radius: 3px;
  padding: 0 4px;
  font-size: 0.7rem;
  line-height: 1.4;
  cursor: pointer;

  &.danger {
    background: #c0392b;
    color: #fff;
    border-color: #a5281b;
  }
}

.lf-chess-eval {
  position: relative;
  display: flex;
  width: 100%;
  height: 6px;
  flex: 0 0 6px;
  align-self: center;
  margin-bottom: 2px;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--ui-border-strong, #555);
  border-radius: 2px 2px 0 0;
  background: #252525;

  &.pending {
    opacity: 0.78;
  }
}

.lf-chess-eval-white {
  height: 100%;
  flex: 0 0 auto;
  background: #f2f2f2;
}

.lf-chess-eval-black {
  height: 100%;
  min-width: 0;
  flex: 1 1 auto;
  background: #252525;
}

.lf-chess-board {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  flex: 0 0 auto;
  align-self: center;
  max-width: 100%;
  max-height: 100%;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  border: 2px solid var(--ui-border-strong, #555);
  border-radius: 3px;
  overflow: hidden;
  touch-action: none; // let long-press work without the browser hijacking it as a scroll
  user-select: none;
}

.lf-chess-square {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &.light {
    background: #efd9b5;
  }
  &.dark {
    background: #b58863;
  }
  &.selected {
    box-shadow: inset 0 0 0 3px #f1c40f;
  }
  &.capture {
    box-shadow: inset 0 0 0 3px rgba(46, 204, 113, 0.9);
  }
}

.lf-chess-piece {
  display: grid;
  width: 1em;
  height: 1em;
  place-items: center;
  font-family: "DejaVu Sans", "Noto Sans Symbols 2", "Segoe UI Symbol", "Apple Symbols", sans-serif;
  font-variant-emoji: text;
  line-height: 1;
  pointer-events: none;

  &.piece-p {
    transform: scale(0.8);
  }

  &.white {
    color: #fafafa;
    text-shadow: 0 0 1px #000, 0 0 1px #000, 0 1px 1px #000, 1px 0 1px #000, 0 -1px 1px #000, -1px 0 1px #000;
  }
  &.black {
    color: #1b1b1b;
    text-shadow: 0 0 1px #000;
  }
}

.lf-chess-dot {
  position: absolute;
  width: 26%;
  height: 26%;
  border-radius: 50%;
  background: rgba(46, 204, 113, 0.75);
  pointer-events: none;
}

.lf-chess-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}

.lf-chess-promo {
  display: flex;
  gap: 4px;
  background: var(--ui-surface, #fff);
  padding: 6px;
  border-radius: 4px;
}

.lf-chess-promo-btn {
  border: 1px solid var(--ui-border-strong, #888);
  background: var(--ui-surface, #fff);
  border-radius: 3px;
  font-size: 1.6rem;
  line-height: 1;
  width: 2rem;
  height: 2rem;
  cursor: pointer;

  &.white {
    color: #fafafa;
    text-shadow: 0 0 1px #000, 0 1px 1px #000, 1px 0 1px #000, -1px 0 1px #000, 0 -1px 1px #000;
    background: #777;
  }
  &.black {
    color: #1b1b1b;
  }
}

.lf-chess-confirm {
  background: var(--ui-surface, #fff);
  color: var(--ui-text, inherit);
  border-radius: 4px;
  padding: 10px 12px;
  text-align: center;
  max-width: 90%;
}

.lf-chess-confirm-text {
  font-size: 0.8rem;
  margin-bottom: 8px;
}

.lf-chess-confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}
</style>
