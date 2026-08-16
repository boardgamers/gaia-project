<template>
  <div
    v-if="active || offered || notice || pendingRestore"
    class="analysis-panel"
    :class="{ 'analysis-panel--active': active }"
  >
    <!-- Staleness on re-entry (§3.5) - a one-line explanation of what resolveAnalysisStaleness did
         (or why a mid-analysis externalData arrival just closed the takeover), shown regardless of
         active/offered so it survives past the exit it might be describing. -->
    <div v-if="notice" class="analysis-panel__banner">
      <span class="flex-grow-1">{{ notice }}</span>
      <button type="button" class="analysis-panel__banner-x" @click="$emit('dismiss-notice')">✕</button>
    </div>

    <template v-if="active">
      <div class="analysis-panel__header">
        <strong class="analysis-panel__title">Analysis</strong>
        <span class="analysis-panel__move-count">{{ moveCount }} move{{ moveCount === 1 ? "" : "s" }}</span>
        <div class="analysis-panel__actions">
          <b-button size="sm" variant="outline-secondary" :disabled="moveCount === 0" @click="$emit('undo')">
            Undo last move
          </b-button>
          <b-button size="sm" variant="outline-secondary" :disabled="moveCount === 0" @click="$emit('reset')">
            Reset
          </b-button>
          <b-button size="sm" variant="secondary" @click="$emit('exit')">Exit analysis mode</b-button>
        </div>
      </div>

      <!-- The "own seat moved since this was saved" row of §3.5's table - prompts instead of
           silently replaying, mirroring PremoveBar.vue's inline mode-switch confirm rather than a
           raw window.confirm. -->
      <div v-if="pendingRestore" class="analysis-panel__banner analysis-panel__banner--confirm">
        <span class="flex-grow-1">
          A saved analysis line ({{ pendingRestore.entries.length }} move{{
            pendingRestore.entries.length === 1 ? "" : "s"
          }}) exists from before your last move.
        </span>
        <b-button size="sm" variant="outline-secondary" class="mr-1" @click="$emit('restore')">
          Restore anyway
        </b-button>
        <b-button size="sm" variant="outline-secondary" @click="$emit('discard-restore')">Discard</b-button>
      </div>

      <!-- Full breakdown (§5.3, second surface) - the headline in Commands.vue's striped header is
           the compact, always-visible version of the same numbers; this is where every resource, the
           power bowl, and the feasibility verdict all get their own line. -->
      <div v-if="counter" class="analysis-panel__breakdown">
        <div v-for="row in resourceRows" :key="row.label" class="analysis-panel__resource">
          <span class="analysis-panel__resource-label">{{ row.label }}</span>
          <span
            class="analysis-panel__resource-value"
            :class="{ 'analysis-panel__resource-value--negative': row.value.displayed < 0 }"
          >
            {{ formatSigned(row.value.displayed) }}
            <small class="analysis-panel__resource-net">net {{ formatSigned(row.value.net) }}</small>
          </span>
        </div>
        <div class="analysis-panel__resource">
          <span class="analysis-panel__resource-label">Power</span>
          <span class="analysis-panel__resource-value">
            {{ counter.power.before.area1 }}/{{ counter.power.before.area2 }}/{{ counter.power.before.area3 }} →
            {{ counter.power.after.area1 }}/{{ counter.power.after.area2 }}/{{ counter.power.after.area3 }}
          </span>
        </div>

        <!-- The leech adjustment stepper (§4.4, decision #12) - opponents never build in analysis
             mode, so a line never gains the leech power a real opponent's building would have
             realistically offered. This is how the player adds that back in themselves, explicitly. -->
        <div class="analysis-panel__adjust">
          <label for="analysis-adjust-charge" class="analysis-panel__adjust-label">Assume I leech</label>
          <input
            id="analysis-adjust-charge"
            type="number"
            min="1"
            max="12"
            v-model.number="adjustCharge"
            class="analysis-panel__adjust-input"
          />
          <span>power</span>
          <b-button size="sm" variant="outline-secondary" :disabled="!adjustValid" @click="submitAdjust">
            Add
          </b-button>
        </div>

        <div class="analysis-panel__verdict" :class="{ 'analysis-panel__verdict--infeasible': !counter.feasible }">
          <template v-if="counter.feasible">Feasible so far.</template>
          <template v-else>
            Infeasible from move {{ counter.infeasibleFromMove }} — everything after that is hypothetical.
          </template>
        </div>
      </div>
      <div v-else class="analysis-panel__breakdown analysis-panel__breakdown--empty">
        No sandbox wallet yet — one is granted the moment this line reaches round 1's move phase.
      </div>

      <div v-if="passCapped" class="analysis-panel__note">
        Two-round cap reached — Pass is hidden here. Exit or Reset to start a new line.
      </div>
      <!-- Decision #11 (§4.5) - shared single-use pools are deliberately not simulated. Said here
           rather than assumed, so the numbers above are never over-trusted. -->
      <div class="analysis-panel__help">
        Board actions, tech tiles, boosters and federation tiles are shown as available even though only one player
        could actually take them first — this line assumes nobody beats you to any of them.
      </div>
    </template>
    <b-button v-else-if="offered" size="sm" variant="outline-secondary" @click="$emit('enter')">
      Enter analysis mode
    </b-button>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { AnalysisCounter, AnalysisLine, AnalysisResourceDelta } from "../logic/analysis";

export default Vue.extend({
  name: "AnalysisPanel",
  props: {
    active: { type: Boolean, default: false },
    offered: { type: Boolean, default: false },
    moveCount: { type: Number, default: 0 },
    counter: { type: Object as () => AnalysisCounter | null, default: null },
    passCapped: { type: Boolean, default: false },
    notice: { type: String, default: null },
    pendingRestore: { type: Object as () => AnalysisLine | null, default: null },
  },
  data() {
    return {
      adjustCharge: 1,
    };
  },
  computed: {
    resourceRows(): { label: string; value: AnalysisResourceDelta }[] {
      const counter = this.counter as AnalysisCounter | null;
      if (!counter) {
        return [];
      }
      return [
        { label: "Credits", value: counter.credits },
        { label: "Ore", value: counter.ores },
        { label: "Knowledge", value: counter.knowledge },
        { label: "QIC", value: counter.qics },
        { label: "VP", value: counter.victoryPoints },
      ];
    },
    adjustValid(): boolean {
      const charge = this.adjustCharge as number;
      return Number.isInteger(charge) && charge > 0;
    },
  },
  methods: {
    formatSigned(value: number): string {
      return value > 0 ? `+${value}` : `${value}`;
    },
    submitAdjust() {
      if (!this.adjustValid) {
        return;
      }
      this.$emit("adjust", this.adjustCharge);
    },
  },
});
</script>

<style lang="scss" scoped>
.analysis-panel {
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--ui-border);
  background: var(--ui-surface-muted);
}

