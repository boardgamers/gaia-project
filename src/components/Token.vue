<template>
  <circle :cx="x" :cy="y" r="5" :class="['player-token', 'planet-fill', planet]" />
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
  x: number;
  @Prop()
  y: number;

  get planet(): Planet {
    return factions.planet(this.faction);
  }
}
</script>

<style lang="scss">

g .player-token {
  stroke: #444;
  stroke-width: 1;
  pointer-events: none;
}

</style>
