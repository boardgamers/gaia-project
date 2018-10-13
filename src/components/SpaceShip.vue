<template>
  <g :transform="`scale(${scale}), translate(${x}, ${y})`">
   <path :class='["space-ship", "planet-fill", planet, {animated}]' :d="`m-0.5,0 v0.5 h1 v-0.5 a0.5,0.75 0 1,0 -1,0 z`"/>
  </g>
</template>
<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { factions, Faction, Planet } from '@gaia-project/engine';

/** Code similar to Token. See if it can be refactored / inherited */
@Component
export default class Ship extends Vue {
  @Prop({default: 'automa'})
  faction: Faction | 'automa';
  @Prop({default: 1})
  scale: number;
  @Prop({default: 0})
  x: number;
  @Prop({default: 0})
  y: number;

  get animated() {
    return this.scale < 1;
  }

  get planet(): Planet {
    return this.faction === 'automa' ? Planet.Lost : factions.planet(this.faction);
  }
}
</script>

<style lang="scss">
  .space-ship {
    stroke-width: 0.05px;
    pointer-events: none;
    stroke: #111;

    &.animated {
      stroke-width: 0.12px;
      animation: spaceship 2s linear infinite;
    }
  }

  @keyframes spaceship {
    0%   {transform: scale(1)}
    50%  {transform: scale(0.8)}
    100%   {transform: scale(1);}
  }

</style>

