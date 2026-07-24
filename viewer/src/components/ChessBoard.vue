<template>
  <div class="lf-chess" ref="root">
    <!-- Slim status/controls bar: whose turn / result on the left, seat + close controls on the right. -->
    <div class="lf-chess-bar">
      <span class="lf-chess-status" :class="{ warn: inCheck || gameOver }">{{ statusText }}</span>
      <span class="lf-chess-controls">
        <template v-if="online">
          <button
            v-if="myColor === null && whiteUser === null"
            type="button"
            class="lf-chess-btn"
            title="Play as White"
            @click="claim('w')"
          >
            Play ♔
          </button>
          <button
            v-if="myColor === null && blackUser === null"
            type="button"
            class="lf-chess-btn dark"
            title="Play as Black"
            @click="claim('b')"
          >
            Play ♚
          </button>
          <button v-if="myColor !== null" type="button" class="lf-chess-btn" title="Leave your seat" @click="leaveSeat">
            Leave
          </button>
        </template>
        <button type="button" class="lf-chess-btn" title="Back to boosters" @click="$emit('close')">✕</button>
      </span>
    </div>

    <!-- The board fills the container width exactly and stays square. -->
    <div
      class="lf-chess-board"
      ref="board"
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
          :class="cell.piece.color === 'w' ? 'white' : 'black'"
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
import { Component } from "vue-property-decorator";
import { getSupabaseClient } from "../hosted/supabase-client";
import { ChessInstance, loadChess } from "../logic/chess-lib";
import { Cell, DisplaySquare, Orientation, START_FEN, displaySquares, pieceGlyph, promotionRank } from "../logic/chess";

const LOCAL_KEY = "lf-chess-fen";

@Component
export default class ChessBoard extends Vue {
  private chess: ChessInstance | null = null;
  private client: any = null;
  private unsubscribe: (() => void) | null = null;
  // Typed loosely: ResizeObserver isn't in this repo's TS 3.9 DOM lib.
  private resizeObserver: any = null;

  fen = START_FEN;
  whiteUser: string | null = null;
  blackUser: string | null = null;
  myUserId: string | null = null;
  online = false;

  selected: string | null = null;
  selectedPiece: Cell = null;
  legalTargets: string[] = [];
  promotion: { from: string; to: string; color: Orientation } | null = null;
  showResetConfirm = false;
  errorText = "";

  pieceFont = 18;

  // long-press bookkeeping
  private pressTimer: number | null = null;
  private pressStart: { x: number; y: number } | null = null;
  private suppressClick = false;

  async mounted() {
    const Ctor = await loadChess();
    this.chess = new Ctor(START_FEN);
    this.observeSize();
    await this.connect();
  }

  beforeDestroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this.resizeObserver && this.$refs.board) {
      this.resizeObserver.disconnect();
    }
    this.clearPressTimer();
  }

  // ---- setup / sync -------------------------------------------------------

  private observeSize() {
    const board = this.$refs.board as HTMLElement | undefined;
    if (!board) {
      return;
    }
    const measure = () => {
      this.pieceFont = Math.max(10, (board.clientWidth / 8) * 0.74);
    };
    measure();
    const RO = (window as any).ResizeObserver;
    if (typeof RO !== "undefined") {
      this.resizeObserver = new RO(measure);
      this.resizeObserver.observe(board);
    }
  }

  private async connect() {
    try {
      this.client = await getSupabaseClient();
      const { data } = await this.client.auth.getSession();
      this.myUserId = data?.session?.user?.id ?? null;
      if (!this.myUserId) {
        this.goOffline();
        return;
      }
      this.online = true;
      await this.fetchRow();
      this.subscribe();
    } catch (e) {
      this.goOffline();
    }
  }

  // No auth (self-contained / signed-out): fall back to a local, unshared sandbox where either side
  // can be moved, so the board still works. Not persisted to the server.
  private goOffline() {
    this.online = false;
    const stored = window.localStorage.getItem(LOCAL_KEY);
    if (stored && this.chess && this.chess.load(stored)) {
      this.fen = stored;
    }
  }

  private async fetchRow() {
    const { data, error } = await this.client
      .from("chess_board")
      .select("fen,white_user,black_user")
      .eq("id", "global")
      .single();
    if (!error && data) {
      this.applyRow(data);
    }
  }

  private subscribe() {
    const channel = this.client
      .channel("chess_board-global")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chess_board", filter: "id=eq.global" },
        (payload: { new: any }) => this.applyRow(payload.new)
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          this.fetchRow();
        }
      });
    this.unsubscribe = () => this.client.removeChannel(channel);
  }

  private applyRow(row: { fen: string; white_user: string | null; black_user: string | null }) {
    this.whiteUser = row.white_user;
    this.blackUser = row.black_user;
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
      window.localStorage.setItem(LOCAL_KEY, nextFen);
      return;
    }
    this.client
      .rpc("move_chess", { p_prev_fen: prevFen, p_next_fen: nextFen })
      .then(({ data, error }: { data: string | null; error: any }) => {
        if (error) {
          // Rejected (not your move / concurrency) - snap back to the server's truth.
          this.fetchRow();
          return;
        }
        if (typeof data === "string" && data !== nextFen) {
          // Someone moved first; the RPC handed back the current board.
          this.applyFen(data);
          this.fetchRow();
        }
      })
      .catch(() => this.fetchRow());
  }

  private clearSelection() {
    this.selected = null;
    this.selectedPiece = null;
    this.legalTargets = [];
  }

  // ---- seats / reset ------------------------------------------------------

  claim(color: Orientation) {
    if (!this.online) {
      return;
    }
    this.client.rpc("claim_chess_color", { p_color: color }).then(() => this.fetchRow());
  }

  leaveSeat() {
    if (!this.online) {
      return;
    }
    this.client.rpc("leave_chess_seat").then(() => this.fetchRow());
  }

  confirmReset() {
    this.showResetConfirm = false;
    if (!this.online) {
      if (this.chess) {
        this.chess.load(START_FEN);
        this.fen = START_FEN;
        window.localStorage.setItem(LOCAL_KEY, START_FEN);
        this.clearSelection();
      }
      return;
    }
    this.client
      .rpc("reset_chess")
      .then(({ error }: { error: any }) => {
        if (error) {
          this.errorText = "Only a seated player can reset.";
        }
      })
      .catch(() => undefined);
  }

  // ---- long press (reset) -------------------------------------------------

  onPointerDown(e: PointerEvent) {
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

  private clearPressTimer() {
    if (this.pressTimer !== null) {
      window.clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  // ---- derived ------------------------------------------------------------

  get myColor(): Orientation | null {
    if (this.myUserId && this.whiteUser === this.myUserId) {
      return "w";
    }
    if (this.myUserId && this.blackUser === this.myUserId) {
      return "b";
    }
    return null;
  }

  // Which colour the local user is allowed to move: their seat online, or either side offline.
  get effectiveColor(): Orientation | null {
    if (!this.online) {
      return this.chess ? this.chess.turn() : "w";
    }
    return this.myColor;
  }

  get orientation(): Orientation {
    return this.myColor ?? "w";
  }

  get cells(): DisplaySquare[] {
    if (!this.chess) {
      return [];
    }
    return displaySquares(this.chess.board(), this.orientation);
  }

  get inCheck(): boolean {
    return this.chess ? this.chess.in_check() : false;
  }

  get gameOver(): boolean {
    return this.chess ? this.chess.game_over() : false;
  }

  get statusText(): string {
    if (this.errorText) {
      return this.errorText;
    }
    if (!this.chess) {
      return "Loading…";
    }
    if (this.chess.in_checkmate()) {
      return `Checkmate — ${this.chess.turn() === "w" ? "Black" : "White"} wins`;
    }
    if (this.chess.in_stalemate()) {
      return "Stalemate — draw";
    }
    if (this.chess.in_draw()) {
      return "Draw";
    }
    const toMove = this.chess.turn() === "w" ? "White" : "Black";
    const check = this.chess.in_check() ? " (check)" : "";
    if (!this.online) {
      return `Local board — ${toMove} to move${check}`;
    }
    if (this.myColor) {
      const mine = this.myColor === this.chess.turn();
      return `You: ${this.myColor === "w" ? "White" : "Black"} — ${mine ? "your move" : toMove + " to move"}${check}`;
    }
    return `Spectating — ${toMove} to move${check}`;
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
}

.lf-chess-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  font-size: 0.7rem;
  line-height: 1.1;
  margin-bottom: 4px;
  min-height: 1.2em;
}

.lf-chess-status {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-text, inherit);

  &.warn {
    color: var(--highlighted, #c0392b);
    font-weight: bold;
  }
}

.lf-chess-controls {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
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

  &.dark {
    background: #333;
    color: #fff;
  }
  &.danger {
    background: #c0392b;
    color: #fff;
    border-color: #a5281b;
  }
}

.lf-chess-board {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
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
  line-height: 1;
  pointer-events: none;

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
