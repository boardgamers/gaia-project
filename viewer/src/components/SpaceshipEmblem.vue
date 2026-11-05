<template>
  <g class="spaceship-emblem" :data-emblem="ship" role="img" :aria-label="label" pointer-events="none">
    <title>{{ label }}</title>
    <circle r="10" :fill="background" stroke="#eee7d3" stroke-width="0.6" />
    <!-- Vector interpretations of the printed insignia, not spacecraft silhouettes.
         The rulebook and supplied tabletop-photo references are documented alongside. -->
    <g v-if="ship === ships.Twilight" fill="none" stroke="#fff9ff" stroke-linecap="round">
      <path
        d="M -7,5 C -9,-1 -5,-8 1,-8 C 7,-8 9,-2 7,3 C 5,8 -1,8 -4,4 C -7,0 -3,-5 1,-5 C 5,-5 7,-1 5,2 C 3,5 -1,5 -2,2 C -4,-1 -1,-3 1,-2 C 3,-1 2,2 0,1"
        stroke-width="1.25"
      />
      <path
        d="M -7,5 L -4,2 M -8,1 L -5,0 M -7,-3 L -4,-2 M -4,-6 L -2,-4 M 0,-8 L 1,-5 M 4,-7 L 3,-4 M 7,-4 L 5,-2 M 8,0 L 6,0 M 6,5 L 4,3 M 2,7 L 1,4 M -2,6 L -1,3"
        stroke-width="0.75"
      />
    </g>
    <g v-else-if="ship === ships.Eclipse" fill="#493619" transform="rotate(-35)">
      <circle r="4.6" />
      <ellipse rx="8" ry="2.8" fill="none" stroke="#493619" stroke-width="1.35" />
      <path d="M -7,0 Q 0,3.5 7,0" fill="none" :stroke="background" stroke-width="0.9" />
    </g>
    <g v-else-if="ship === ships.TFMars" fill="#294947">
      <path d="M -7,5 C -6,-1 -1,-4 7,-7 C 3,-2 0,1 -7,5 Z" />
      <path d="M -5,7 C -4,3 0,1 6,-2 C 3,3 0,6 -5,7 Z" />
    </g>
    <!-- Rebellion's tapered outer prongs and divided inner crest, from the supplied close-up. -->
    <g v-else-if="ship === ships.Rebellion" fill="#302c2a">
      <path
        d="M -3.1,-8.5 Q -4.4,-8.1 -4.8,-6.5 L -6,4.7 L -3,7.4 L 0,8.4 L 3,7.4 L 6,4.7 L 4.8,-6.5 Q 4.4,-8.1 3.1,-8.5 L 3.6,-3.9 L 4.2,3.6 L 2,5.8 L 0,6.5 L -2,5.8 L -4.2,3.6 L -3.6,-3.9 Z"
      />
      <path d="M -2.4,-4.6 L -3.2,-0.8 L -1.8,0.7 H 1.8 L 3.2,-0.8 L 2.4,-4.6 L 1.4,-2.5 L 0,-1.6 L -1.4,-2.5 Z" />
      <path d="M -3.4,0.3 L -1.8,1.8 H 1.8 L 3.4,0.3 L 3.6,3.4 L 1.6,5 H -1.6 L -3.6,3.4 Z" />
      <path d="M 0,6.3 V 8.5" fill="none" :stroke="background" stroke-width="0.6" />
    </g>
  </g>
</template>

<script lang="ts">
import { Spaceship } from "@gaia-project/engine";
import { Component, Prop, Vue } from "vue-property-decorator";
import { spaceshipLabels, spaceshipNames } from "../data/spaceships";

@Component
export default class SpaceshipEmblem extends Vue {
  @Prop({ required: true }) ship: Spaceship;
  ships = Spaceship;

  get label(): string {
    return `${spaceshipNames[this.ship]} — ${spaceshipLabels[this.ship]}`;
  }

  get background(): string {
    return {
      [Spaceship.Twilight]: "#723875",
      [Spaceship.Eclipse]: "#dfbd58",
      [Spaceship.TFMars]: "#cedbd8",
      [Spaceship.Rebellion]: "#d8d1c5",
    }[this.ship];
  }
}
</script>
