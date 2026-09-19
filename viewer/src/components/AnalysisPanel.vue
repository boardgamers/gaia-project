<template>
  <!-- Planning notices and recovery after a rollback. -->
  <div v-if="notice || pendingRestore" class="analysis-strip">
    <div v-if="notice" class="analysis-strip__banner">
      <span class="flex-grow-1">{{ notice }}</span>
      <button type="button" class="analysis-strip__banner-x" @click="$emit('dismiss-notice')">✕</button>
    </div>

    <div v-if="active && pendingRestore" class="analysis-strip__banner analysis-strip__banner--confirm">
      <span class="flex-grow-1"> {{ pendingRestoreLabel }} from a different board position. </span>
      <b-button size="sm" variant="outline-secondary" class="mr-1" @click="$emit('restore')">Restore anyway</b-button>
      <b-button size="sm" variant="outline-secondary" @click="$emit('discard-restore')">Discard</b-button>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import type { AnalysisLineSet } from "../logic/analysis";
import { analysisLineSetSize } from "../logic/analysis";

export default Vue.extend({
  name: "AnalysisPanel",
  props: {
    active: { type: Boolean, default: false },
    notice: { type: String, default: null },
    pendingRestore: { type: Object as () => AnalysisLineSet | null, default: null },
  },
  computed: {
    /** Counts every move across every line (§13), not just the one that was open: Restore/Discard
     * answers for the whole stored set, so quoting one line's length would understate what Discard
     * is about to throw away. */
    pendingRestoreLabel(): string {
      const set = this.pendingRestore as AnalysisLineSet | null;
      if (!set) {
        return "";
      }
      const moves = analysisLineSetSize(set);
      const moveText = `${moves} move${moves === 1 ? "" : "s"}`;
      return set.lines.length > 1
        ? `${set.lines.length} saved plans (${moveText} in total) exist`
        : `A saved plan (${moveText}) exists`;
    },
  },
});
</script>

<style lang="scss" scoped>
.analysis-strip {
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
}

.analysis-strip__banner {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  line-height: 1.3;
  border: 1px solid var(--ui-border);
  border-radius: 0.45rem;
  padding: 0.4rem 0.5rem;
  background: var(--ui-surface);
  color: var(--ui-text);
  margin-bottom: 0.4rem;
}

.analysis-strip__banner--confirm {
  flex-wrap: wrap;
}

.analysis-strip__banner-x {
  border: 0;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 0.75rem;
  line-height: 1;
  padding: 0.15rem 0.25rem;
  cursor: pointer;
  flex: 0 0 auto;
}
</style>
