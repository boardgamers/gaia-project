<template>
  <div v-if="active || offered" class="analysis-panel" :class="{ 'analysis-panel--active': active }">
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
    <b-button v-else size="sm" variant="outline-secondary" @click="$emit('enter')">Enter analysis mode</b-button>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { AnalysisCounter, AnalysisResourceDelta } from "../logic/analysis";

export default Vue.extend({
  name: "AnalysisPanel",
  props: {
    active: { type: Boolean, default: false },
    offered: { type: Boolean, default: false },
    moveCount: { type: Number, default: 0 },
    counter: { type: Object as () => AnalysisCounter | null, default: null },
    passCapped: { type: Boolean, default: false },
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
  },
  methods: {
    formatSigned(value: number): string {
      return value > 0 ? `+${value}` : `${value}`;
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
