<template>
  <!-- A non-renewable supply, printed like the satellite counter: one black symbol and a number. -->
  <g
    v-if="visible"
    class="exploration-supply"
    :class="{ 'exploration-supply--empty': remaining === 0 }"
    role="img"
    tabindex="0"
    :aria-label="label"
    v-b-tooltip.hover.focus.click
    :title="label"
  >
    <title>{{ label }}</title>
    <path
      class="shuttle-symbol"
      transform="scale(0.04)"
      fill="black"
      opacity="0.8"
      fill-rule="evenodd"
      d="M-9 -7 Q-9 -11 -5 -11 H5 Q9 -11 9 -7 V0 L13 10 Q13 12 11 12 H7 L4 5 Q2 2 2 6 V12 H-3 V6 Q-3 2 -5 5 L-8 12 H-12 Q-14 12 -13 9 L-9 0Z M-6 -7 Q-6 -8 -5 -8 H5 Q6 -8 6 -7 V-3 Q6 -2 5 -2 H-5 Q-6 -2 -6 -3Z"
    />
    <text class="board-text remaining-count" transform="translate(0.95,-0.05) scale(0.8)" fill="black">{{
      remaining
    }}</text>
  </g>
</template>

<script lang="ts">
import type Engine from "@gaia-project/engine";
import type { PlayerData } from "@gaia-project/engine";
import { Expansion, hasExpansion } from "@gaia-project/engine";
import { maxExplorationShuttles } from "@gaia-project/engine/src/exploration";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";

@Component
export default class ExplorationSupply extends Vue {
  @Prop({ required: true }) data: PlayerData;
  @Prop({ required: true }) engine: Engine;
  @Prop({ default: false }) automa: boolean;

  get visible() {
    return !this.automa && hasExpansion(this.engine.expansions, Expansion.LostFleet);
  }

  get total() {
    return maxExplorationShuttles(this.engine.players.length);
  }

  get remaining() {
    return Math.max(0, this.total - this.data.exploredShipsCount());
  }

  get label() {
    // The localization adapter translates both the tooltip and accessible label, including counts.
    return `Exploration shuttles remaining: ${this.remaining} of ${this.total}`;
  }
}
</script>

<style scoped>
.exploration-supply {
  cursor: help;
}
/* Use the scaled silhouette for keyboard focus: browser CSS outlines are rounded to whole
   pixels, which become enormous in this board's SVG user units. */
.exploration-supply:focus {
  outline: none !important;
}
.exploration-supply:focus-visible .shuttle-symbol {
  stroke: var(--ui-focus, black);
  stroke-width: 1.3;
}
</style>
