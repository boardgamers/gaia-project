<template>
  <section class="premove-queue" :aria-label="queueEnabled ? 'Your premoves' : 'Planning'">
    <template v-if="runs.length">
      <PremoveTimeline
        :key="runs[0].id"
        :run="runs[0]"
        :costs="costs"
        :expanded="['queued', 'stopped'].includes(runs[0].status)"
        :pending="pending"
        :can-preview="canPreview"
        @review="$emit('view', $event)"
        @cancel="$emit('cancel', 0)"
      />
      <details v-if="runs.length > 1" class="premove-queue__previous">
        <summary>Previous queues ({{ runs.length - 1 }})</summary>
        <PremoveTimeline
          v-for="run in runs.slice(1)"
          :key="run.id"
          :run="run"
          :can-preview="canPreview"
          @review="$emit('view', $event)"
        />
      </details>
    </template>
    <div v-else class="premove-queue__heading">
      <div>
        <strong>{{
          moves.length ? `Your premoves · ${moves.length}` : active ? "Planning · preview only" : "Plan your next turn"
        }}</strong>
      </div>
      <div class="premove-queue__actions">
        <button v-if="active" class="btn btn-sm btn-outline-secondary" @click="$emit('exit')">Exit simulation</button>
        <button
          v-if="moves.length"
          class="btn btn-sm btn-outline-primary"
          :disabled="!canPreview"
          :title="canPreview ? undefined : 'Return to the live game to preview these moves'"
          @click="$emit('view')"
        >
          View on board
        </button>
        <button
          v-if="moves.length"
          class="btn btn-sm btn-outline-danger"
          :disabled="pending"
          @click="$emit('cancel', 0)"
        >
          Cancel
        </button>
      </div>
    </div>
    <ol v-if="moves.length && !runs.length" class="premove-queue__moves">
      <li v-for="(move, index) in moves" :key="index">
        <span v-if="plan.timings" class="premove-queue__price premove-queue__round">{{
          plan.timings[index].round === 0 ? "Setup" : `Round ${plan.timings[index].round}`
        }}</span>
        <span>{{ move }}</span>
        <span
          v-if="isCheapAnalysisBuild(move)"
          class="premove-queue__price"
          title="Stops if the 3c price is unavailable"
          >3c only</span
        >
        <MoveCost :cost="costs[index]" />
      </li>
    </ol>
    <div v-if="pending" class="small mt-2" role="status">Saving your plan…</div>
    <PremoveNotice
      v-else-if="plan && plan.notice && !runs.length"
      :plan="plan"
      :storage-key="noticeStorageKey"
      :move-history="moveHistory"
      class="mt-2"
    />
  </section>
</template>

<script lang="ts">
import type { PremovePlan } from "@gaia-project/engine/src/premove-types";
import Vue from "vue";
import { isCheapAnalysisBuild } from "../logic/analysis";
import MoveCost from "./MoveCost.vue";
import PremoveNotice from "./PremoveNotice.vue";
import PremoveTimeline from "./PremoveTimeline.vue";

export default Vue.extend({
  components: { PremoveNotice, PremoveTimeline, MoveCost },
  methods: { isCheapAnalysisBuild },
  props: {
    plan: { type: Object as () => PremovePlan, default: undefined },
    moveHistory: { type: String, default: "" },
    noticeStorageKey: { type: String, required: true },
    costs: { type: Array, default: () => [] },
    pending: Boolean,
    queueEnabled: { type: Boolean, default: true },
    active: Boolean,
    previewRound: Number,
    canPreview: { type: Boolean, default: true },
  },
  computed: {
    runs() {
      return this.plan?.runs ?? [];
    },
    moves(): string[] {
      return this.plan?.moves ?? [];
    },
  },
});
</script>

<style scoped>
.premove-queue {
  background: var(--ui-surface-muted);
  border: 1px solid var(--ui-border-strong);
  border-left: 3px solid var(--ui-info, #4294c4);
  border-radius: 0.4rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}
.premove-queue__previous {
  margin-top: 0.5rem;
  font-size: 0.8rem;
}
.premove-queue__previous > summary {
  cursor: pointer;
  color: var(--ui-text-muted);
}
.premove-queue__heading,
.premove-queue__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.premove-queue__heading {
  justify-content: space-between;
}
.premove-queue__moves {
  padding-left: 1.5rem;
  margin-bottom: 0;
}
.premove-queue__moves li {
  padding-top: 0.35rem;
}
.premove-queue__moves span {
  overflow-wrap: anywhere;
}
.premove-queue__moves button {
  margin-left: 0.5rem;
}
.premove-queue__price {
  margin-left: 0.5rem;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--ui-border-strong);
  border-radius: 0.25rem;
  font-size: 0.8rem;
}
.premove-queue__round {
  margin-left: 0;
  margin-right: 0.5rem;
  white-space: nowrap;
}
</style>
