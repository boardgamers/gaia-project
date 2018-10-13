<template>
  <path :class='["ship", "planet-fill", planet]' d="m-7,0 v7 h14 v-7 a7,10 0 1,0 -14,0" :transform="`scale(${scale / 14})`" />
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

  get planet(): Planet {
    return this.faction === 'automa' ? Planet.Lost : factions.planet(this.faction);
  }
}
</script>
