<template>
  <!-- Analysis mode's whole control surface (ANALYSIS_MODE_PLAN.md §12). It lives in the striped
       header because that header already exists, already says "not live", and is already the one
       thing still on screen on a phone once the map has scrolled away - so the separate panel above
       the map was a second container carrying nothing this one could not.
       @click.stop: a press on these controls must not read as a press on the header behind them. -->
  <div class="analysis-controls" @click.stop>
    <span class="analysis-controls__moves">{{ moveCount }} {{ moveCount === 1 ? "move" : "moves" }}</span>

    <!-- The only numbers left. Everything per-resource is on the player board now, live, in the place
         players already read it; these three are what the board cannot say for itself. -->
    <span
      v-if="overdrawn.length > 0"
      class="analysis-controls__overdrawn"
      title="This line spends more than you have - the player board shows the same numbers in red"
    >
      <span v-for="item in overdrawn" :key="item.kind">{{ item.amount }}{{ item.kind }}</span>
    </span>
    <!-- The running total of Charge 1 presses. A charge and a later power spend both just move
         tokens between bowls, so once the line has spent it the board can read exactly as it did
         before - which made "did my charge land?" unanswerable from the board and left the player
         counting presses in their head. -->
    <span
      v-if="chargedPower > 0"
      class="analysis-controls__charged"
      title="Power you have told the sandbox to assume you charge (the Charge 1 button)"
    >
      +{{ chargedPower }} charged
    </span>
    <span
      v-if="assumedPower > 0"
      class="analysis-controls__assumed"
      title="A power cost was more than this seat had, so the sandbox assumed that much was charged first"
    >
      +{{ assumedPower }} power
    </span>

    <!-- Undo/Reset used to sit here. They are icons in the map's bottom-right corner now
         (SpaceMap.vue), beside the sandbox toggle itself, so the whole sandbox control cluster is in
         one place; Commit stays because it is the one control that leaves the sandbox for the real
         game, and it belongs next to the counts it acts on. -->
    <b-button
      v-if="moveCount > 0"
      size="sm"
      variant="success"
      class="analysis-controls__btn"
      :disabled="committableMoves === 0"
      :title="commitTitle"
      @click="$emit('commit')"
    >
      Commit
    </b-button>
    <!-- The modal itself is rendered once by Commands.vue (AnalysisModeInfo.vue) - see its comment for
         why it must not live in this twice-rendered component. -->
    <b-btn
      variant="link"
      size="sm"
      class="analysis-controls__info"
      aria-label="How sandbox mode works"
      title="How sandbox mode works"
      @click="$bvModal.show('analysis-mode-info')"
    >
      <b-badge variant="info" pill>i</b-badge>
    </b-btn>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import type { AnalysisOverdraft, AnalysisStatus } from "../logic/analysis";

export default Vue.extend({
  name: "AnalysisHeaderControls",
  props: {
    moveCount: { type: Number, default: 0 },
    status: { type: Object as () => AnalysisStatus | null, default: null },
    committableMoves: { type: Number, default: 0 },
  },
  computed: {
    overdrawn(): AnalysisOverdraft[] {
      return (this.status as AnalysisStatus | null)?.overdrawn ?? [];
    },
    assumedPower(): number {
      return (this.status as AnalysisStatus | null)?.assumedPower ?? 0;
    },
    chargedPower(): number {
      return (this.status as AnalysisStatus | null)?.chargedPower ?? 0;
    },
    commitTitle(): string {
      const n = this.committableMoves as number;
      return n === 0
        ? "Nothing in this line can be played for real yet"
        : `Play ${n} move${n === 1 ? "" : "s"} for real (first live, rest queued as premoves)`;
    },
  },
});
</script>

<style lang="scss" scoped>
.analysis-controls {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: auto;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

// The header behind these sits under yellow/black hazard stripes, so every text run needs its own
// backing to stay legible (§5.1's "solid or scrimmed text backing, not raw text on stripes") - and
// that backing has to be OPAQUE (owner report, 2026-08-20: "the 8 moves label is transparent making
// it hard to read"). At rgba(0,0,0,0.55) the diagonals ran straight through the chip behind the
// digits; the measured contrast was fine either way, but text on a moving pattern reads as a smear
// regardless of its ratio. Same solid fill as Commands.vue's $analysis-scrim, kept in sync by eye
// rather than by import - these are scoped styles and the variable lives in another component.
.analysis-controls__moves,
.analysis-controls__overdrawn,
.analysis-controls__charged,
.analysis-controls__assumed {
  white-space: nowrap;
  background: #1b1b20;
  border-radius: 0.3rem;
  padding: 0.05rem 0.35rem;
}

.analysis-controls__moves {
  color: #fff;
}

.analysis-controls__overdrawn {
  display: flex;
  gap: 0.25rem;
  color: #ff8a80;
  font-weight: 600;
}

.analysis-controls__assumed {
  color: #ffe082;
  font-weight: 600;
}

// Deliberately a different colour from the assumed-power chip beside it: one is power the PLAYER
// asked the sandbox to pretend they charged, the other is power the sandbox topped up on its own.
.analysis-controls__charged {
  color: #80d8ff;
  font-weight: 600;
}

.analysis-controls__btn {
  padding: 0.05rem 0.35rem;
  line-height: 1.2;
  font-weight: 600;
}

// Commit is disabled until something in the line is committable, and that state was the unreadable
// one on the hazard stripes: full opacity has to be forced (Bootstrap's .65 turns stripes into mush)
// and over `--ui-surface-muted` the label was `--ui-text-subtle`, i.e. a grey-on-grey pair sitting
// around 3:1 in both themes. Same muted surface, a text colour that can actually be read on it.
.analysis-controls__btn:disabled,
.analysis-controls__btn.disabled {
  opacity: 1;
  background: var(--ui-surface-muted);
  border-color: var(--ui-border-strong);
  color: var(--ui-text-muted);
}

.analysis-controls__btn.btn-success {
  border-radius: 10px;
  box-shadow: 0 1px 2px var(--ui-shadow-soft);
}

.analysis-controls__info {
  padding: 0 0.15rem;
  line-height: 1;
  text-decoration: none;
}
</style>
