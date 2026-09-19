<template>
  <div class="analysis-tabs" role="tablist" aria-label="Alternative plans" @click.stop>
    <!-- A div rather than a <button>, because the delete control lives INSIDE the open tab and a
         button inside a button is invalid markup that browsers silently un-nest. It was a sibling
         after the last tab first, which put the ✕ visually against whichever line happened to be
         rightmost while it actually deleted the OPEN one - a control that reads as acting on
         something other than what it acts on. Keyboard support is spelled out here (role/tabindex/
         Enter/Space) since a div gets none of it for free. -->
    <div
      v-for="(line, index) in lines"
      :key="index"
      class="analysis-tabs__tab"
      :class="{ 'analysis-tabs__tab--active': index === active }"
      role="tab"
      tabindex="0"
      :title="tabTitle(line, index)"
      :aria-selected="index === active ? 'true' : 'false'"
      @click="$emit('select', index)"
      @keydown.enter.prevent="$emit('select', index)"
      @keydown.space.prevent="$emit('select', index)"
    >
      <span class="analysis-tabs__label">{{ line.label }}</span>
      <span
        v-if="line.overdrawn || line.applied < line.moves"
        class="analysis-tabs__flag"
        :class="{ 'analysis-tabs__flag--overdrawn': line.overdrawn }"
        role="img"
        :aria-label="line.overdrawn ? 'Needs resources' : 'Some moves no longer apply'"
        :title="line.overdrawn ? 'Needs resources' : 'Some moves no longer apply'"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <rect x="7" y="3.5" width="2" height="5.5" rx="1" />
          <circle cx="8" cy="11.5" r="1" />
        </svg>
      </span>
      <!-- Offered on the open tab only, and never on the last line. Both restrictions are about the
           strip staying a comparison rather than becoming a file manager: an ✕ on every tab is five
           ways to lose work sitting one mis-tap from the control used to switch between them.
           @click.stop so deleting is not also read as selecting the tab being deleted. -->
      <button
        v-if="index === active && lines.length > 1"
        type="button"
        class="analysis-tabs__close"
        :title="`Delete ${line.label}`"
        :aria-label="`Delete ${line.label}`"
        @click.stop="$emit('close', index)"
      >
        ✕
      </button>
    </div>

    <!-- `+` forks the OPEN line rather than starting an empty one - see Game.vue's addAnalysisLine
         for why. The label says so, because a control that silently copies would otherwise be a
         surprise; Reset blanks the fork in one press when starting over was what was wanted. -->
    <button
      type="button"
      class="analysis-tabs__add"
      :disabled="lines.length >= maxLines"
      :title="addTitle"
      :aria-label="addTitle"
      @click="$emit('add')"
    >
      <span aria-hidden="true">+</span> Variation
    </button>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import type { AnalysisLineSummary } from "../logic/analysis";
import { MAX_ANALYSIS_LINES } from "../logic/analysis";

export default Vue.extend({
  name: "AnalysisLineTabs",
  props: {
    lines: { type: Array as () => AnalysisLineSummary[], default: () => [] },
    active: { type: Number, default: 0 },
  },
  computed: {
    maxLines(): number {
      return MAX_ANALYSIS_LINES;
    },
    addTitle(): string {
      const lines = this.lines as AnalysisLineSummary[];
      if (lines.length >= MAX_ANALYSIS_LINES) {
        return `You can compare up to ${MAX_ANALYSIS_LINES} plans. Delete one to try another.`;
      }
      const open = lines[this.active as number];
      // An empty line has nothing to fork, so the copy wording would only be confusing there.
      return open && open.moves > 0
        ? `Try a variation of ${open.label}; the original plan is kept`
        : "Start another plan from the same board";
    },
  },
  methods: {
    tabTitle(line: AnalysisLineSummary, index: number): string {
      if (line.moves === 0) {
        return `${line.label} - nothing played yet`;
      }
      const parts = [`${line.label}: ${line.moves} move${line.moves === 1 ? "" : "s"}`];
      if (line.overdrawn) {
        parts.push("spends more than this seat has");
      }
      if (line.applied < line.moves) {
        parts.push(`${line.moves - line.applied} of them no longer apply to the current board`);
      }
      if (index !== this.active) {
        parts.push("click to open it");
      }
      return parts.join(" - ");
    },
  },
});
</script>

<style lang="scss" scoped>
.analysis-tabs {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  border-bottom: 1px solid var(--ui-border);
  overflow-x: auto;
  max-width: 100%;
  scrollbar-width: thin;
}

.analysis-tabs__tab,
.analysis-tabs__add {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  padding: 0.55rem 0.25rem;
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  color: var(--ui-text-muted);
}

.analysis-tabs__tab--active {
  border-bottom-color: var(--ui-info-text);
  font-weight: 600;
  color: var(--ui-info-text);
  cursor: default;
}

.analysis-tabs__flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: var(--ui-warning-text);
  color: var(--ui-warning-bg);
  svg {
    display: block;
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
}
.analysis-tabs__add {
  font-size: 0.75rem;
  font-weight: 400;
  &:hover:enabled {
    color: var(--ui-info-text);
  }
}
.analysis-tabs__add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.analysis-tabs__close {
  border: 0;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 0.65rem;
  padding: 0.15rem;
  cursor: pointer;
  &:hover,
  &:focus {
    color: var(--ui-danger-text);
  }
}
</style>
