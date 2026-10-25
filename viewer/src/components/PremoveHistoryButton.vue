<template>
  <button
    v-if="visible"
    type="button"
    class="premove-history-button"
    :aria-label="label"
    :title="label"
    @click.stop="$bvModal.show('premove-history')"
  >
    <svg
      viewBox="0 0 20 20"
      style="fill: none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8a7 7 0 1 1 .5 6M3 3v5h5M10 6v4l3 2" />
    </svg>
    <span v-if="stopped" class="premove-history-button__dot" aria-hidden="true"></span>
    <span v-else-if="plan.moves.length" class="premove-history-button__count" aria-hidden="true">{{
      plan.moves.length
    }}</span>
  </button>
</template>
<script lang="ts">
import type { PremovePlan } from "@gaia-project/engine/src/premove-types";
import Vue from "vue";
export default Vue.extend({
  props: { plan: { type: Object as () => PremovePlan, default: undefined } },
  computed: {
    visible(): boolean {
      return !!(this.plan?.moves.length || this.plan?.runs?.length || this.plan?.notice);
    },
    stopped(): boolean {
      return (
        this.plan?.runs?.[0]?.status === "stopped" ||
        (!this.plan?.runs?.length && this.plan?.notice?.kind === "stopped")
      );
    },
    label(): string {
      const run = this.plan?.runs?.[0];
      const index = run?.steps.findIndex((step) => ["blocked", "unplayed", "undone"].includes(step.status));
      if (this.stopped)
        return index >= 0 ? `Premoves stopped at move ${index + 1} — view history` : "Premoves stopped — view history";
      return this.plan?.moves.length ? `Premoves: ${this.plan.moves.length} queued — view history` : "Premove history";
    },
  },
});
</script>
<style scoped>
.premove-history-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--ui-text-muted);
  padding: 0.35rem;
}
.premove-history-button svg {
  width: 1.15rem;
  height: 1.15rem;
}
.premove-history-button:hover,
.premove-history-button:focus-visible {
  background: var(--ui-surface-muted);
  color: var(--ui-info-text);
}
.premove-history-button__dot {
  position: absolute;
  top: 0.2rem;
  right: 0.15rem;
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 50%;
  background: var(--ui-warning-text);
}
.premove-history-button__count {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 0.8rem;
  border-radius: 0.5rem;
  font-size: 0.6rem;
  line-height: 0.85rem;
  text-align: center;
  background: var(--ui-surface);
  color: var(--ui-text-muted);
}
</style>
