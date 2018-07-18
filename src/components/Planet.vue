<template>
  <circle :r='radius' :class='["planet", "planet-fill", planet]' />
</template>

<script lang="ts">
import Vue from 'vue';
import planets from "../data/planets";
import { Component, Prop } from 'vue-property-decorator';
import { Planet as PlanetEnum } from '@gaia-project/engine';

@Component
export default class Planet extends Vue {
  @Prop()
  planet: PlanetEnum;

  get radius() {
    return planets[this.planet].radius;
  }
}

</script>

<style lang="scss">

svg {
  .planet {
    stroke-width: 0.04;
    pointer-events: none;

    // terra
    &.r {stroke: #39f}
    // desert
    &.d {stroke: #c1a925}
    // swamp
    &.s {stroke: #874d12}
    // oxide
    &.o {stroke: #ff8566}
    // titanium
    &.t {stroke: #d1d1e0}
    // ice
    &.i {stroke: #00c2c2}
    // volcanic
    &.v {stroke: #ff0000}
    // gaia
    &.g {stroke: #004d1a}
    // transdim
    &.m {stroke: #a64dff}
  }

  .planet-fill {
    // terra
    &.r {fill: #99ccff}
    // desert
    &.d {fill: #ffd700}
    // swamp
    &.s {fill: #a25b15}
    // oxide
    &.o {fill: #f30}
    // titanium
    &.t {fill: #3d3d5c}
    // ice
    &.i {fill: #cff}
    // volcanic
    &.v {fill: #f90}
    // gaia
    &.g {fill: #093}
    // transdim
    &.m {fill: #a64dff}
  }
}

</style>