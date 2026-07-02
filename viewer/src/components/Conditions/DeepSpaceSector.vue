<template>
  <g class="deep-space-sector">
    <polygon
      v-for="(center, i) in centers"
      :key="i"
      :points="hexPoints"
      :transform="`translate(${center.x}, ${center.y})`"
    />
  </g>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import { corners } from "../../graphics/hex";

// A physical Lost Fleet Deep Space tile is a triangle of 3 mutually-adjacent hexes (not a 7-hex
// base-game sector), so this icon draws 3 real hex polygons instead of reusing the Sector icon.
const RADIUS = 5.5;
const V_SPACING = Math.sqrt(3) / 2;

@Component
export default class DeepSpaceSector extends Vue {
  get hexPoints() {
    return corners(RADIUS)
      .map((p) => `${p.x},${p.y}`)
      .join(" ");
  }

  get centers() {
    // 3 mutually-adjacent flat-top hex centers, translated to be centered on the origin.
    const raw = [
      { x: 0, y: 0 },
      { x: 1.5 * RADIUS, y: V_SPACING * RADIUS },
      { x: 0, y: 2 * V_SPACING * RADIUS },
    ];
    const cx = raw.reduce((sum, p) => sum + p.x, 0) / raw.length;
    const cy = raw.reduce((sum, p) => sum + p.y, 0) / raw.length;
    return raw.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  }
}
</script>

<style lang="scss">
g.deep-space-sector {
  polygon {
    fill: #111c3d;
    stroke: #7b88b6;
    stroke-width: 0.5;
  }
}
</style>
