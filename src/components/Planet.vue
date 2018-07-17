<template>
  <circle :r='radius' :class='["planet", planet]' />
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
    &.r {fill: #99ccff; stroke: #39f}
    // desert
    &.d {fill: #ffd700; stroke: #c1a925}
    // swamp
    &.s {fill: #a25b15; stroke: #874d12}
    // oxide
    &.o {fill: #f30; stroke: #ff8566}
    // titanium
    &.t {fill: #3d3d5c; stroke: #d1d1e0}
    // ice
    &.i {fill: #cff; stroke: #00c2c2}
    // volcanic
    &.v {fill: #f90; stroke: #ff0000}
    // gaia
    &.g {fill: #093; stroke: #004d1a}
    // transdim
    &.m {fill: #a64dff; stroke: #a64dff}
  }
}

</style>