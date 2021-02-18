<template>
  <g class="sector">
    <SpaceHex
      v-for="hex in sector"
      :key="`${hex.q}x${hex.r}`"
      :transform="`translate(${centerOffset(hex).x}, ${centerOffset(hex).y})`"
      :hex="hex"
      :isCenter="isCenter(hex)"
    />
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { GaiaHex } from "@gaia-project/engine";
import { hexCenter } from "../graphics/hex";
import SpaceHex from "./SpaceHex.vue";
import { CubeCoordinates, Hex } from "hexagrid";

@Component<Sector>({
  components: {
    SpaceHex,
  },
})
export default class Sector extends Vue {
  @Prop()
  center: CubeCoordinates;

  centerOffset(hex: GaiaHex) {
    return hexCenter({
      q: hex.q - this.center.q,
      r: hex.r - this.center.r,
    });
  }

  isCenter(hex: GaiaHex) {
    return hex.q === this.center.q && hex.r === this.center.r;
  }

  get map() {
    return this.$store.state.gaiaViewer.data.map;
  }

  get sector(): GaiaHex[] {
    const coords = Hex.hexagon(2, { center: this.center });
    const ret = coords.map(coord => this.map.grid.get(coord));

    return ret;
  }
}
</script>

<style lang="scss">
.sector {
  transition-duration: 200ms;
}
</style>
