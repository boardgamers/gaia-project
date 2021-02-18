<template>
  <g>
    <circle cx="0" cy="0" r="20" :class="['player-token', 'planet-fill', planetClass]" />
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { factions, Faction, Planet } from '@gaia-project/engine';
import { planetClass } from '../graphics/utils';

@Component
export default class PlayerToken extends Vue {
  @Prop()
  faction: Faction | 'automa';

  get planetClass () {
    return planetClass(this.faction);
  }
}
</script>

<style lang="scss">

g .player-token {
  stroke: #111;
  pointer-events: none;
  stroke-width: 3;
}

</style>
