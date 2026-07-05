<template>
  <b-modal id="premove-overview" size="lg" :title="`⚡ Premoves (${rows.length}/3)`" ok-only ok-title="Close">
    <div class="premove-overview">
      <div class="d-flex align-items-center mb-3">
        <div class="btn-group btn-group-sm mr-2" role="group" aria-label="Premove mode">
          <button
            type="button"
            class="btn"
            :class="mode === 'sequential' ? 'btn-primary' : 'btn-outline-secondary'"
            @click="trySwitchMode('sequential')"
          >
            Sequential
          </button>
          <button
            type="button"
            class="btn"
            :class="mode === 'priority' ? 'btn-primary' : 'btn-outline-secondary'"
            @click="trySwitchMode('priority')"
          >
            Priority
          </button>
        </div>
        <button type="button" class="btn btn-link btn-sm p-0" v-b-modal.premove-info>ⓘ What's the difference?</button>
      </div>

      <div v-if="willFireLine" class="alert alert-light small py-1 px-2 mb-2">{{ willFireLine }}</div>

      <div v-if="autoCharge === 'ask'" class="text-muted small mb-2">
        A charge decision before your turn will still pause until you're online - enable auto-charge in preferences
        to fully automate.
      </div>

      <div v-if="rows.length === 0" class="text-muted small">Nothing queued yet - use "Plan my move ▸" on the board.</div>

      <div
        v-for="(row, i) in rows"
        :key="row.seq"
        class="premove-row d-flex align-items-start mb-2"
        :class="{ 'text-muted': !legalMap[row.seq] }"
      >
        <div class="mr-2">{{ i + 1 }}.</div>
        <div class="flex-grow-1">
          <div>{{ row.move }}</div>
          <div class="small">
            <span v-if="!legalMap[row.seq]">no longer possible</span>
            <span v-else-if="staleness(row) > 0" class="text-muted"
              >queued {{ staleness(row) }} move{{ staleness(row) === 1 ? "" : "s" }} ago</span
            >
          </div>
        </div>
        <div class="ml-2 text-nowrap">
          <button
            v-if="mode === 'priority' && i > 0"
            type="button"
            class="btn btn-link btn-sm p-0 mr-1"
            title="Move up"
            @click="reorder(row.seq, 'up')"
          >
            ▲
          </button>
          <button
            v-if="mode === 'priority' && i < rows.length - 1"
            type="button"
            class="btn btn-link btn-sm p-0 mr-1"
            title="Move down"
            @click="reorder(row.seq, 'down')"
          >
            ▼
          </button>
          <button type="button" class="btn btn-link btn-sm p-0 text-danger" title="Cancel" @click="cancel(row)">✕</button>
        </div>
      </div>
    </div>

    <b-modal id="premove-info" size="lg" title="Premove modes" ok-only>
      <p>
        <b>Sequential</b> is a chain of your next turns: entry 2 is previewed assuming entry 1 already landed, and so
        on. It's throughput - more of your own turns get played while you're away. If an early link breaks (the board
        changed enough that it's no longer legal), everything queued behind it is discarded too, since it was planned
        assuming that link would land.
      </p>
      <p>
        <b>Priority</b> is up to 3 ranked alternatives for your <i>single</i> upcoming turn. The first one that's
        still legal when your turn arrives is the one that plays; the rest are discarded. It's insurance - useful for
        "pass taking booster A, or B, or C" or any contested claim (federation token, advanced tech, artifact) where
        you want a fallback instead of a single bet.
      </p>
      <p class="text-muted small">
        Neither mode can tell "still legal" from "still a good idea" - Priority only falls through on an
        <i>illegal</i> option, not a merely worse one. Switching between modes clears your current queue, since the
        two interpret the queue differently. A pending charge/leech decision before your turn still needs
        auto-charge enabled to resolve automatically while you're offline.
      </p>
    </b-modal>
  </b-modal>
</template>

<script lang="ts">
import Engine, { PlayerEnum } from "@gaia-project/engine";
import { Component, Prop, Vue } from "vue-property-decorator";
import { PremoveMode, PremoveRow } from "../hosted/types";
import { buildSequentialChainPreview } from "../logic/premove-preview";

@Component
export default class PremoveModal extends Vue {
  @Prop()
  seat: number;

  @Prop()
  composeModePreference: PremoveMode;

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

  trySwitchMode(newMode: PremoveMode) {
    if (newMode === this.mode) {
      return;
    }
    if (this.rows.length > 0) {
      if (typeof window !== "undefined" && !window.confirm(`Switching to ${newMode} mode clears your current queue. Continue?`)) {
        return;
      }
      this.$store.dispatch("cancelAllPremoves", { seat: this.seat });
    }
    this.$emit("mode-preference", newMode);
  }

  cancel(row: PremoveRow) {
    // §10.6: cascade in Sequential (everything behind a cancelled entry was previewed assuming it
    // landed), single-row in Priority (each rank is independent).
    const toCancel = this.mode === "sequential" ? this.rows.filter((r) => r.seq >= row.seq) : [row];
    for (const r of toCancel) {
      this.$store.dispatch("cancelPremove", { seat: this.seat, seq: r.seq });
    }
  }

  reorder(seq: number, direction: "up" | "down") {
    this.$store.dispatch("reorderPremove", { seat: this.seat, seq, direction });
  }
}
</script>
