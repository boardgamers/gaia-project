<template>
  <svg :viewBox="viewBox" class="old-map-canvas">
    <definitions />
    <Sector
      v-for="center in this.sectors"
      :center="center"
      :key="`${center.q}x{center.r}`"
      :style="`transform: translate(${hexCenter(center).x * 1.01}px, ${hexCenter(center).y * 1.01}px) rotate(${
        rotation(center) * 60
      }deg);`"
    />
    <SpaceHex
      v-for="hex in looseHexes"
      :key="hex.toString()"
      :hex="hex"
      :isCenter="false"
      :transform="`translate(${hexCenter(hex).x * spread},${hexCenter(hex).y * spread})`"
    />
    <use
      v-for="ring in powerRings"
      :key="ring.key"
      xlink:href="#space-hex"
      :class="['space-hex-power-ring', ring.planet]"
      :transform="ring.transform"
      pointer-events="none"
    />
    <text v-for="label in deepSpaceLabels" :key="label.id" :x="label.x" :y="label.y" class="sector-name">
      {{ label.id }}
    </text>
    <rect
      v-for="(planet, i) in terraformingColors"
      :key="planet"
      :class="['planet-fill', planet]"
      width="0.9"
      height="0.9"
      :x="bounds.right - 7.5 + i * 1.05"
      :y="bounds.top + 0.3"
    >
      <title>Terraforming board colour {{ i + 1 }}</title>
    </rect>
    <FactionWheel :transform="`translate(${bounds.left + 3},${bounds.top + 3}) scale(0.5)`" />
  </svg>
</template>

<script lang="ts">
import { Component } from "vue-property-decorator";
import CurrentMap from "../../../viewer/src/components/SpaceMap.vue";
import FactionWheel from "./FactionWheel.vue";
import Sector from "./Sector.vue";
import SpaceHex from "./SpaceHex.vue";
@Component({ components: { Sector, SpaceHex, FactionWheel } })
export default class SpaceMap extends CurrentMap {
  get mapRotationDeg() {
    return 0;
  }
  get spread() {
    return 1.01;
  }
}
</script>
