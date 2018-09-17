<template>
  <g>
    <circle :r="radius" :class='["planet-fill", planet ]' style="pointer-events: none;" />
    <circle :r="radius" :class='["planet-fill", "faction-fill", fill ]' v-if="faction" style="pointer-events: none;" />
    <circle :r='radius' :class='["planet", planet]' />
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import planets from "../data/planets";
import { Component, Prop } from 'vue-property-decorator';
import { Planet as PlanetEnum, factions, Faction } from '@gaia-project/engine';

@Component
export default class Planet extends Vue {
  @Prop()
  planet: PlanetEnum;
  @Prop()
  faction: Faction;

  get radius() {
    return planets[this.planet].radius;
  }

  get fill() {
    // Comment for planet staying planets!
    if (this.faction) {
      return factions.planet(this.faction);
    }
    return this.planet;
  }
}

</script>

<style lang="scss">

svg {
  .planet {
    stroke-width: 0.04;
    fill: none;
    pointer-events: none;
    
    // terra
    &.r {stroke: #39f}
    // desert
    &.d {stroke: #c1a925}
    // swamp
    &.s {stroke: #874d12}
    // oxide
    &.o {stroke: #ff0000}
    // titanium
    &.t {stroke: #d1d1e0}
    // ice
    &.i {stroke: #00c2c2}
    // volcanic
    &.v {stroke: #ff8566}
    // gaia
    &.g {stroke: #004d1a}
    // transdim
    &.m {stroke: #a64dff}
  }

  .planet-fill {
    .no-faction-fill &.faction-fill {
      display: none;
    }
    
    // terra
    &.r {fill: #2080f0 }
    // desert
    &.d {fill: #F2FF00}
    // swamp
    &.s {fill: #523A00}
    // oxide
    &.o {fill: #FF160A}
    // titanium
    &.t {fill: #808080}
    // ice
    &.i {fill: #F8FFF5}
    // volcanic
    &.v {fill: #ffa135}
    // gaia
    &.g {fill: #093}
    // transdim
    &.m {fill: #a64dff}
  }

  // Used in federation display on the map
  .planet-stroke {
     // terra
    &.r {fill: #2080f0 }
    // desert
    &.d {fill: #F2FF00}
    // swamp
    &.s {fill: #523A00}
    // oxide
    &.o {fill: #FF160A}
    // titanium
    &.t {fill: #808080}
    // ice
    &.i {fill: #F8FFF5}
    // volcanic
    &.v {fill: #ffa135}
    // gaia
    &.g {fill: #093}
    // transdim
    &.m {fill: #a64dff}
  }
}

</style>