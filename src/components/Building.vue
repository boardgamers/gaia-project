<template>
  <g :class='["building", "planet-fill", planet]'>
    <rect v-if="mine" x="-0.2" y="-0.2" width="0.4" height="0.4" />
    <rect v-else-if="planetaryInstitute" x="-0.375" y="-0.375" width="0.75" height="0.75" />
    <polygon v-else-if="gaiaFormer" :points='hexCorners' />
    <circle v-else-if="lab" r="0.3" />
    <circle v-else-if="academy" r="0.5" />
    <polygon v-else-if="tradingStation" points="-0.2,-0.2 0,-0.38 0.2,-0.2 0.2,0.2 -0.2,0.2" transform="translate(0, 0.08)"/>
    <Token v-else-if="spaceStation" :faction="faction" :scale="0.3" />
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { factions, Faction, Building as BuildingEnum } from '@gaia-project/engine';
import { corners } from '../graphics/hex';
import Token from './Token.vue';

@Component({
  components: {
    Token
  }
})
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

  get triangleCorners() {
    return [{x: -0.5, y: Math.sqrt(3)/4}, {x: 0.5, y: Math.sqrt(3)/4}, {x: 0, y: -Math.sqrt(3)/4}].map(({x, y}) => `${x*0.5},${y*0.5}`).join(" ");
  }

  get mine() { return this.building === BuildingEnum.Mine }
  get tradingStation() {return this.building === BuildingEnum.TradingStation }
  get planetaryInstitute() {return this.building === BuildingEnum.PlanetaryInstitute}
  get lab() {return this.building === BuildingEnum.ResearchLab}
  get academy() {return this.building === BuildingEnum.Academy1 || this.building === BuildingEnum.Academy2}
  get gaiaFormer() {return this.building === BuildingEnum.GaiaFormer}
  get spaceStation() { return this.building === BuildingEnum.SpaceStation }
}

</script>

<style lang="scss">

svg {
  .building {
    stroke-width: 0.1;
    pointer-events: none;
    stroke: #111;

    // titanium
    &.t {fill: #3d3d5c; stroke: #d1d1e0}
  }

  .additionalMine {
    stroke-width: 0.05;
  }
}

</style>