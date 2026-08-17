<template>
  <!-- Analysis mode's whole control surface (ANALYSIS_MODE_PLAN.md §12). It lives in the striped
       header because that header already exists, already says "not live", and is already the one
       thing still on screen on a phone once the map has scrolled away - so the separate panel above
       the map was a second container carrying nothing this one could not.
       @click.stop: a press on these controls must not read as a press on the header behind them. -->
  <div class="analysis-controls" @click.stop>
    <span class="analysis-controls__moves">{{ moveCount }} {{ moveCount === 1 ? "move" : "moves" }}</span>

    <!-- The only numbers left. Everything per-resource is on the player board now, live, in the place
         players already read it; these two are what the board cannot say for itself. -->
    <span
      v-if="overdrawn.length > 0"
      class="analysis-controls__overdrawn"
      title="This line spends more than you have - the player board shows the same numbers in red"
    >
      <span v-for="item in overdrawn" :key="item.kind">{{ item.amount }}{{ item.kind }}</span>
    </span>
    <span
      v-if="assumedPower > 0"
      class="analysis-controls__assumed"
      title="A power cost was more than this seat had, so the sandbox assumed that much was charged first"
    >
      +{{ assumedPower }} power
    </span>

    <b-button
      size="sm"
      variant="outline-secondary"
      class="analysis-controls__btn"
      :disabled="moveCount === 0"
      title="Undo the last move in this line"
      @click="$emit('undo')"
    >
      Undo
    </b-button>
    <b-button
      size="sm"
      variant="outline-secondary"
      class="analysis-controls__btn"
      :disabled="moveCount === 0"
      title="Clear the whole line"
      @click="$emit('reset')"
    >
      Reset
    </b-button>
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
import { AnalysisOverdraft, AnalysisStatus } from "../logic/analysis";

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
// backing to stay legible (§5.1's "solid or scrimmed text backing, not raw text on stripes").
.analysis-controls__moves,
.analysis-controls__overdrawn,
.analysis-controls__assumed {
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.55);
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

.analysis-controls__btn {
  padding: 0.05rem 0.35rem;
  line-height: 1.2;
  font-weight: 600;
}

// Bootstrap's outline variants are transparent by design, so Undo/Reset were reading straight off the
// full-strength yellow/black hazard stripes behind them - §5.1's "solid text backing" applies to a
// button label just as much as to a text run. They are given the same keycap surface the action
// area's own move buttons wear (Commands.vue's `.move-button .btn` block: soft top-down gradient,
// 10px corners, a real border and a lifted edge), so the two rows of sandbox controls read as the
// same kind of control rather than two unrelated widgets.
//
// Scoped away from the Commit button, which is a solid `success` variant already and must stay green.
.analysis-controls__btn:not(.btn-success) {
  background: linear-gradient(180deg, var(--ui-keycap-gradient-start) 0%, var(--ui-keycap-gradient-end) 100%);
  border-color: var(--ui-border-strong);
  border-radius: 10px;
  box-shadow: 0 1px 2px var(--ui-shadow-soft);
  color: var(--ui-secondary-text);

  // `:not(:disabled)` so a hover over a disabled Undo/Reset cannot out-specify the disabled rule
  // below and repaint it as if it were pressable.
  &:not(:disabled):hover,
  &:not(:disabled):focus,
  &:not(:disabled):active {
    background: var(--ui-surface-hover);
    border-color: var(--ui-border-strong);
    color: var(--ui-text);
  }
}

// Disabled is the state these two spend most of their life in (Undo/Reset until the line has a move
// in it, Commit until something in it is committable), and it was the unreadable one: full opacity
// was already being forced - Bootstrap's .65 turns stripes into mush - but over `--ui-surface-muted`
// the label was `--ui-text-subtle`, i.e. a grey-on-grey pair sitting around 3:1 in both themes. Same
// muted surface, a text colour that can actually be read on it.
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
