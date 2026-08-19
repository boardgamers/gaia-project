<template>
  <!-- The action area's Back button (Commands.vue) and the player board's own inline one
       (PlayerBoard/Info.vue). It used to be drawn as a `pay-pw` Resource - the game's standard
       "spend power" glyph (a power token in the `--lost` colour with the power-charge arrow
       mirrored over it) - with the word "Back" written across it, i.e. the icon every cost in the
       game is printed with. A neutral badge with a plain undo arrow, carrying no resource symbol.
       That was only half of the owner's "back charges 1 power" report, and the wrong half: in
       sandbox mode it really did charge, via the DOM reuse Commands.vue's keys now prevent. -->
  <svg viewBox="-15 -15 30 30" width="50" height="50" style="overflow: visible">
    <g :transform="transform">
      <circle class="undo-badge" r="7.5" />
      <path class="undo-arrow-arc" d="M -3.2 -3.4 A 3.2 3.2 0 1 1 2.45 -1.34" />
      <polygon class="undo-arrow-head" points="-3.2,0.6 -5.4,-3.5 -1,-3.5" />
      <text class="undo-text" x="0" y="6.1">Back</text>
      <!-- `.stop` for two reasons. In Commands.vue this whole badge sits inside a `<b-btn @click="undo">`,
           so without it ONE press dispatched `undo` TWICE - the second one running past the menu level
           it had just left and undoing a command as well. And stopping the bubble is what keeps a
           press from ever reaching a re-rendered ancestor: Vue re-renders in the microtask checkpoint
           between two listeners, which is how Back's own element used to become the Charge 1 button
           mid-click (see Commands.vue's keys). PlayerBoard/Info.vue renders this with no wrapping
           button, so the handler has to stay here rather than move up. -->
      <circle class="undo-button" r="7.5" @click.stop="undo" />
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
