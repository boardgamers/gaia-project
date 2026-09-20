<template>
  <!-- One confirmation for committing real moves, shared by desktop and mobile controls. -->
  <b-modal
    id="analysis-commit-confirm"
    size="lg"
    :title="view.live ? 'Play these moves?' : 'Queue these premoves?'"
    ok-variant="success"
    :ok-title="okTitle"
    cancel-title="Keep planning"
    :ok-disabled="total === 0"
    dialog-class="gaia-viewer-modal"
    @ok="$emit('confirm')"
  >
    <ol class="analysis-commit__list">
      <li v-if="view.live" class="analysis-commit__row analysis-commit__row--live">
        <span class="analysis-commit__badge analysis-commit__badge--live">plays now</span>
        <span class="analysis-commit__move">{{ view.live }}</span>
        <MoveCost :cost="view.costs && view.costs[0]" />
      </li>
      <li v-for="(move, i) in view.queued" :key="`q${i}`" class="analysis-commit__row analysis-commit__row--queued">
        <span class="analysis-commit__badge analysis-commit__badge--queued">premove {{ i + 1 }}</span>
        <span v-if="view.timings" class="small text-muted">{{
          view.timings[i + (view.live ? 1 : 0)].round === 0
            ? "Setup"
            : `Round ${view.timings[i + (view.live ? 1 : 0)].round}`
        }}</span>
        <span class="analysis-commit__move">{{ move }}</span>
        <MoveCost :cost="view.costs && view.costs[i + (view.live ? 1 : 0)]" />
        <span v-if="isCheapAnalysisBuild(move)" class="small">3c only</span>
      </li>
    </ol>

    <!-- Show the unsent tail; it stays in the local plan. -->
    <template v-if="view.dropped.length > 0">
      <p class="analysis-commit__dropped-head">
        {{ view.dropped.length }} more {{ view.dropped.length === 1 ? "move stays" : "moves stay" }} behind —
        {{ droppedReason }}
      </p>
      <ol class="analysis-commit__list analysis-commit__list--dropped">
        <li v-for="(move, i) in view.dropped" :key="`d${i}`" class="analysis-commit__row">
          <span class="analysis-commit__badge analysis-commit__badge--dropped">not committed</span>
          <span class="analysis-commit__move">{{ move }}</span>
        </li>
      </ol>
    </template>
  </b-modal>
</template>

<script lang="ts">
import Vue from "vue";
import type { AnalysisCommitCut, AnalysisCommitPlan } from "../logic/analysis";
import { isCheapAnalysisBuild, MAX_COMMITTABLE_MOVES } from "../logic/analysis";

import MoveCost from "./MoveCost.vue";

const EMPTY_PLAN: AnalysisCommitPlan = { live: null, queued: [], dropped: [], cut: null, limit: "line" };

/** One sentence per way a line can stop short of its end. Kept here rather than in `analysis.ts`
 * because it is wording, not logic - the cut itself is decided by `analysisCommitPrefix`. */
const CUT_TEXT: Record<AnalysisCommitCut, string> = {
  faction:
    "this plan was played as a faction you picked while planning, so none of it describes a move the real game would accept.",
  illegal: "the next move cannot be played on the current board.",
  overdrawn: "the next move would spend more than you actually have.",
  "assumed-power":
    "the next move only worked because the simulation added power — charge it for real first and it can be committed later.",
  foreign: "the next move belongs to another seat, and committing it would take somebody else's turn.",
  cap: `you can submit up to ${MAX_COMMITTABLE_MOVES} moves at once.`,
};

export default Vue.extend({
  name: "AnalysisCommitConfirm",
  components: { MoveCost },
  methods: { isCheapAnalysisBuild },
  props: {
    /** Nullable rather than defaulted: Vue substitutes a prop default only for `undefined`, and
     * Commands.vue holds `null` whenever Game.vue has no plan to give (outside sandbox mode, or a
     * line with nothing committable in it) - which would otherwise render this as `null.live`. */
    plan: { type: Object as () => AnalysisCommitPlan | null, default: null },
  },
  computed: {
    view(): AnalysisCommitPlan {
      return (this.plan as AnalysisCommitPlan | null) ?? EMPTY_PLAN;
    },
    total(): number {
      const view = this.view as AnalysisCommitPlan;
      return (view.live ? 1 : 0) + view.queued.length;
    },
    okTitle(): string {
      return `${this.view.live ? "Play" : "Queue"} ${this.total} move${this.total === 1 ? "" : "s"}`;
    },
    droppedReason(): string {
      const view = this.view as AnalysisCommitPlan;
      if (view.limit === "no-premoves") {
        return "offline games have no premove queue, so only the move you play right now can be committed.";
      }
      if (view.limit === "queue") {
        return "you can queue up to three moves at once.";
      }
      return view.cut ? CUT_TEXT[view.cut] : "they are past what can be committed in one go.";
    },
  },
});
</script>

<style lang="scss" scoped>
.analysis-commit__lede {
  margin-bottom: 0.75rem;
}

.analysis-commit__list {
  list-style: none;
  margin: 0 0 0.75rem;
  padding: 0;
}

.analysis-commit__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0.35rem;
  border: 1px solid var(--ui-border-strong);
  background: var(--ui-surface-muted);
}

.analysis-commit__row + .analysis-commit__row {
  margin-top: 0.25rem;
}

.analysis-commit__badge {
  flex: 0 0 auto;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.analysis-commit__badge--live {
  color: var(--ui-success);
}

.analysis-commit__badge--queued {
  color: var(--ui-text-muted);
}

.analysis-commit__badge--dropped {
  color: var(--ui-text-subtle);
}

// The move string itself, in the same raw form the premove bar lists a queued row in - so the entry
// confirmed here and the row that shows up in the queue afterwards read identically.
.analysis-commit__move {
  font-family: monospace;
  font-size: 0.85rem;
  word-break: break-word;
}

.analysis-commit__list--dropped .analysis-commit__row {
  opacity: 0.75;
}

.analysis-commit__dropped-head {
  margin-bottom: 0.4rem;
  font-size: 0.9rem;
}

.analysis-commit__foot {
  font-size: 0.85rem;
  color: var(--ui-text-muted);
}
</style>
