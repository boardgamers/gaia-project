<template>
  <!--
    What is left of analysis mode's own surface once §12 moved every control into the striped header
    and every number onto the player board: the two things that genuinely cannot live in either.

    Staleness notices and the "a saved line exists" prompt (§3.5), and nothing else. Both have to be
    readable while sandbox mode is NOT active, which is exactly why they cannot live in Commands.vue:
    it is not rendered then.

    Round 0's faction picker used to be here too. It moved into Commands.vue's action area on owner
    instruction - every press the player makes inside the sandbox belongs on that one surface, and a
    second container above the map is nowhere near it on a phone.

    Deliberately NOT a container announcing sandbox mode: the hazard-striped header and map already
    do that, and the yellow box that used to sit here said it a third time while carrying resource
    rows the player board now shows live.
  -->
  <div v-if="notice || pendingRestore" class="analysis-strip">
    <div v-if="notice" class="analysis-strip__banner">
      <span class="flex-grow-1">{{ notice }}</span>
      <button type="button" class="analysis-strip__banner-x" @click="$emit('dismiss-notice')">✕</button>
    </div>

    <!-- The "own seat moved since this was saved" row of §3.5's table - prompts instead of silently
         replaying, mirroring PremoveBar.vue's inline mode-switch confirm rather than a raw
         window.confirm. -->
    <div v-if="active && pendingRestore" class="analysis-strip__banner analysis-strip__banner--confirm">
      <span class="flex-grow-1">
        A saved sandbox line ({{ pendingRestore.entries.length }} move{{
          pendingRestore.entries.length === 1 ? "" : "s"
        }}) exists from before your last move.
      </span>
      <b-button size="sm" variant="outline-secondary" class="mr-1" @click="$emit('restore')">Restore anyway</b-button>
      <b-button size="sm" variant="outline-secondary" @click="$emit('discard-restore')">Discard</b-button>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { AnalysisLine } from "../logic/analysis";

export default Vue.extend({
  name: "AnalysisPanel",
  props: {
    active: { type: Boolean, default: false },
    notice: { type: String, default: null },
    pendingRestore: { type: Object as () => AnalysisLine | null, default: null },
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
