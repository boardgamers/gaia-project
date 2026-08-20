<template>
  <!-- The one confirmation step sandbox mode has (ANALYSIS_MODE_PLAN.md §6/decision #13). Composing a
       turn inside the sandbox deliberately does NOT confirm (§12.4 - Undo covers a misclick and
       nothing there is real), but Commit is the single control that takes moves OUT of the sandbox
       and plays them for real, where Undo does not reach: move 1 is dispatched live and the rest are
       queued to fire by themselves, possibly with the app closed. It is also the moment the line is
       cleared, so anything not committed is gone - which is exactly why the moves being left behind
       are listed here too, rather than only the ones going out.
       Rendered exactly ONCE per page, by Commands.vue, for the same reason AnalysisModeInfo.vue is:
       AnalysisHeaderControls.vue is mounted twice (desktop title + mobile sticky bar) and two copies
       of one b-modal id make the button open whichever Bootstrap-Vue registered first. -->
  <b-modal
    id="analysis-commit-confirm"
    size="lg"
    title="Commit these moves for real?"
    ok-variant="success"
    :ok-title="okTitle"
    cancel-title="Keep playing in the sandbox"
    :ok-disabled="total === 0"
    dialog-class="gaia-viewer-modal"
    @ok="$emit('confirm')"
  >
    <p class="analysis-commit__lede">
      {{ lede }}
    </p>

    <ol class="analysis-commit__list">
      <li v-if="view.live" class="analysis-commit__row analysis-commit__row--live">
        <span class="analysis-commit__badge analysis-commit__badge--live">plays now</span>
        <span class="analysis-commit__move">{{ view.live }}</span>
      </li>
      <li v-for="(move, i) in view.queued" :key="`q${i}`" class="analysis-commit__row analysis-commit__row--queued">
        <span class="analysis-commit__badge analysis-commit__badge--queued"
          >premove {{ i + 1 }}<template v-if="view.live"> · after your live move</template></span
        >
        <span class="analysis-commit__move">{{ move }}</span>
      </li>
    </ol>

    <!-- Never silently truncate. A player who queued six moves in the sandbox and got four needs to
         know which two did not make it and why, before the line is cleared out from under them. -->
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

    <p class="analysis-commit__foot mb-0">
      {{ footer }}
    </p>
  </b-modal>
</template>

<script lang="ts">
import Vue from "vue";
import { AnalysisCommitCut, AnalysisCommitPlan, MAX_COMMITTABLE_MOVES } from "../logic/analysis";

const EMPTY_PLAN: AnalysisCommitPlan = { live: null, queued: [], dropped: [], cut: null, limit: "line" };

/** One sentence per way a line can stop short of its end. Kept here rather than in `analysis.ts`
 * because it is wording, not logic - the cut itself is decided by `analysisCommitPrefix`. */
const CUT_TEXT: Record<AnalysisCommitCut, string> = {
  faction:
    "this line was played as a faction you picked in the sandbox, so none of it describes a move the real game would accept.",
  "cheap-build":
    "it includes a Trading Station the sandbox priced as if an opponent were next to it, so the rest of the line was played on credits you do not really have.",
  illegal: "the next move is not legal on the real board without the power you assumed in here.",
  overdrawn: "the next move would spend more than you actually have.",
  "assumed-power":
    "the next move only worked because the sandbox topped up your power — charge it for real first and it can be committed later.",
  foreign: "the next move belongs to another seat, and committing it would take somebody else's turn.",
  cap: `only ${MAX_COMMITTABLE_MOVES} moves can go out at once — one live plus a full premove queue.`,
};

export default Vue.extend({
  name: "AnalysisCommitConfirm",
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
      return `Commit ${this.total} move${this.total === 1 ? "" : "s"}`;
    },
    lede(): string {
      const view = this.view as AnalysisCommitPlan;
      const queued = view.queued.length;
      if (view.live && queued === 0) {
        return "This move is played in the real game as soon as you confirm.";
      }
      if (view.live) {
        return `The first move is played in the real game as soon as you confirm. The other ${queued} ${
          queued === 1 ? "is queued as a premove" : "are queued as premoves"
        } and play by themselves, in this order, when your turn comes round again — even with the app closed.`;
      }
      return `It is not your turn, so nothing is played immediately: all ${queued} ${
        queued === 1 ? "move is queued as a premove" : "moves are queued as premoves"
      } and play by themselves, in this order, when your turn comes — even with the app closed.`;
    },
    droppedReason(): string {
      const view = this.view as AnalysisCommitPlan;
      if (view.limit === "no-premoves") {
        return "offline games have no premove queue, so only the move you play right now can be committed.";
      }
      if (view.limit === "queue") {
        return "your premove queue is full — cancel a queued move and commit again to send more.";
      }
      return view.cut ? CUT_TEXT[view.cut] : "they are past what can be committed in one go.";
    },
    footer(): string {
      const view = this.view as AnalysisCommitPlan;
      const rest = view.dropped.length > 0 ? " The rest of the line is discarded with it." : "";
      return `Committing leaves the sandbox and clears this line.${rest} A queued premove can still be edited or cancelled from the premove bar until it plays.`;
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
  align-items: baseline;
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
