<template>
  <div class="analysis-controls" @click.stop>
    <div class="analysis-controls__summary">
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
    <div class="analysis-controls__actions">
      <button
        type="button"
        class="analysis-controls__edit"
        :disabled="!canEdit"
        aria-label="Undo"
        title="Undo"
        @click="$emit('undo')"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 2 1.5 5.5 5 9M2 5.5h7a4 4 0 0 1 0 8H6" />
        </svg>
      </button>
      <button
        type="button"
        class="analysis-controls__edit analysis-controls__clear"
        :disabled="!canEdit"
        aria-label="Clear plan"
        title="Clear plan"
        @click="$emit('reset')"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2.5 4h11M6 4V2h4v2M4 4l.7 10h6.6L12 4M6.5 6.5v5M9.5 6.5v5" />
        </svg>
      </button>
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
      <b-button size="sm" variant="outline-secondary" class="analysis-controls__exit" @click="$emit('exit')"
        >Exit simulation</b-button
      >
    </div>
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

.analysis-controls__summary,
.analysis-controls__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border: 0;
  border-radius: 4px;
  padding: 0;
  background: transparent;
  color: var(--ui-text);
  svg {
    width: 1.1rem;
    height: 1.1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    path {
      fill: none;
    }
  }
  &:hover:enabled {
    color: var(--ui-info-text);
    background: var(--ui-surface-muted);
  }
  &:focus-visible {
    outline: 2px solid var(--ui-info-text);
    outline-offset: 1px;
  }
  &:disabled {
    color: var(--ui-text-muted);
    opacity: 0.5;
  }
}

.analysis-controls__clear:hover:enabled {
  color: var(--ui-danger-text);
}

.analysis-controls__exit {
  white-space: nowrap;
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
  width: 2rem;
  height: 2rem;
  padding: 0;
  line-height: 1;
  text-decoration: none;
}

@media (max-width: 767px) {
  .analysis-controls__summary {
    width: 100%;
  }
  .analysis-controls__info {
    margin-left: auto;
  }
  .analysis-controls__actions {
    gap: 0.25rem;
  }
  .analysis-controls__actions > button {
    min-height: 2.75rem;
  }
  .analysis-controls__edit {
    width: 2.5rem;
  }
}

@media (max-width: 359px) {
  .analysis-controls__edit {
    width: 2rem;
  }
  .analysis-controls__btn,
  .analysis-controls__exit {
    font-size: 0.8rem;
  }
}
</style>
