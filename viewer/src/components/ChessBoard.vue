<template>
  <div class="lf-chess" ref="root" @click.stop>
    <!-- Centre the entire chess stack as one unit. Equal reserved capture rows prevent the board
         jumping when the first piece is taken, and keep the board centred between both players. -->
    <div class="lf-chess-stage" ref="stage" data-centering="full-stack">
      <div class="lf-chess-captures top" ref="capturesTop" :style="meterStyle" aria-label="Top captured pieces">
        <span
          v-for="(piece, index) in topCapturedPieces"
          :key="`${piece.color}-${piece.type}-${index}`"
          class="lf-chess-captured-piece"
          :class="piece.color === 'w' ? 'white' : 'black'"
          aria-hidden="true"
          >{{ glyph(piece) }}</span
        >
      </div>

      <div class="lf-chess-turn" ref="turnLabel" :style="meterStyle" aria-live="polite">{{ turnLabel }}</div>

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
            'last-move': cell.square === lastMoveFrom || cell.square === lastMoveTo,
            'last-from': cell.square === lastMoveFrom,
            'last-to': cell.square === lastMoveTo,
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

        <div v-if="lastMoveArrowStyle" class="lf-chess-last-arrow" :style="lastMoveArrowStyle" aria-hidden="true" />

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

      <div
        class="lf-chess-captures bottom"
        ref="capturesBottom"
        :style="meterStyle"
        aria-label="Bottom captured pieces"
      >
        <span
          v-for="(piece, index) in bottomCapturedPieces"
          :key="`${piece.color}-${piece.type}-${index}`"
          class="lf-chess-captured-piece"
          :class="piece.color === 'w' ? 'white' : 'black'"
          aria-hidden="true"
          >{{ glyph(piece) }}</span
        >
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
import { PANEL_SWIPE_EVENT } from "../logic/panel-swipe";
import {
  Cell,
  DisplaySquare,
  Orientation,
  ChessPiece,
  START_FEN,
  boardOrientation,
  displaySquares,
  localChessLastMoveStorageKey,
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
  lastMoveFrom: string | null = null;
  lastMoveTo: string | null = null;

  pieceFont = 18;
  boardSize = 0;

  // long-press bookkeeping
  private pressTimer: number | null = null;
  private pressStart: { x: number; y: number } | null = null;
  private suppressClick = false;

  async mounted() {
    this.chess = createChess(START_FEN);
    this.$root.$on(PANEL_SWIPE_EVENT, this.cancelForPanelSwipe);
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
    this.$root.$off(PANEL_SWIPE_EVENT, this.cancelForPanelSwipe);
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
      const stage = this.$refs.stage as HTMLElement | undefined;
      const meter = this.$refs.meter as HTMLElement | undefined;
      const turnLabel = this.$refs.turnLabel as HTMLElement | undefined;
      const capturesTop = this.$refs.capturesTop as HTMLElement | undefined;
      const capturesBottom = this.$refs.capturesBottom as HTMLElement | undefined;
      const style = window.getComputedStyle(root);
      const stageStyle = stage ? window.getComputedStyle(stage) : null;
      const horizontalPadding = parseFloat(style.paddingLeft || "0") + parseFloat(style.paddingRight || "0");
      const verticalPadding = parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0");
      const availableWidth = Math.max(0, root.clientWidth - horizontalPadding);
      const stageGap = parseFloat(stageStyle?.rowGap || stageStyle?.gap || "0");
      const fixedStackHeight =
        (meter?.offsetHeight ?? 0) +
        (turnLabel?.offsetHeight ?? 0) +
        (capturesTop?.offsetHeight ?? 0) +
        (capturesBottom?.offsetHeight ?? 0) +
        stageGap * 4;
      const measuredHeight = root.clientHeight - verticalPadding - fixedStackHeight;
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
    this.restoreOfflineLastMove();
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

  private get localLastMoveStorageKey(): string {
    return localChessLastMoveStorageKey(typeof window === "undefined" ? "" : window.location.search);
  }

  private applyRow(row: ChessRow) {
    this.whiteUser = row.white_user;
    this.whiteUser2 = row.white_user_2 ?? null;
    this.blackUser = row.black_user;
    this.blackUser2 = row.black_user_2 ?? null;
    this.whiteNextUser = row.white_next_user ?? null;
    this.blackNextUser = row.black_next_user ?? null;
    this.setLastMove(row.last_move_from ?? null, row.last_move_to ?? null);
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
    this.setLastMove(from, to);
    this.clearSelection();

    if (!this.online) {
      window.localStorage.setItem(this.localStorageKey, nextFen);
      window.localStorage.setItem(this.localLastMoveStorageKey, JSON.stringify({ from, to }));
      return;
    }
    this.backend
      ?.move(prevFen, nextFen, from, to)
      .then((storedFen) => {
        if (storedFen !== nextFen) {
          // Someone moved first; the RPC handed back the current board.
          this.setLastMove(null, null);
          this.applyFen(storedFen);
          this.fetchRow().catch(() => undefined);
        }
      })
      .catch(() => {
        this.setLastMove(null, null);
        this.fetchRow().catch(() => undefined);
      });
  }

  private setLastMove(from: string | null, to: string | null) {
    const valid = (square: string | null) => square !== null && /^[a-h][1-8]$/.test(square);
    this.lastMoveFrom = valid(from) && valid(to) ? from : null;
    this.lastMoveTo = valid(from) && valid(to) ? to : null;
  }

  private restoreOfflineLastMove() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(this.localLastMoveStorageKey) ?? "null");
      this.setLastMove(stored?.from ?? null, stored?.to ?? null);
    } catch {
      this.setLastMove(null, null);
    }
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
        window.localStorage.removeItem(this.localLastMoveStorageKey);
        this.setLastMove(null, null);
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

  get turnLabel(): string {
    void this.fen;
    const turn = (this.chess?.turn() ?? "w") as Orientation;
    const mover = turn === "w" ? this.whiteMover : this.blackMover;
    const nickname = this.nicknameFor(mover);
    return nickname ? `${nickname} to move` : `${turn === "w" ? "White" : "Black"} to move`;
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

  get topCapturedPieces(): ChessPiece[] {
    return this.orientation === "w" ? this.missingPieces("w") : this.missingPieces("b");
  }

  get bottomCapturedPieces(): ChessPiece[] {
    return this.orientation === "w" ? this.missingPieces("b") : this.missingPieces("w");
  }

  private missingPieces(color: Orientation): ChessPiece[] {
    if (!this.chess) {
      return [];
    }
    void this.fen;
    const initial: Record<string, number> = { q: 1, r: 2, b: 2, n: 2, p: 8 };
    const current: Record<string, number> = { q: 0, r: 0, b: 0, n: 0, p: 0 };
    for (const row of this.chess.board()) {
      for (const piece of row) {
        if (piece?.color === color && current[piece.type] !== undefined) {
          current[piece.type] += 1;
        }
      }
    }

    // A missing pawn may have promoted rather than been captured. Discount currently visible extra
    // major/minor pieces so ordinary promotions do not appear in the taken-piece row as lost pawns.
    const promotedPawns = ["q", "r", "b", "n"].reduce(
      (total, type) => total + Math.max(0, current[type] - initial[type]),
      0
    );
    const pieces: ChessPiece[] = [];
    for (const type of ["q", "r", "b", "n", "p"]) {
      const missing =
        type === "p" ? Math.max(0, initial.p - current.p - promotedPawns) : Math.max(0, initial[type] - current[type]);
      for (let index = 0; index < missing; index++) {
        pieces.push({ type, color });
      }
    }
    return pieces;
  }

  get lastMoveArrowStyle(): Record<string, string> | null {
    if (!this.lastMoveFrom || !this.lastMoveTo) {
      return null;
    }
    const center = (square: string) => {
      const file = square.charCodeAt(0) - 97;
      const rank = Number(square.charAt(1));
      const column = this.orientation === "w" ? file : 7 - file;
      const row = this.orientation === "w" ? 8 - rank : rank - 1;
      return { x: (column + 0.5) * 12.5, y: (row + 0.5) * 12.5 };
    };
    const from = center(this.lastMoveFrom);
    const to = center(this.lastMoveTo);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return {
      left: `${from.x}%`,
      top: `${from.y}%`,
      width: `${Math.sqrt(dx * dx + dy * dy)}%`,
      transform: `translateY(-50%) rotate(${Math.atan2(dy, dx) * (180 / Math.PI)}deg)`,
    };
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
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 2px;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--ui-surface, #fff);
}

.lf-chess-stage {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  width: 100%;
  max-width: 100%;
  max-height: 100%;
}

.lf-chess-captures {
  display: flex;
  flex: 0 0 9px;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 9px;
  min-width: 0;
  overflow: hidden;
}

.lf-chess-captured-piece {
  display: grid;
  flex: 0 0 8px;
  width: 8px;
  height: 9px;
  place-items: center;
  font-family: "DejaVu Sans", "Noto Sans Symbols 2", "Segoe UI Symbol", "Apple Symbols", sans-serif;
  font-size: 9px;
  font-variant-emoji: text;
  line-height: 1;

  &.white {
    color: #fff;
    text-shadow: 0 0 1px #000, 0 1px 1px #000, 1px 0 1px #000, -1px 0 1px #000;
  }

  &.black {
    color: #000;
    text-shadow: 0 0 1px rgba(255, 255, 255, 0.7);
  }
}

.lf-chess-turn {
  flex: 0 0 11px;
  height: 11px;
  overflow: hidden;
  color: var(--ui-text-muted, #666);
  font-size: 9px;
  font-weight: 600;
  line-height: 11px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  margin-bottom: 0;
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
  // A one-finger gesture stays with the board so long-press remains reliable; two fingers retain
  // native page zoom instead of this interactive surface becoming a pinch-zoom dead zone.
  touch-action: pinch-zoom;
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
  &.last-move::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    background: rgba(245, 225, 66, 0.32);
    pointer-events: none;
  }
  &.last-to::before {
    background: rgba(245, 225, 66, 0.44);
  }
  &.selected {
    box-shadow: inset 0 0 0 3px #f1c40f;
  }
  &.capture {
    box-shadow: inset 0 0 0 3px rgba(46, 204, 113, 0.9);
  }
}

.lf-chess-piece {
  position: relative;
  z-index: 3;
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
    color: #fff;
    text-shadow: 0 0 1px #000, 0 0 1px #000, 0 1px 1px #000, 1px 0 1px #000, 0 -1px 1px #000, -1px 0 1px #000;
  }
  &.black {
    color: #000;
    text-shadow: 0 0 1px #000;
  }
}

.lf-chess-dot {
  position: absolute;
  width: 26%;
  height: 26%;
  border-radius: 50%;
  background: rgba(46, 204, 113, 0.75);
  z-index: 3;
  pointer-events: none;
}

.lf-chess-last-arrow {
  position: absolute;
  z-index: 2;
  height: 3px;
  transform-origin: 0 50%;
  border-radius: 2px;
  background: rgba(36, 125, 65, 0.78);
  box-shadow: 0 0 1px rgba(255, 255, 255, 0.75);
  pointer-events: none;

  &::after {
    content: "";
    position: absolute;
    right: -1px;
    top: 50%;
    width: 0;
    height: 0;
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    border-left: 8px solid rgba(36, 125, 65, 0.86);
    transform: translate(50%, -50%);
  }
}

.lf-chess-overlay {
  position: absolute;
  z-index: 4;
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
    color: #fff;
    text-shadow: 0 0 1px #000, 0 1px 1px #000, 1px 0 1px #000, -1px 0 1px #000, 0 -1px 1px #000;
    background: #777;
  }
  &.black {
    color: #000;
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
