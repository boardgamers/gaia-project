<template>
  <div class="analysis-controls" @click.stop>
    <span class="analysis-controls__moves">{{ moveCount }} {{ moveCount === 1 ? "move" : "moves" }}</span>

    <span
      v-if="changes.length"
      class="analysis-controls__changes"
      title="Net resource and VP changes since this plan started"
    >
      <span class="analysis-controls__label">Plan:</span>
      <span
        v-for="item in changes"
        :key="item.kind"
        class="analysis-controls__resource"
        :class="{ 'analysis-controls__resource--gain': item.amount > 0 }"
        :aria-label="`${item.amount > 0 ? '+' : ''}${item.amount} ${resourceName(item.kind)}`"
      >
        <RichTextView :content="parseRewardsForLog(`${item.amount}${item.kind}`)" />
      </span>
    </span>
    <span v-if="overdrawn.length || assumedPower" class="analysis-controls__shortfall" :title="shortfallTitle"
      >Needs resources</span
    >
    <button class="analysis-controls__edit" :disabled="!canEdit" @click="$emit('undo')">Undo</button>
    <button class="analysis-controls__edit" :disabled="!canEdit" @click="$emit('reset')">Clear plan</button>
    <b-button
      v-if="moveCount > 0"
      size="sm"
      variant="success"
      class="analysis-controls__btn"
      :disabled="committableMoves === 0"
      :title="commitTitle"
      @click="$emit('commit')"
    >
      {{ playsNow ? "Play moves" : "Queue moves" }}
    </b-button>
    <!-- The modal itself is rendered once by Commands.vue (AnalysisModeInfo.vue) - see its comment for
         why it must not live in this twice-rendered component. -->
    <b-btn
      variant="link"
      size="sm"
      class="analysis-controls__info"
      aria-label="How planning works"
      title="How planning works"
      @click="$bvModal.show('analysis-mode-info')"
    >
      <b-badge variant="info" pill>i</b-badge>
    </b-btn>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import type { AnalysisOverdraft, AnalysisResourceChange, AnalysisStatus } from "../logic/analysis";
import { parseRewardsForLog } from "../logic/utils";
import RichTextView from "./Resources/RichTextView.vue";

export default Vue.extend({
  name: "AnalysisHeaderControls",
  components: { RichTextView },
  methods: {
    parseRewardsForLog,
    resourceName(kind: string): string {
      return { c: "credits", o: "ore", k: "knowledge", q: "QIC", vp: "victory points" }[kind];
    },
  },
  props: {
    playsNow: Boolean,
    canEdit: Boolean,
    moveCount: { type: Number, default: 0 },
    status: { type: Object as () => AnalysisStatus | null, default: null },
    committableMoves: { type: Number, default: 0 },
  },
  computed: {
    changes(): AnalysisResourceChange[] {
      return this.status?.changes ?? [];
    },
    shortfallTitle(): string {
      const missing = this.overdrawn.map((item) => `${-item.amount} ${this.resourceName(item.kind)}`);
      if (this.assumedPower) missing.push(`${this.assumedPower} power`);
      return `This preview needs ${missing.join(", ")} beyond your current resources.`;
    },
    overdrawn(): AnalysisOverdraft[] {
      return (this.status as AnalysisStatus | null)?.overdrawn ?? [];
    },
    assumedPower(): number {
      return (this.status as AnalysisStatus | null)?.assumedPower ?? 0;
    },
    commitTitle(): string {
      const n = this.committableMoves as number;
      return n === 0
        ? "Nothing in this plan can be played for real yet"
        : `Review ${n} move${n === 1 ? "" : "s"} before ${this.playsNow ? "playing" : "queuing"}`;
    },
  },
});
</script>

<style lang="scss" scoped>
.analysis-controls {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
  margin-left: auto;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.analysis-controls__moves,
.analysis-controls__label {
  color: var(--ui-text-muted);
}
.analysis-controls__changes,
.analysis-controls__resource {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
.analysis-controls__changes {
  flex-wrap: wrap;
  gap: 0;
}
.analysis-controls__resource {
  white-space: nowrap;
}
.analysis-controls__resource--gain {
  color: var(--ui-success-text);
}
.analysis-controls__shortfall {
  color: var(--ui-warning-text);
  font-size: 0.75rem;
}
.analysis-controls__edit {
  border: 0;
  border-left: 1px solid var(--ui-border);
  padding: 0.2rem 0.5rem;
  background: transparent;
  color: var(--ui-text);
  font: inherit;
  &:hover:enabled {
    color: var(--ui-info-text);
    text-decoration: underline;
  }
  &:disabled {
    color: var(--ui-text-muted);
    opacity: 0.5;
  }
}

.analysis-controls__btn {
  padding: 0.25rem 0.6rem;
  line-height: 1.3;
  font-weight: 600;
}

// Commit is disabled until something in the line is committable, and that state was the unreadable
// one on the hazard stripes: full opacity has to be forced (Bootstrap's .65 turns stripes into mush)
// and over `--ui-surface-muted` the label was `--ui-text-subtle`, i.e. a grey-on-grey pair sitting
// around 3:1 in both themes. Same muted surface, a text colour that can actually be read on it.
.analysis-controls__btn:disabled,
.analysis-controls__btn.disabled {
  opacity: 1;
  background: var(--ui-surface-muted);
  border-color: var(--ui-border-strong);
  color: var(--ui-text-muted);
}

.analysis-controls__btn.btn-success {
  border-radius: 6px;
  box-shadow: 0 1px 2px var(--ui-shadow-soft);
}

.analysis-controls__info {
  padding: 0 0.15rem;
  line-height: 1;
  text-decoration: none;
}
</style>
