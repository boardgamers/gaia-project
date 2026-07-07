<template>
  <div
    ref="root"
    :class="['premove-bar', { 'premove-bar--sticky-mobile': stickyMobile }]"
    :style="{ '--premove-bottom-offset': `${bottomOffset}px` }"
  >
    <div v-if="willFireLine" class="premove-bar__will-fire small">{{ willFireLine }}</div>

    <div v-if="rows.length > 0" class="premove-bar__tabs d-flex flex-wrap" role="tablist">
      <button
        v-for="(row, i) in rows"
        :key="row.seq"
        type="button"
        role="tab"
        class="premove-bar__tab"
        :aria-selected="selectedSeq === row.seq"
        :class="{ 'premove-bar__tab--active': selectedSeq === row.seq, 'text-muted': !legalMap[row.seq] }"
        @click="toggleSelected(row.seq)"
      >
        {{ tabLabel(i) }}
      </button>
    </div>

    <div class="premove-bar__actions d-flex align-items-center flex-wrap">
      <button
        type="button"
        class="btn btn-sm btn-secondary premove-bar__action-button mr-2 mb-2"
        :disabled="!canStartNew('sequential')"
        @click="requestStartNew('sequential')"
      >
        + Sequential premove
      </button>
      <button
        type="button"
        class="btn btn-sm btn-secondary premove-bar__action-button mr-2 mb-2"
        :disabled="!canStartNew('priority')"
        @click="requestStartNew('priority')"
      >
        + Priority premove
      </button>
      <button type="button" class="btn btn-link btn-sm p-0 mb-2 premove-bar__info-link" v-b-modal.premove-info>
        ⓘ What's the difference?
      </button>
    </div>

    <div v-if="selectedRow" class="premove-bar__detail small">
      <div class="premove-bar__detail-move">{{ selectedRow.move }}</div>
      <div v-if="!legalMap[selectedRow.seq]" class="text-muted">no longer possible</div>
      <div v-else-if="staleness(selectedRow) > 0" class="text-muted">
        queued {{ staleness(selectedRow) }} move{{ staleness(selectedRow) === 1 ? "" : "s" }} ago
      </div>
      <div v-if="mode === 'sequential' && downstreamCount(selectedRow) > 0" class="text-warning mt-1">
        Editing this will also discard the {{ downstreamCount(selectedRow) }} premove{{
          downstreamCount(selectedRow) === 1 ? "" : "s"
        }}
        queued after it.
      </div>
      <div class="mt-2 premove-bar__detail-actions d-flex flex-wrap">
        <button type="button" class="btn btn-sm btn-secondary premove-bar__mini-button mr-1 mb-1" @click="edit(selectedRow)">
          Edit
        </button>
        <button
          v-if="mode === 'priority' && selectedIndex > 0"
          type="button"
          class="btn btn-sm btn-secondary premove-bar__mini-button mr-1 mb-1"
          title="Move up"
          @click="reorder(selectedRow.seq, 'up')"
        >
          Move up
        </button>
        <button
          v-if="mode === 'priority' && selectedIndex < rows.length - 1"
          type="button"
          class="btn btn-sm btn-secondary premove-bar__mini-button mr-1 mb-1"
          title="Move down"
          @click="reorder(selectedRow.seq, 'down')"
        >
          Move down
        </button>
        <button type="button" class="btn btn-sm btn-secondary premove-bar__mini-button mr-1 mb-1" @click="cancel(selectedRow)">
          Cancel premove
        </button>
      </div>
    </div>

    <div v-if="autoCharge === 'ask' && rows.length > 0" class="text-muted small mt-1">
      A charge decision before your turn will still pause until you're online - enable auto-charge in preferences to
      fully automate.
    </div>

    <b-modal id="premove-info" size="lg" title="Premove modes" ok-only>
      <p>
        <b>Sequential</b> is a chain of your next turns: entry 2 is previewed assuming entry 1 already landed, and so
        on. It's throughput - more of your own turns get played while you're away. If an early link breaks (the board
        changed enough that it's no longer legal), everything queued behind it is discarded too, since it was planned
        assuming that link would land. Editing a link has the same effect as breaking it, for the same reason.
      </p>
      <p>
        <b>Priority</b> is up to 3 ranked alternatives for your <i>single</i> upcoming turn. The first one that's
        still legal when your turn arrives is the one that plays; the rest are discarded. It's insurance - useful for
        "pass taking booster A, or B, or C" or any contested claim (federation token, advanced tech, artifact) where
        you want a fallback instead of a single bet. Editing one rank never affects the others.
      </p>
      <p class="text-muted small">
        Neither mode can tell "still legal" from "still a good idea" - Priority only falls through on an
        <i>illegal</i> option, not a merely worse one. Switching between modes clears your current queue, since the
        two interpret the queue differently. A pending charge/leech decision before your turn still needs
        auto-charge enabled to resolve automatically while you're offline.
      </p>
    </b-modal>
  </div>
</template>

<script lang="ts">
import Engine, { PlayerEnum } from "@gaia-project/engine";
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import { PremoveMode, PremoveRow } from "../hosted/types";
import { buildSequentialChainPreview } from "../logic/premove-preview";

@Component
export default class PremoveBar extends Vue {
  @Prop()
  seat: number;

  @Prop()
  composeModePreference: PremoveMode;

  @Prop({ default: false })
  stickyMobile: boolean;

  @Prop({ default: 0 })
  bottomOffset: number;

  private selectedSeq: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  get engine(): Engine {
    return this.$store.state.data;
  }

  get autoCharge(): string {
    return this.$store.state.preferences.autoChargePower as string;
  }

  get rows(): PremoveRow[] {
    return ((this.$store.state.premoves as PremoveRow[]) ?? [])
      .filter((p) => p.seat === this.seat)
      .sort((a, b) => a.seq - b.seq);
  }

  get mode(): PremoveMode {
    return this.rows.length > 0 ? this.rows[0].mode : this.composeModePreference;
  }

  get selectedRow(): PremoveRow | null {
    return this.rows.find((r) => r.seq === this.selectedSeq) ?? null;
  }

  get selectedIndex(): number {
    return this.rows.findIndex((r) => r.seq === this.selectedSeq);
  }

  tabLabel(index: number): string {
    return `${this.mode === "sequential" ? "Premove" : "Priority"} ${index + 1}`;
  }

  toggleSelected(seq: number) {
    this.selectedSeq = this.selectedSeq === seq ? null : seq;
  }

  downstreamCount(row: PremoveRow): number {
    return this.rows.filter((r) => r.seq > row.seq).length;
  }

  get committedMoveCount(): number {
    return this.engine.moveHistory.length - 1;
  }

  staleness(row: PremoveRow): number {
    return this.committedMoveCount - row.queued_move_count;
  }

  private isLegal(base: Engine, move: string): boolean {
    const clone = Engine.fromData(JSON.parse(JSON.stringify(base)));
    clone.currentPlayer = this.seat as PlayerEnum;
    clone.tempCurrentPlayer = undefined;
    clone.generateAvailableCommands();
    try {
      clone.move(move);
      clone.generateAvailableCommandsIfNeeded();
      return clone.newTurn;
    } catch {
      return false;
    }
  }

  get legalMap(): Record<number, boolean> {
    const result: Record<number, boolean> = {};
    if (this.rows.length === 0) {
      return result;
    }
    if (this.mode === "priority") {
      // Every rank previews against the SAME fresh current state (§10.1) - independent of each other.
      for (const row of this.rows) {
        result[row.seq] = this.isLegal(this.engine, row.move);
      }
      return result;
    }
    // Sequential: each entry previews against a clone with every earlier entry already applied; a
    // broken link makes everything behind it moot too (mirrors the resolver's own cascade, §10.5).
    let priorMoves: string[] = [];
    let broken = false;
    for (const row of this.rows) {
      if (broken) {
        result[row.seq] = false;
        continue;
      }
      const clone = buildSequentialChainPreview(this.engine, this.seat, priorMoves);
      const ok = this.isLegal(clone, row.move);
      result[row.seq] = ok;
      if (ok) {
        priorMoves = [...priorMoves, row.move];
      } else {
        broken = true;
      }
    }
    return result;
  }

  get willFireLine(): string | null {
    if (this.rows.length === 0 || this.engine.playerToMove === this.seat) {
      return null;
    }
    if (this.mode === "sequential") {
      return this.legalMap[this.rows[0].seq] ? `Next: ${this.rows[0].move}` : null;
    }
    const map = this.legalMap;
    const firstLegalIndex = this.rows.findIndex((r) => map[r.seq]);
    if (firstLegalIndex === -1) {
      return null;
    }
    return `Priority ${firstLegalIndex + 1} will play: ${this.rows[firstLegalIndex].move}`;
  }

  canStartNew(candidateMode: PremoveMode): boolean {
    if (this.rows.length === 0) {
      return true;
    }
    if (this.mode === candidateMode) {
      return this.rows.length < 3;
    }
    // A different mode is always startable - switching clears the existing queue first (with a
    // confirm), same invariant as before this redesign.
    return true;
  }

  requestStartNew(mode: PremoveMode) {
    if (this.rows.length > 0 && this.mode !== mode) {
      if (typeof window !== "undefined" && !window.confirm(`Switching to ${mode} mode clears your current queue. Continue?`)) {
        return;
      }
      this.$store.dispatch("cancelAllPremoves", { seat: this.seat });
      this.$emit("mode-preference", mode);
      // The switch (cancelAllPremoves) is async and may not have landed in the store yet - tell
      // the parent this is a fresh start regardless, so it doesn't compose against a queue that's
      // about to disappear.
      this.$emit("start-new", { mode, switchingModes: true });
      this.selectedSeq = null;
      return;
    }
    this.$emit("mode-preference", mode);
    this.$emit("start-new", { mode, switchingModes: false });
  }

  edit(row: PremoveRow) {
    this.$emit("start-edit", row.seq);
  }

  cancel(row: PremoveRow) {
    // §10.6: cascade in Sequential (everything behind a cancelled entry was previewed assuming it
    // landed), single-row in Priority (each rank is independent).
    const toCancel = this.mode === "sequential" ? this.rows.filter((r) => r.seq >= row.seq) : [row];
    for (const r of toCancel) {
      this.$store.dispatch("cancelPremove", { seat: this.seat, seq: r.seq });
    }
    if (this.selectedSeq !== null && toCancel.some((r) => r.seq === this.selectedSeq)) {
      this.selectedSeq = null;
    }
  }

  reorder(seq: number, direction: "up" | "down") {
    this.$store.dispatch("reorderPremove", { seat: this.seat, seq, direction });
  }

  mounted() {
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.emitBarHeight());
      this.resizeObserver.observe(this.$refs.root as Element);
    }
    this.emitBarHeight();
  }

  beforeDestroy() {
    this.resizeObserver?.disconnect();
    this.$emit("bar-height", 0);
  }

  @Watch("stickyMobile")
  @Watch("bottomOffset")
  onLayoutChanged() {
    this.$nextTick(() => this.emitBarHeight());
  }

  private emitBarHeight() {
    const root = this.$refs.root as HTMLElement | undefined;
    this.$emit("bar-height", this.stickyMobile && root ? root.getBoundingClientRect().height : 0);
  }
}
</script>

