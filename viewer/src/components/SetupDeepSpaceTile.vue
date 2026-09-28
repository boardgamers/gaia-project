<template>
  <svg viewBox="-2.5 -2.5 5 5" width="68" height="68" role="img" :aria-label="description">
    <title>{{ description }}</title>
    <g :transform="`rotate(${rotation})`">
      <g v-for="(cell, i) in cells" :key="i" :transform="`translate(${cell.x}, ${cell.y})`">
        <polygon :points="outline" fill="#19335d" :stroke="i === 0 ? '#f44' : '#8191a8'" stroke-width="0.06" />
        <circle
          v-if="cell.planet !== empty"
          r="0.48"
          :class="['planet-fill', cell.planet]"
          stroke="black"
          stroke-width="0.03"
        />
      </g>
    </g>
  </svg>
</template>

<script lang="ts">
import { Planet } from "@gaia-project/engine";
import { findDeepSpaceNotches, lostFleetSectorCenters } from "@gaia-project/engine/src/lost-fleet-map";
import { deepSpaceSetupFace } from "@gaia-project/engine/src/lost-fleet-setup";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { planetNames } from "../data/planets";
import { corners, hexCenter } from "../graphics/hex";

@Component
export default class SetupDeepSpaceTile extends Vue {
  @Prop() choice: string;
  @Prop() position: number;
  readonly empty = Planet.Empty;
  readonly outline = corners()
    .map(({ x, y }) => `${x},${y}`)
    .join(" ");

  get rotation() {
    return this.$store.state.data.players.length === 3 ? 0 : 60;
  }

  get cells() {
    const notch = findDeepSpaceNotches(lostFleetSectorCenters(this.$store.state.data.players.length))[
      this.position - 1
    ];
    const points = notch.map((cell) => hexCenter(cell));
    const cx = points.reduce((sum, point) => sum + point.x, 0) / 3;
    const cy = points.reduce((sum, point) => sum + point.y, 0) / 3;
    const face = deepSpaceSetupFace(this.choice);
    return points.map((point, i) => ({ x: point.x - cx, y: point.y - cy, planet: face[i] }));
  }

  get description() {
    return deepSpaceSetupFace(this.choice)
      .map((planet) => planetNames[planet] ?? "Empty space")
      .join(", ");
  }
}
</script>
