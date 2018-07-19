<template>
  <g>
    <circle cx="0" cy="0" r="1" :transform="`scale(${scale})`" :class="['player-token', 'planet-fill', planet]" />
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { factions, Faction, Planet } from '@gaia-project/engine';

@Component
export default class PlayerToken extends Vue {
  @Prop()
  faction: Faction;
  @Prop()
  scale: number;

  get planet(): Planet {
    return factions.planet(this.faction);
  }
}
</script>

<style lang="scss">

g .player-token {
  stroke: #444;
  pointer-events: none;
  stroke-width: 0.2;
}

</style>
