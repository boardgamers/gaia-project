<template>
  <!--
    The sandbox's line strip (ANALYSIS_MODE_PLAN.md §13) - one tab per line you are working out,
    sitting on top of the striped header like browser tabs on a toolbar.

    There is no Save button. Every line autosaves on every completed turn, exactly as the single line
    always has (Game.vue's setAnalysisEntries), so "saving" was never a thing the player had to do -
    a Save button would only have introduced a second meaning of saved and, with it, the question of
    whether unsaved work could be lost. Line 1 therefore exists from the moment the sandbox opens and
    `+` adds the next one; there is no zero state.

    @click.stop on the root is load-bearing, not defensive: the striped header this sits on is
    click-to-exit (§5.4, Commands.vue's .sticky-bar-title--analysis / #move-title.move-title--analysis
    both bind it), so without it every press on a tab would also close the sandbox - and the press
    would land as "exit" rather than "switch line", which is the worst possible reading of it.
  -->
  <div class="analysis-tabs" @click.stop>
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
      <!-- The outcome, on the tab itself. Without it the strip would only let you SWITCH between
           lines, and switching replaces the board - so comparing would mean holding line A in your
           head while reading line B, which is the exact job the sandbox exists to take off you. -->
      <span v-if="line.moves > 0" class="analysis-tabs__vp" :class="vpClass(line)">{{ vpLabel(line) }}</span>
      <span v-if="line.overdrawn" class="analysis-tabs__flag analysis-tabs__flag--overdrawn" aria-hidden="true">!</span>
      <span v-else-if="line.applied < line.moves" class="analysis-tabs__flag" aria-hidden="true">~</span>
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
      +
    </button>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { AnalysisLineSummary, MAX_ANALYSIS_LINES } from "../logic/analysis";

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
        return `${MAX_ANALYSIS_LINES} lines is the most that fits - delete one to start another`;
      }
      const open = lines[this.active as number];
      // An empty line has nothing to fork, so the copy wording would only be confusing there.
      return open && open.moves > 0
        ? "Carry on from here in a new line - this one is kept as it is"
        : "Start another line from the same board";
    },
  },
  methods: {
    vpLabel(line: AnalysisLineSummary): string {
      return `${line.victoryPoints >= 0 ? "+" : ""}${line.victoryPoints}`;
    },
    vpClass(line: AnalysisLineSummary): string | null {
      return line.victoryPoints > 0
        ? "analysis-tabs__vp--gain"
        : line.victoryPoints < 0
          ? "analysis-tabs__vp--loss"
          : null;
    },
    tabTitle(line: AnalysisLineSummary, index: number): string {
      if (line.moves === 0) {
        return `${line.label} - nothing played yet`;
      }
      const parts = [
        `${line.label}: ${line.moves} move${line.moves === 1 ? "" : "s"}, ${this.vpLabel(
          line
        )} VP against where the sandbox started`,
      ];
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
// Sits directly on the yellow/black hazard stripes, so - like every other text run up there - each
// tab carries its own OPAQUE fill rather than a scrim (see AnalysisHeaderControls.vue's note on why
// an alpha is not good enough here, however good its contrast ratio measures).
$tab-active: #1b1b20;
$tab-idle: #3d3d46;

.analysis-tabs {
  display: flex;
  align-items: flex-end;
  gap: 0.2rem;
  // No rail of its own: the striped banner the strip rests on IS the rail, and the tabs overlap its
  // top edge by a few pixels (Commands.vue's negative bottom margin) to join the two. A rail here
  // used to stand in for that while the strip lived inside the banner, and it now only drew a dark
  // line across the banner's top edge.
  // Five tabs plus the two controls do not fit one row on a narrow phone. Scrolling the strip is the
  // only option that keeps the header one row tall; wrapping would grow the mobile sticky sheet by a
  // whole line every time a tab was added.
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  max-width: 100%;

  &::-webkit-scrollbar {
    display: none;
  }
}

.analysis-tabs__tab {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  border: 0;
  user-select: none;
  // The "half dome" - rounded on top, square where it meets the rail.
  border-radius: 0.55rem 0.55rem 0 0;
  padding: 0.1rem 0.45rem;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.45;
  white-space: nowrap;
  cursor: pointer;
  background: $tab-idle;
  color: #d8d8e0;
}

.analysis-tabs__tab--active {
  background: $tab-active;
  color: #fff;
  // Picks up the stripe's own amber so the open tab is identifiable at a glance rather than by
  // comparing two dark greys.
  box-shadow: inset 0 2px 0 #c2a233;
  cursor: default;
}

.analysis-tabs__vp {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: #b9b9c4;
}

.analysis-tabs__vp--gain {
  color: #a5d6a7;
}

.analysis-tabs__vp--loss {
  color: #ff8a80;
}

// Overdrawn: the VP on this tab was bought with resources the seat does not have, so it is not
// comparable to a payable line without saying so. Same red as the header's overdraft chip.
.analysis-tabs__flag {
  font-weight: 700;
  color: #ffe082;
}

.analysis-tabs__flag--overdrawn {
  color: #ff8a80;
}

.analysis-tabs__add {
  flex: 0 0 auto;
  border: 0;
  border-radius: 0.55rem 0.55rem 0 0;
  padding: 0.1rem 0.45rem;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.45;
  cursor: pointer;
  background: $tab-idle;
  color: #fff;
}

.analysis-tabs__add:disabled {
  // Full opacity on purpose - a faded control on diagonal stripes is the unreadable state, the same
  // trap the Commit button's own disabled styling had to be written around.
  opacity: 1;
  color: #8b8b96;
  cursor: not-allowed;
}

// Sits inside the open tab, so it is deliberately quiet until pointed at: it is the one control up
// here that destroys something, and it shares its tap target's neighbourhood with the control used
// to switch lines.
.analysis-tabs__close {
  border: 0;
  background: transparent;
  color: #8f8f9b;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
  padding: 0.1rem 0.1rem 0.1rem 0.15rem;
  cursor: pointer;

  &:hover,
  &:focus {
    color: #ff8a80;
  }
}
</style>
