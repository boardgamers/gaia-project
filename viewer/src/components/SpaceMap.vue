<template>
  <svg :viewBox="viewBox">
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
      :transform="`translate(${hexCenter(hex).x * 1.01}, ${hexCenter(hex).y * 1.01})`"
      :hex="hex"
      :isCenter="false"
    />
    <circle
      v-for="(s, i) in highlightedSectors"
      :key="i"
      r="1"
      :style="`fill: ${i === 0 ? 'red' : 'back'}; transform: translate(${hexCenter(s).x * 1.01}px, ${
        hexCenter(s).y * 1.01
      }px)`"
    />
    <FactionWheel class="faction-wheel" :transform="`translate(${bounds.left + 3.1}, ${bounds.top + 2.9}) scale(0.65)`" />
    <image v-if="showCharts" xlink:href="../assets/other/line-chart.svg" :height=155/211*22 width="22" x="-11" y="-8"
    v-b-modal.chart-button role="button" :transform="`translate(${bounds.right - 1.9}, ${bounds.top + 1.4}) scale(0.1)`" />
    <g v-if="isLostFleet" class="lost-fleet-map-legend" :transform="`translate(${bounds.left + 0.3}, ${bounds.top + 9.2})`">
      <rect class="lost-fleet-map-legend__panel" width="5.5" height="5.4" rx="0.4" ry="0.4" />
      <text class="lost-fleet-map-legend__title" transform="translate(0.5, 1)">Lost Fleet</text>
      <g class="lost-fleet-map-legend__row" data-kind="interspace" transform="translate(0.55, 1.95)">
        <rect class="lost-fleet-map-legend__swatch lost-fleet-map-legend__swatch--interspace" width="1.2" height="0.68" rx="0.18" ry="0.18" />
        <text class="lost-fleet-map-legend__label" transform="translate(0.6, 0.47)">IS</text>
        <text class="lost-fleet-map-legend__copy" transform="translate(1.7, 0.5)">Interspace</text>
      </g>
      <g class="lost-fleet-map-legend__row" data-kind="deep-space" transform="translate(0.55, 3)">
        <rect class="lost-fleet-map-legend__swatch lost-fleet-map-legend__swatch--deep-space" width="1.2" height="0.68" rx="0.18" ry="0.18" />
        <text class="lost-fleet-map-legend__label" transform="translate(0.6, 0.47)">DS</text>
        <text class="lost-fleet-map-legend__copy" transform="translate(1.7, 0.5)">Deep Space</text>
      </g>
      <g class="lost-fleet-map-legend__row" data-kind="ship" transform="translate(0.55, 4.05)">
        <circle class="lost-fleet-map-legend__ship" cx="0.6" cy="0.34" r="0.34" />
        <text class="lost-fleet-map-legend__label" transform="translate(0.6, 0.46)">T</text>
        <text class="lost-fleet-map-legend__copy" transform="translate(1.7, 0.5)">T/R/M/E Ship</text>
      </g>
    </g>
    <g v-for="(color, i) in colorLegend" :key="i" :transform="`translate(${bounds.left + 0.6}, ${bounds.top + (isLostFleet ? 15.4 : 7.8) + 2 * i}) scale(.8)`">
      <rect width="2" height="2" class="color-legend leech" :class="color.class" />
      <text class="color-legend" transform="translate(1, 1.55)">{{ color.text }}</text>
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component } from "vue-property-decorator";
import Engine, {
  Expansion,
  classifySectorId,
  GaiaHex,
  LostFleetSectorType,
  hasExpansion,
  SpaceMap as SpaceMapData,
} from "@gaia-project/engine";
import { hexCenter } from "../graphics/hex";
import Sector from "./Sector.vue";
import { CubeCoordinates } from "hexagrid";
import FactionWheel from "./FactionWheel.vue";
import Definitions from "./definitions/Definitions.vue";
import { MapMode, MapModeType } from "../data/actions";
import SpaceHex from "./SpaceHex.vue";

@Component<SpaceMap>({
  components: {
    FactionWheel,
    Definitions,
    Sector,
    SpaceHex,
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

  get looseHexes(): GaiaHex[] {
    return [...this.map.grid.values()]
      .filter((hex) => classifySectorId(hex.data.sector) !== LostFleetSectorType.Space)
      .sort((a, b) => a.q - b.q || a.r - b.r || a.s - b.s);
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

  get isLostFleet(): boolean {
    return hasExpansion(this.engine.expansions, Expansion.LostFleet);
  }

  /**
   * Bounding box of every hex on the board (in rendered units, i.e. hexCenter * 1.01 like the
   * template's transforms), padded by one hex radius, plus a reserved left sidebar where the
   * faction wheel / legends live so they never cover hexes. Replaces the old hardcoded
   * viewBox, which clipped the taller Lost Fleet 3p/4p layouts.
   */
  get bounds(): { left: number; top: number; right: number; bottom: number } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const hex of this.map.grid.values()) {
      const c = hexCenter(hex);
      minX = Math.min(minX, c.x * 1.01);
      maxX = Math.max(maxX, c.x * 1.01);
      minY = Math.min(minY, c.y * 1.01);
      maxY = Math.max(maxY, c.y * 1.01);
    }
    if (minX > maxX) {
      // no hexes (e.g. map not generated yet) - keep the old base-game frame
      return { left: -13, top: -11.5, right: 13, bottom: 12.5 };
    }
    const hexPad = 1.3;
    const sidebar = 6;
    return { left: minX - hexPad - sidebar, top: minY - hexPad, right: maxX + hexPad, bottom: maxY + hexPad };
  }

  get viewBox(): string {
    const b = this.bounds;
    return `${b.left} ${b.top} ${b.right - b.left} ${b.bottom - b.top}`;
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

.lost-fleet-map-legend {
  pointer-events: none;
}

.lost-fleet-map-legend__panel {
  fill: rgb(255 255 255 / 92%);
  stroke: #c8d3e3;
  stroke-width: 0.06px;
}

.lost-fleet-map-legend__title {
  fill: #172e62;
  font-size: 0.56px;
  font-weight: 700;
  text-anchor: start;
}

.lost-fleet-map-legend__swatch,
.lost-fleet-map-legend__ship {
  stroke: #172e62;
  stroke-width: 0.06px;
}

.lost-fleet-map-legend__swatch--interspace {
  fill: #203760;
}

.lost-fleet-map-legend__swatch--deep-space {
  fill: #111c3d;
}

.lost-fleet-map-legend__ship {
  fill: #efe6c4;
}

.lost-fleet-map-legend__label,
.lost-fleet-map-legend__copy {
  fill: #172e62;
  dominant-baseline: central;
}

.lost-fleet-map-legend__label {
  font-size: 0.38px;
  font-weight: 700;
  text-anchor: middle;
}

.lost-fleet-map-legend__copy {
  font-size: 0.42px;
  text-anchor: start;
}
</style>
