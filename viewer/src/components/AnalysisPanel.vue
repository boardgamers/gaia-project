<template>
  <!-- Inline recovery controls beside the plan list, only for a rollback or divergent history. -->
  <div v-if="active && pendingRestore" class="analysis-restore">
    <span class="flex-grow-1"> {{ pendingRestoreLabel }} from a different board position. </span>
    <b-button size="sm" variant="outline-secondary" class="mr-1" @click="$emit('restore')">Restore anyway</b-button>
    <b-button size="sm" variant="outline-secondary" @click="$emit('discard-restore')">Discard</b-button>
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
.analysis-restore {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
  line-height: 1.3;
  color: var(--ui-text);
}
</style>
