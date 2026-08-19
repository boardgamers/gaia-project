<template>
  <!-- The action area's Back button (Commands.vue) and the player board's own inline one
       (PlayerBoard/Info.vue). It used to be drawn as a `pay-pw` Resource - the game's standard
       "spend power" glyph (a power token in the `--lost` colour with the power-charge arrow
       mirrored over it) - with the word "Back" written across it. That is the icon every cost in
       the game is printed with, so the button read as "going back costs you 1 power", which was the
       owner-reported sandbox-mode bug: it never charged anything, it just looked like it did.
       Now it is a neutral badge with a plain undo arrow on it, carrying no resource symbol at all. -->
  <svg viewBox="-15 -15 30 30" width="50" height="50" style="overflow: visible">
    <g :transform="transform">
      <circle class="undo-badge" r="7.5" />
      <path class="undo-arrow-arc" d="M -3.2 -3.4 A 3.2 3.2 0 1 1 2.45 -1.34" />
      <polygon class="undo-arrow-head" points="-3.2,0.6 -5.4,-3.5 -1,-3.5" />
      <text class="undo-text" x="0" y="6.1">Back</text>
      <circle class="undo-button" r="7.5" @click="undo" />
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";

@Component
export default class Undo extends Vue {
  @Prop()
  transform: string;

  undo() {
    this.$store.dispatch("undo");
  }
}
</script>
<style lang="scss" scoped>
.undo-button {
  cursor: pointer;
  opacity: 0;
}

.undo-badge {
  fill: var(--ui-surface-muted);
  stroke: var(--ui-border-strong);
  stroke-width: 0.6;
  pointer-events: none;
}

// The arrow is an open arc plus a separate triangular head, so one is stroked and the other filled.
.undo-arrow-arc {
  fill: none;
  stroke: var(--ui-text);
  stroke-width: 1.5;
  stroke-linecap: round;
  pointer-events: none;
}

.undo-arrow-head {
  fill: var(--ui-text);
  pointer-events: none;
}

.undo-text {
  pointer-events: none;
  font-size: 4px;
  fill: var(--ui-text);
  font-weight: 600;
  text-anchor: middle;
}
</style>
