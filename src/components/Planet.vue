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

  get radius () {
    return planets[this.planet].radius;
  }

  get fill () {
    // Comment for planet staying planets!
    if (this.faction) {
      return factions.planet(this.faction);
    }
    return this.planet;
  }
}

</script>

<style lang="scss">

@import '../stylesheets/planets.scss';

svg {
  .planet {
    stroke-width: 0.04;
    fill: none;
    pointer-events: none;

    // terra
    &.r {stroke: $terra }
    // desert
    &.d {stroke: $desert}
    // swamp
    &.s {stroke: $swamp}
    // oxide
    &.o {stroke: $oxide}
    // titanium
    &.t {stroke: $titanium}
    // ice
    &.i {stroke: $ice}
    // volcanic
    &.v {stroke: $volcanic}
    .accessible-space-map &.v {stroke-dasharray:.25; stroke-width: .1;}
    // gaia
    &.g {stroke: $gaia }
    .accessible-space-map &.g {stroke-dasharray:.14; stroke-width: .1;}
    // transdim
    &.m {stroke: $transdim}
    .accessible-space-map &.m {stroke-dasharray:.14; stroke-width: .1;}
    // lost planet
    &.l {stroke: $lost}
  }

  .planet-fill, .planet-stroke {
    .no-faction-fill &.faction-fill {
      display: none;
    }
    // terra
    &.r {fill: $terra }
    // desert
    &.d {fill: $desert}
    // swamp
    &.s {fill: $swamp}
    // oxide
    &.o {fill: $oxide}
    // titanium
    &.t {fill: $titanium}
    // ice
    &.i {fill: $ice}
    // volcanic
    &.v {fill: $volcanic}
    // gaia
    &.g {fill: $gaia}
    // transdim
    &.m {fill: $transdim}
    // lost planet
    &.l {fill: $lost}
    // generic planet
    &.gen {fill: $generic}
    //diggable planet
    &.dig {fill: $dig}
  }
}

</style>
