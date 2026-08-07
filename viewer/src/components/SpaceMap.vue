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
    <!-- Inline SVG (instead of an <image>) so the icon follows the page's text color, also in dark mode -->
    <g
      v-if="showCharts"
      class="line-chart-icon"
      v-b-modal.chart-button
      role="button"
      :transform="`translate(${right - 15}, -10) scale(0.0043)`"
    >
      <path
        d="M32,480h480v32H0V0h32v96h32v32H32v64h32v32H32v64h32v32H32v64h32v32H32V480z M96,336c0-26.5,21.484-48,48-48
        c4.984,0,9.688,0.969,14.219,2.375l41.844-55.813C194.984,226.969,192,217.813,192,208c0-26.5,21.5-48,48-48s48,21.5,48,48
        c0,5-0.969,9.688-2.391,14.219l55.797,41.844C349.031,259,358.156,256,368,256c2,0,3.875,0.344,5.812,0.594L429.5,145.25
        c-8.312-8.625-13.5-20.313-13.5-33.25c0-26.5,21.5-48,48-48s48,21.5,48,48s-21.5,48-48,48c-2,0-3.875-0.344-5.812-0.594
        L402.531,270.75C410.844,279.375,416,291.062,416,304c0,26.5-21.5,48-48,48s-48-21.5-48-48c0-4.969,0.969-9.688,2.375-14.219
        l-55.797-41.844C258.969,253,249.828,256,240,256c-4.984,0-9.688-0.969-14.203-2.375l-41.859,55.781
        C189.016,317.031,192,326.156,192,336c0,26.5-21.484,48-48,48S96,362.5,96,336z M448,112c0,8.844,7.156,16,16,16s16-7.156,16-16
        s-7.156-16-16-16S448,103.156,448,112z M352,304c0,8.844,7.156,16,16,16s16-7.156,16-16s-7.156-16-16-16S352,295.156,352,304z
        M224,208c0,8.844,7.156,16,16,16s16-7.156,16-16s-7.156-16-16-16S224,199.156,224,208z M128,336c0,8.844,7.156,16,16,16
        s16-7.156,16-16s-7.156-16-16-16S128,327.156,128,336z"
      />
    </g>
    <g v-for="(color, i) in colorLegend" :key="i" :transform="`translate(-12.5, ${2.3 + 2 * i}) scale(.8)`">
      <rect width="2" height="2" class="color-legend leech" :class="color.class" />
      <text class="color-legend" transform="translate(1, 1.55)">{{ color.text }}</text>
    </g>
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
import { MapMode, MapModeType } from "../data/actions";

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

  get mapModes(): MapMode[] {
    return this.$store.getters.mapModes;
  }

  get colorLegend(): { class: string; text: string }[] {
    if (this.mapModes.find(m => m.type === MapModeType.leech || m.type == MapModeType.federations)) {
      return [...Array(5).keys()].map(i => ({class: `power${i + 1}`, text: String(i + 1)}));
    }
    return [];
  }
}
</script>

<style lang="scss">
.line-chart-icon {
  fill: currentColor;
  stroke: none;
}

.color-legend {
  stroke: black;
  stroke-width: 0.1px;
  font-size: 1.5px;
  text-anchor: middle;
}
text.color-legend {
  fill: white;
  stroke: white;
}
</style>