<style lang="scss">
.premove-bar {
  border: 1px solid var(--systemGray5, #e5e5ea);
  border-radius: 0.9rem;
  padding: 0.7rem 0.7rem 0.6rem;
  background: linear-gradient(180deg, #ffffff 0%, #eef1f6 100%);
  box-shadow: 0 8px 24px rgba(20, 26, 50, 0.12), 0 1px 2px rgba(31, 45, 82, 0.08);

  &__will-fire {
    margin-bottom: 0.35rem;
    font-weight: 600;
    color: #33415c;
  }

  &__tabs {
    margin: -1.2rem 0 0.55rem;
    gap: 0.3rem;
    padding-left: 0.15rem;
  }

  &__action-button,
  &__mini-button {
    border-radius: 10px;
    border-color: rgba(31, 45, 82, 0.14);
    background: linear-gradient(180deg, #ffffff 0%, #e7ebf3 100%);
    color: #33415c;
    box-shadow: 0 1px 2px rgba(31, 45, 82, 0.08);
  }

  &__tab {
    border: 1px solid rgba(28, 43, 74, 0.16);
    border-bottom: 0;
    background: linear-gradient(180deg, #f9fbff 0%, #e8edf5 100%);
    border-radius: 14px 14px 0 0;
    padding: 0.28rem 0.8rem 0.32rem;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 -1px 0 rgba(255, 255, 255, 0.7), 0 8px 18px rgba(20, 26, 50, 0.08);

    &--active {
      background: #1c2b4a;
      color: white;
      border-color: #1c2b4a;
    }
  }

  &__detail {
    margin-top: 0.5rem;
    padding: 0.4rem 0.5rem;
    background: white;
    border: 1px solid var(--systemGray5, #e5e5ea);
    border-radius: 0.4rem;
  }

  &__detail-move {
    font-weight: 600;
  }

  &__detail-actions {
    gap: 0.15rem;
  }
}

@media (max-width: 767px) {
  .premove-bar--sticky-mobile {
    position: fixed;
    left: 0;
    right: 0;
    bottom: var(--premove-bottom-offset, 0px);
    z-index: 1029;
    max-height: 35vh;
    overflow-y: auto;
    margin: 0;
    padding: 0.7rem calc(0.5rem + env(safe-area-inset-right)) calc(0.45rem + env(safe-area-inset-bottom) + 8px)
      calc(0.5rem + env(safe-area-inset-left));
    border-radius: 16px 16px 0 0;
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
    background: linear-gradient(180deg, #ffffff 0%, #eef1f6 100%);
    box-shadow: 0 -12px 28px rgba(20, 26, 50, 0.18), 0 -1px 0 rgba(255, 255, 255, 0.6);

    .premove-bar__action-button {
      transition: transform 0.08s ease-out, box-shadow 0.08s ease-out;

      &:active {
        transform: scale(0.97);
        box-shadow: inset 0 1px 2px rgba(31, 45, 82, 0.15);
      }
    }
  }
}
</style>
