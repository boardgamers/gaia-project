<template>
  <svg :viewBox="viewBox">
    <definitions />
    <g :transform="`rotate(${mapRotationDeg})`">
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
    </g>
    <FactionWheel
      class="faction-wheel"
      :transform="`translate(${bounds.left + 3.1}, ${bounds.top + 2.9}) scale(0.65)`"
    />
    <image v-if="showCharts" xlink:href="../assets/other/line-chart.svg" :height=155/211*22 width="22" x="-11" y="-8"
    v-b-modal.chart-button role="button" :transform="`translate(${bounds.right - 1.9}, ${bounds.top + 1.4}) scale(0.1)`"
    />
    <rect
      v-for="(planet, i) in terraformingColors"
      :key="planet"
      :class="['lost-fleet-terraform-swatch', 'planet-fill', planet]"
      width="0.9"
      height="0.9"
      :x="bounds.right - 7.5 + i * 1.05"
      :y="bounds.top + 0.3"
      v-b-tooltip
      :title="`Terraforming board color ${i + 1}`"
    />
    <g
      v-for="(color, i) in colorLegend"
      :key="i"
      :transform="`translate(${bounds.left + 0.6}, ${bounds.top + 7 + 2 * i}) scale(.8)`"
    >
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
  Planet,
  SpaceMap as SpaceMapData,
} from "@gaia-project/engine";
import { lostFleetTerraformingBoard } from "@gaia-project/engine/src/factions";
import { hexCenter } from "../graphics/hex";
import { gameSeed } from "../logic/utils";
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

  /** The Tinkeroids/Moweyds shared terraforming-color row (RULES_CLARIFICATIONS.md §B5), shown as
   * 7 plain squares in the map's top-right corner - same colors as LostFleetTerraformingBoard.vue's
   * "shared row", just without any of that component's text/cards for a quick at-a-glance read. */
  get terraformingColors(): Planet[] {
    if (!this.isLostFleet) {
      return [];
    }
    const seed = gameSeed(this.engine);
    return seed ? lostFleetTerraformingBoard(seed) : [];
  }

  /**
   * Whole-board rotation (hex-grid-aligned, i.e. a multiple of 60deg so every hex/sector still
   * looks "upright" like a physically-rotated tile - same visual language as the existing
   * per-sector rotation), chosen per player count to minimize the rendered width, since on a
   * narrow phone viewport a narrower viewBox renders at a larger scale. Measured once against the
   * fixed (seed-independent) Lost Fleet sector-center layout for each player count: 2p and 4p are
   * already narrowest at 0deg; 3p is ~17% narrower at 120deg (27 -> 22.5 units).
   */
  get mapRotationDeg(): number {
    if (this.isLostFleet && this.engine.players.length === 3) {
      return 120;
    }
    return 0;
  }

  /**
   * Bounding box of every hex on the board (in rendered units, i.e. hexCenter * 1.01 like the
   * template's transforms, rotated by mapRotationDeg to match what's actually rendered), padded by
   * one hex radius, plus a reserved left sidebar where the faction wheel / legends live so they
   * never cover hexes. Replaces the old hardcoded viewBox, which clipped the taller Lost Fleet
   * 3p/4p layouts.
   */
  get bounds(): { left: number; top: number; right: number; bottom: number } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const rad = (this.mapRotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    for (const hex of this.map.grid.values()) {
      const c = hexCenter(hex);
      const x = (c.x * cos - c.y * sin) * 1.01;
      const y = (c.x * sin + c.y * cos) * 1.01;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    if (minX > maxX) {
      // no hexes (e.g. map not generated yet) - keep the old base-game frame
      return { left: -13, top: -11.5, right: 13, bottom: 12.5 };
    }
    const hexPad = 1.3;
    // Was 6 when a Lost Fleet legend box also lived in this sidebar (removed). The faction wheel
    // (translate(...) + 2.6 half-width at its scale(0.65)) is now the binding constraint on this
    // reserved width, not the old legend - 5.6 is the smallest value that still clears it with
    // margin (see SpaceMap.spec.ts's "keeps the wheel ... in the left sidebar" test).
    const sidebar = 5.6;
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
    if (this.mapModes.find((m) => m.type === MapModeType.leech || m.type == MapModeType.federations)) {
      return [...Array(5).keys()].map((i) => ({ class: `power${i + 1}`, text: String(i + 1) }));
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
</style>
