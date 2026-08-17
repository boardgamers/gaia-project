<template>
  <!--
    What is left of analysis mode's own surface once §12 moved every control into the striped header
    and every number onto the player board: the two things that genuinely cannot live in either.

    - Staleness notices and the "a saved line exists" prompt (§3.5), which have to be readable while
      analysis mode is NOT active - the header does not exist then.
    - The round-0 faction picker (§11), which is a select plus a button and would not fit a one-line
      bar on a phone.

    Deliberately NOT a container announcing analysis mode: the hazard-striped header and map already
    do that, and the yellow box that used to sit here said it a third time while carrying resource
    rows the player board now shows live.
  -->
  <div v-if="notice || pendingRestore || factionChoices.length > 0" class="analysis-strip">
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

    <!-- The round-0 faction seed (§11): pick a faction and the sandbox jumps straight past the pick
         or auction to everyone's starting mines. Only rendered while the clone is still in faction
         selection - from the first mine onwards the table is settled. -->
    <div v-if="active && factionChoices.length > 0" class="analysis-strip__seed">
      <label for="analysis-seed-faction" class="analysis-strip__seed-label">Play as</label>
      <select id="analysis-seed-faction" v-model="seedFaction" class="analysis-strip__seed-select">
        <option v-for="choice in factionChoices" :key="choice.faction" :value="choice.faction">
          {{ choice.name }}
        </option>
      </select>
      <b-button size="sm" variant="outline-secondary" :disabled="!seedFaction" @click="submitSeed">
        {{ seatedLineup ? "Try this one instead" : "Try this faction" }}
      </b-button>
      <span v-if="seatedLineup" class="analysis-strip__lineup">
        <span v-for="(entry, index) in seatedLineup" :key="index" class="analysis-strip__seat">
          <strong v-if="entry.mine">{{ entry.name }} (you)</strong>
          <template v-else>{{ entry.name }}</template>
        </span>
      </span>
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
    /** §11's picker options - empty (so the picker is not rendered) whenever the clone is past
     * faction selection, which is every case except a round-0 entry. */
    factionChoices: { type: Array as () => { faction: string; name: string }[], default: () => [] },
    /** The table a seed produced, once one is in the line - null otherwise. */
    seatedLineup: { type: Array as () => { name: string; mine: boolean }[] | null, default: null },
  },
  data() {
    return {
      seedFaction: null as string | null,
    };
  },
  watch: {
    // The pool shrinks and grows as the line is edited (Undo/Reset put a seeded faction back on
    // offer), so a selection that is no longer in it would leave the button armed with a faction the
    // picker is not showing. Default to the first option instead, matching what the closed select
    // displays.
    factionChoices: {
      immediate: true,
      handler(choices: { faction: string }[]) {
        if (!choices.some((choice) => choice.faction === this.seedFaction)) {
          this.seedFaction = choices.length > 0 ? choices[0].faction : null;
        }
      },
    },
  },
  methods: {
    submitSeed() {
      if (!this.seedFaction) {
        return;
      }
      this.$emit("seed-faction", this.seedFaction);
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

.analysis-strip__seed {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.analysis-strip__seed-label {
  margin: 0;
}

.analysis-strip__seed-select {
  padding: 0.1rem 0.3rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.3rem;
  background: var(--ui-surface);
  color: var(--ui-text);
  max-width: 12rem;
}

.analysis-strip__lineup {
  display: flex;
  gap: 0.35rem;
  opacity: 0.85;
}

.analysis-strip__seat:not(:last-of-type)::after {
  content: "·";
  margin-left: 0.35rem;
  opacity: 0.6;
}
</style>
