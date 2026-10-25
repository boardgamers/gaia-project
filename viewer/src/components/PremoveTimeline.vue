<template>
  <details class="premove-timeline" :open="expanded">
    <summary>
      <strong>{{ run.label || "Premoves" }}</strong>
      <span class="premove-timeline__count">{{ playedCount }}/{{ run.steps.length }} played</span>
      <span :class="{ 'premove-timeline__warning': run.status === 'stopped' }">{{ status }}</span>
    </summary>
    <div class="premove-timeline__actions">
      <button
        v-if="remaining.length && canPreview"
        class="btn btn-sm btn-outline-primary"
        @click="$emit('review', run)"
      >
        {{ run.status === "queued" ? "View on board" : "Review remaining" }}
      </button>
      <button
        v-if="run.status === 'queued'"
        class="btn btn-sm btn-outline-danger"
        :disabled="pending"
        @click="$emit('cancel')"
      >
        Cancel
      </button>
    </div>
    <ol class="premove-timeline__steps">
      <li v-for="(step, index) in run.steps" :key="index" :class="`premove-timeline__step--${step.status}`">
        <div v-if="index === stoppedIndex && run.reason" class="premove-timeline__reason" role="status">
          {{ run.reason }}
        </div>
        <div class="premove-timeline__row">
          <span class="premove-timeline__round">{{ step.timing.round ? `R${step.timing.round}` : "Setup" }}</span>
          <span class="premove-timeline__move">{{ step.move }}</span>
          <MoveCost v-if="step.status === 'queued'" :cost="costs[queuedIndex(index)]" />
          <span
            class="premove-timeline__state"
            :title="step.status === 'skipped' ? 'Income was already resolved' : undefined"
            >{{ labels[step.status] }}</span
          >
        </div>
      </li>
    </ol>
  </details>
</template>

<script lang="ts">
import type { PremoveRun } from "@gaia-project/engine/src/premove-types";
import Vue from "vue";
import MoveCost from "./MoveCost.vue";

export default Vue.extend({
  components: { MoveCost },
  props: {
    run: { type: Object as () => PremoveRun, required: true },
    costs: { type: Array, default: () => [] },
    expanded: Boolean,
    pending: Boolean,
    canPreview: Boolean,
  },
  computed: {
    labels() {
      return {
        played: "✓ Played",
        undone: "Taken back",
        skipped: "✓ Income resolved",
        blocked: "Stopped here",
        unplayed: "Not played",
        queued: "Queued",
      };
    },
    remaining() {
      return this.run.steps.filter((step) => ["queued", "blocked", "unplayed", "undone"].includes(step.status));
    },
    playedCount(): number {
      return this.run.steps.filter((step) => step.status === "played").length;
    },
    stoppedIndex(): number {
      return this.run.steps.findIndex((step) => ["blocked", "unplayed", "undone"].includes(step.status));
    },
    status(): string {
      if (this.run.status === "queued") return `${this.remaining.length} queued`;
      if (this.run.status === "stopped") return `Stopped at ${this.stoppedIndex + 1}`;
      return { completed: "Completed", cancelled: "Cancelled", replaced: "Replaced" }[this.run.status];
    },
  },
  methods: {
    queuedIndex(index: number): number {
      return this.run.steps.slice(0, index).filter((step) => step.status === "queued").length;
    },
  },
});
</script>

<style scoped>
.premove-timeline summary {
  cursor: pointer;
  padding: 0.3rem 0;
}
.premove-timeline summary > * {
  margin-right: 0.65rem;
}
.premove-timeline__count,
.premove-timeline__round {
  color: var(--ui-text-muted);
  font-size: 0.8rem;
}
.premove-timeline__warning,
.premove-timeline__reason {
  color: var(--ui-warning-text);
}
.premove-timeline__actions {
  display: flex;
  gap: 0.5rem;
  margin: 0.5rem 0;
}
.premove-timeline__steps {
  margin: 0;
  padding-left: 1.5rem;
  font-size: 0.85rem;
}
.premove-timeline__steps li {
  padding: 0.45rem 0.4rem;
  border-top: 1px solid var(--ui-border);
}
.premove-timeline__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.premove-timeline__move {
  flex: 1 1 8rem;
  overflow-wrap: anywhere;
  min-width: 0;
}
.premove-timeline__round {
  white-space: nowrap;
}
.premove-timeline__state {
  font-size: 0.75rem;
  white-space: nowrap;
  margin-left: auto;
}
.premove-timeline__step--played,
.premove-timeline__step--skipped,
.premove-timeline__step--unplayed {
  color: var(--ui-text-muted);
}
.premove-timeline__step--blocked {
  border-left: 3px solid var(--ui-warning-border);
}
.premove-timeline__reason {
  padding-bottom: 0.4rem;
  overflow-wrap: anywhere;
}
</style>
