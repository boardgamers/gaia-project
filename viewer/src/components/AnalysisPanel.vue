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
          <!-- The commit path (§6, decision #13) - move 1 committed live, the rest (hosted only)
               queued as Sequential premoves. Only offered once there is something in the line at
               all; disabled rather than hidden once committableMoves is 0, so "nothing here is
               affordable for real" reads as a state of this line, not as the button vanishing. -->
          <b-button
            v-if="moveCount > 0"
            size="sm"
            variant="success"
            :disabled="committableMoves === 0"
            @click="$emit('commit')"
          >
            {{ commitLabel }}
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

      <!-- The round-0 faction seed (§11) - the one round-0 thing pass-and-play could not express:
           jump straight to "I have this faction", including in an auction game, where walking every
           seat's bid would have let the resolution decide your faction for you. Only rendered while
           the clone is still in faction selection; from the first starting mine onwards the table is
           settled and ordinary pass-and-play covers the rest. -->
      <div v-if="factionChoices.length > 0" class="analysis-panel__seed">
        <label for="analysis-seed-faction" class="analysis-panel__seed-label">Analyse as</label>
        <select id="analysis-seed-faction" v-model="seedFaction" class="analysis-panel__seed-select">
          <option v-for="choice in factionChoices" :key="choice.faction" :value="choice.faction">
            {{ choice.name }}
          </option>
        </select>
        <b-button size="sm" variant="outline-secondary" :disabled="!seedFaction" @click="submitSeed">
          {{ seatedLineup ? "Try this one instead" : "Try this faction" }}
        </b-button>
        <span class="analysis-panel__seed-hint">
          Skips the pick/auction in this sandbox only, then hands you every player's starting mine placement before
          round 1 runs solo.
        </span>
      </div>
      <div v-if="seatedLineup" class="analysis-panel__seed-lineup">
        <span v-for="(entry, index) in seatedLineup" :key="index" class="analysis-panel__seed-seat">
          <strong v-if="entry.mine">{{ entry.name }} (you)</strong>
          <template v-else>{{ entry.name }}</template>
        </span>
        <span class="analysis-panel__seed-hint">
          No auction price is charged in this line — bids only cost VP at final scoring.
        </span>
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
    committableMoves: { type: Number, default: 0 },
    /** §11's picker options - empty (so the picker is not rendered at all) whenever the clone is
     * past faction selection, which is every case except a round-0 entry. */
    factionChoices: { type: Array as () => { faction: string; name: string }[], default: () => [] },
    /** The table a seed produced, once one is in the line - null otherwise. */
    seatedLineup: { type: Array as () => { name: string; mine: boolean }[] | null, default: null },
  },
  data() {
    return {
      adjustCharge: 1,
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
    commitLabel(): string {
      const n = this.committableMoves as number;
      if (n === 0) {
        return "Nothing committable yet";
      }
      if (n === 1) {
        return "Commit this move";
      }
      return `Commit ${n} moves (1 live + ${n - 1} queued)`;
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

// The round-0 faction seed (§11) - sits above the breakdown rather than inside it, since it applies
// precisely when there is no wallet and therefore no breakdown to sit in.
.analysis-panel__seed,
.analysis-panel__seed-lineup {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.5rem;
  font-size: 0.8rem;
}

.analysis-panel__seed-label {
  margin: 0;
}

.analysis-panel__seed-select {
  padding: 0.1rem 0.3rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.3rem;
  background: var(--ui-surface);
  color: var(--ui-text);
  max-width: 12rem;
}

.analysis-panel__seed-hint {
  flex-basis: 100%;
  opacity: 0.8;
  font-size: 0.78rem;
}

.analysis-panel__seed-seat:not(:last-of-type)::after {
  content: "·";
  margin-left: 0.35rem;
  opacity: 0.6;
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
