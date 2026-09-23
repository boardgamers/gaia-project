<template>
  <ol class="analysis-moves" aria-label="Simulated moves">
    <li v-for="(entry, index) in entries" :key="index">
      <button
        v-if="entry.kind !== 'faction'"
        type="button"
        class="analysis-moves__insert"
        :disabled="disabled || index > appliedCount"
        :aria-label="insertLabel(index)"
        :title="insertLabel(index)"
        @click="$emit('insert', index)"
        @keydown.stop
      >
        <span aria-hidden="true">+</span>
      </button>
      <div class="analysis-moves__row">
        <button
          v-if="entry.kind === 'move'"
          type="button"
          class="analysis-moves__move"
          :class="{
            'analysis-moves__move--blocked': index === appliedCount,
          }"
          :disabled="disabled || index > appliedCount"
          :aria-label="`Edit move ${moveNumber(index)}: ${entry.move}`"
          title="Replay this move from the beginning"
          @click="$emit('edit', index)"
          @keydown.stop
        >
          <span class="analysis-moves__number">{{ moveNumber(index) }}</span>
          <span class="analysis-moves__text">{{ entry.move }}</span>
          <span v-if="index === appliedCount" class="analysis-moves__state">Needs update</span>
          <svg class="analysis-moves__pencil" viewBox="0 0 16 16" aria-hidden="true">
            <path d="m10.7 2.3 3 3-8.4 8.4-3.8.8.8-3.8Zm1.1-1.1 1-1a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4l-1 1Z" />
          </svg>
        </button>
        <span v-else class="analysis-moves__adjustment">{{
          entry.kind === "adjust" ? `Assume ${entry.charge} power charged` : `Faction setup: ${entry.lineup.join(", ")}`
        }}</span>
        <button
          v-if="entry.kind !== 'faction'"
          type="button"
          class="analysis-moves__remove"
          :disabled="disabled"
          :aria-label="
            entry.kind === 'move' ? `Remove move ${moveNumber(index)}` : `Remove simulated charge at step ${index + 1}`
          "
          title="Remove from plan"
          @click="$emit('remove', index)"
          @keydown.stop
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 4h11M6 4V2h4v2M4 4l.7 10h6.6L12 4M6.5 6.5v5M9.5 6.5v5" />
          </svg>
        </button>
      </div>
    </li>
    <li>
      <button
        type="button"
        class="analysis-moves__insert"
        :disabled="disabled || appliedCount < entries.length || !canAppend"
        aria-label="Add move at end"
        title="Add move at end"
        @click="$emit('insert', entries.length)"
        @keydown.stop
      >
        <span aria-hidden="true">+</span>
      </button>
    </li>
  </ol>
</template>

<script lang="ts">
import type { PropType } from "vue";
import Vue from "vue";
import type { AnalysisEntry } from "../logic/analysis";

export default Vue.extend({
  name: "AnalysisMoves",
  props: {
    entries: { type: Array as PropType<AnalysisEntry[]>, default: () => [] },
    appliedCount: { type: Number, default: 0 },
    disabled: Boolean,
    canAppend: { type: Boolean, default: true },
  },
  methods: {
    moveNumber(index: number): number {
      return this.entries.slice(0, index + 1).filter((entry) => entry.kind === "move").length;
    },
    insertLabel(index: number): string {
      return this.entries[index].kind === "move"
        ? `Insert before move ${this.moveNumber(index)}`
        : `Insert before step ${index + 1}`;
    },
  },
});
</script>

<style lang="scss" scoped>
.analysis-moves {
  margin: 0 0 0.8rem;
  padding: 0;
  list-style: none;
  font-size: 0.85rem;
}
.analysis-moves__row {
  display: flex;
  align-items: stretch;
}
.analysis-moves__insert {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  min-height: 1.5rem;
  padding: 0 0.6rem;
  border: 0;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 1rem;
  line-height: 1;
  &::before,
  &::after {
    content: "";
    flex: 1;
    border-top: 1px solid var(--ui-border);
  }
  &:hover:enabled,
  &:focus-visible {
    color: var(--ui-info-text);
  }
  &:disabled {
    opacity: 0.4;
  }
}
.analysis-moves__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 2rem;
  min-height: 2rem;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--ui-text-muted);
  svg {
    width: 1rem;
    height: 1rem;
  }
  &:hover:enabled,
  &:focus-visible {
    color: var(--ui-danger-text);
    background: var(--ui-surface-muted);
  }
  &:disabled {
    opacity: 0.4;
  }
}
.analysis-moves__move {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: 1;
  min-width: 0;
  text-align: left;
  padding: 0.4rem 0.55rem;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--ui-text);
  &:hover:enabled {
    background: var(--ui-surface-muted);
  }
  &:focus-visible {
    outline: 2px solid var(--ui-info-text);
    outline-offset: -2px;
  }
  &--blocked {
    border-left-color: var(--ui-warning-border);
  }
  &:disabled {
    color: var(--ui-text-muted);
  }
}
.analysis-moves__number {
  flex: 0 0 1.2rem;
  color: var(--ui-text-muted);
  font-variant-numeric: tabular-nums;
}
.analysis-moves__text {
  flex: 1;
  overflow-wrap: anywhere;
  min-width: 0;
}
.analysis-moves__state {
  font-size: 0.75rem;
  color: var(--ui-warning-text);
}
.analysis-moves__pencil {
  flex: 0 0 0.75rem;
  width: 0.75rem;
  height: 0.75rem;
  fill: currentColor;
  opacity: 0.6;
}
.analysis-moves__adjustment {
  flex: 1;
  padding: 0.25rem 0.55rem 0.25rem 2.5rem;
  color: var(--ui-text-muted);
  font-size: 0.8rem;
}
</style>
