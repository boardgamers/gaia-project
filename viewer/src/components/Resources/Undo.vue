<template>
  <svg viewBox="-15 -15 30 30" width="50" height="50" style="overflow: visible">
    <g :transform="transform">
      <Resource class="undo-button" kind="pay-pw" />
      <text class="undo-text" x="0" y="2">undo</text>
      <circle class="undo-button" r="7" @click="undo" />
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";

@Component
export default class Undo extends Vue {
  @Prop()
  transform: string

  undo() {
    this.$store.dispatch("gaiaViewer/undo");
  }
};
</script>
<style lang="scss" scoped>
.undo-button {
  cursor: pointer;
  opacity: 0;
}

.undo-text {
  pointer-events: none;
  font-size: 5.5px;
  fill: white;
  font-weight: 600;
  text-anchor: middle;
}

g.resource {
  opacity: 1;
}
</style>
