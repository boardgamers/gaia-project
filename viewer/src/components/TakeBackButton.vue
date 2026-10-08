<template>
  <!-- "Undo my move" (Commands.vue's turn tools): BGS takes back the player's last SAVED move in a
       game against bots and sends the earlier position. Not the action area's Back badge
       (Resources/Undo.vue), which only steps back through the turn being composed. The arrow is the
       planning header's Undo icon (AnalysisHeaderControls.vue). -->
  <button
    type="button"
    :class="['take-back', compact ? 'take-back--compact' : 'btn btn-sm btn-outline-secondary']"
    data-undo-move
    title="Undo my move"
    aria-label="Undo my move"
    @click="$store.dispatch('takeBackMove')"
  >
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M5 2 1.5 5.5 5 9M2 5.5h7a4 4 0 0 1 0 8H6" />
    </svg>
    <span v-if="!compact">Undo my move</span>
  </button>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
  name: "TakeBackButton",
  props: {
    /** Icon only, for the mobile action tray's title bar. */
    compact: Boolean,
  },
});
</script>

<style lang="scss" scoped>
.take-back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;

  svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

// Same footprint as the tray's handle and its ⋯ menu, on the tray's banner colours.
.take-back--compact {
  flex: 0 0 40px;
  justify-content: center;
  width: 40px;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;

  svg {
    width: 20px;
    height: 20px;
    stroke-width: 1.8;
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: -4px;
  }
}
</style>
