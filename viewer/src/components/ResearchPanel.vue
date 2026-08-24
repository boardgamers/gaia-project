<template>
  <!-- The research board keeps its place in normal flow so it goes on defining the panel's own
       height at every viewport width. -->
  <div class="research-panel">
    <div class="research-board-face">
      <slot />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class ResearchPanel extends Vue {}
</script>

<style lang="scss" scoped>
.research-panel {
  position: relative;
  // Vertical scrolling stays with the page; pinch zoom remains native even when the gesture starts
  // anywhere on this panel.
  touch-action: pan-y pinch-zoom;
}

.research-board-face {
  width: 100%;
}
</style>