// Only while actually taken over does the panel earn the warning treatment - the plain "Enter
// analysis mode" button beforehand doesn't need to announce anything yet.
.analysis-panel--active {
  border-color: var(--ui-warning-border);
  background: var(--ui-warning-bg);
  color: var(--ui-warning-text);
}

.analysis-panel__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.analysis-panel__title {
  font-size: 0.95rem;
}

.analysis-panel__move-count {
  font-size: 0.8rem;
  opacity: 0.8;
}

.analysis-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-left: auto;
}

// §3.5 staleness banners - kept neutral (ui-surface/ui-border) rather than reusing the panel's own
// warning tint, since .analysis-panel--active already sits on that background and a same-toned
// banner would lose contrast against it.
.analysis-panel__banner {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  line-height: 1.3;
  border: 1px solid var(--ui-border);
  border-radius: 0.45rem;
  padding: 0.4rem 0.5rem;
  background: var(--ui-surface);
  color: var(--ui-text);
  margin-bottom: 0.5rem;
}

.analysis-panel__banner--confirm {
  flex-wrap: wrap;
}

.analysis-panel__banner-x {
  border: 0;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 0.75rem;
  line-height: 1;
  padding: 0.15rem 0.25rem;
  cursor: pointer;
  flex: 0 0 auto;
}

.analysis-panel__breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  margin-top: 0.5rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--ui-warning-border);
}

.analysis-panel__breakdown--empty {
  font-size: 0.85rem;
  opacity: 0.8;
}

.analysis-panel__resource {
  display: flex;
  flex-direction: column;
  min-width: 4.5rem;
}

.analysis-panel__resource-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  opacity: 0.75;
}

.analysis-panel__resource-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.analysis-panel__resource-value--negative {
  color: var(--oxide, #d92626);
}

.analysis-panel__resource-net {
  font-weight: 400;
  opacity: 0.7;
  margin-left: 0.15rem;
}

// The leech adjustment stepper (§4.4) - deliberately plain (no warning tint), since it is not a
// notice or a warning, just a small input sitting alongside the resource rows above it.
.analysis-panel__adjust {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-basis: 100%;
  font-size: 0.8rem;
}

.analysis-panel__adjust-label {
  margin: 0;
}

.analysis-panel__adjust-input {
  width: 3.5rem;
  padding: 0.1rem 0.3rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.3rem;
  background: var(--ui-surface);
  color: var(--ui-text);
}

.analysis-panel__verdict {
  flex-basis: 100%;
  font-size: 0.85rem;
  font-weight: 600;
}

.analysis-panel__verdict--infeasible {
  color: var(--oxide, #d92626);
}

.analysis-panel__note,
.analysis-panel__help {
  margin-top: 0.4rem;
  font-size: 0.78rem;
  opacity: 0.85;
}
</style>
