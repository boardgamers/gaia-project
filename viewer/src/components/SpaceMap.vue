<template>
  <svg :viewBox="`-13 -11.5 ${right} 24`">
    <definitions />
    <Sector
      v-for="center in this.sectors"
      :center="center"
      :key="`${center.q}x{center.r}`"
      :style="`transform: translate(${hexCenter(center).x * 1.01}px, ${hexCenter(center).y * 1.01}px) rotate(${
        rotation(center) * 60
      }deg);`"
    />
    <circle
      v-for="(s, i) in highlightedSectors"
      :key="i"
      r="1"
      :style="`fill: ${i === 0 ? 'red' : 'back'}; transform: translate(${hexCenter(s).x * 1.01}px, ${
        hexCenter(s).y * 1.01
      }px)`"
    />
    <FactionWheel transform="translate(-10.2, -8.7) scale(0.65)" />
    <image v-if="showCharts" xlink:href="../assets/resources/line-chart.svg" :height=155/211*22 width="22" x="-11"
    y="-8" v-b-modal.chart-button role="button" :transform="`translate(${right - 15}, -10) scale(0.1)`" />
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component } from "vue-property-decorator";
import Engine, { SpaceMap as SpaceMapData } from "@gaia-project/engine";
import { hexCenter } from "../graphics/hex";
import Sector from "./Sector.vue";
import { CubeCoordinates } from "hexagrid";
import FactionWheel from "./FactionWheel.vue";
import Definitions from "./definitions/Definitions.vue";

@Component<SpaceMap>({
  components: {
    FactionWheel,
    Definitions,
    Sector,
  },
})
export default class SpaceMap extends Vue {
  hexCenter(hex: CubeCoordinates) {
    return hexCenter(hex);
  }

  get highlightedSectors(): CubeCoordinates[] {
    return this.$store.state.context.highlighted.sectors;
  }

  get sectors(): CubeCoordinates[] {
    return this.map.configuration().centers;
  }

  rotation(center: CubeCoordinates) {
    return this.$store.state.context.rotation.get(`${center.q}x${center.r}`) || 0;
  }

  get engine(): Engine {
    return this.$store.state.data;
  }

  get showCharts(): boolean {
    return !this.engine.players.some((p) => !p.faction);
  }

  get map(): SpaceMapData {
    return this.engine.map;
  }

  get right() {
    return (this.sectors || []).length > 7 ? 33.5 : 26;
  }
}
</script>

<style lang="scss"></style>
