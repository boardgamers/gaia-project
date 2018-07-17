<template>
  <g :class='["building", planet]'>
    <rect v-if="mine" x="-0.2" y="-0.2" width="0.4" height="0.4" />
    <rect v-else-if="planetaryInstitute" x="-0.4" y="-0.4" width="0.8" height="0.8" />
    <polygon v-else-if="gaiaFormer" :points='hexCorners' />
    <circle v-else-if="lab" r="0.3" />
    <circle v-else-if="academy" r="0.5" />
    <polygon v-else-if="tradingStation" points="-0.5,0.433 0.5,0.433 0,-0.433"/>
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { factions, Faction, Building as BuildingEnum } from '@gaia-project/engine';
import { corners } from '@/graphics/hex';

@Component
export default class Building extends Vue {
  @Prop()
  faction: Faction;

  @Prop()
  building: BuildingEnum;

  get planet() {
    return factions.planet(this.faction);
  }

  get hexCorners() {
    return corners().map(({x, y}) => `${x*0.4},${y*0.4}`).join(" ");
  }

  get mine() { return this.building === BuildingEnum.Mine }
  get tradingStation() {return this.building === BuildingEnum.TradingStation }
  get planetaryInstitute() {return this.building === BuildingEnum.PlanetaryInstitute}
  get lab() {return this.building === BuildingEnum.ResearchLab}
  get academy() {return this.building === BuildingEnum.Academy1 || this.building === BuildingEnum.Academy2}
  get gaiaFormer() {return this.building === BuildingEnum.GaiaFormer}
}

</script>

<style lang="scss">

svg {
  .building {
    stroke-width: 0.1;
    pointer-events: none;
    stroke: #111;

    // terra
    &.r {fill: #99ccff}
    // desert
    &.d {fill: #ffd700}
    // swamp
    &.s {fill: #a25b15}
    // oxide
    &.o {fill: #f30}
    // titanium
    &.t {fill: #3d3d5c; stroke: #d1d1e0}
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