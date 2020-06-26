<template>
  <g :class='["building"]'>
    <component :is="buildingComponent" :faction=faction :filter="outline ? 'url(#shadow-5)' : ''" v-if="!flat" />
    <g :class='["planet-fill", planet]' v-else >
      <rect v-if="mine" x="-20" y="-20" width="40" height="40" />
      <rect v-else-if="planetaryInstitute" x="-37.5" y="-37.5" width="75" height="75" />
      <polygon v-else-if="gaiaFormer" :points='hexCorners' />
      <circle v-else-if="lab" r="30" />
      <circle v-else-if="academy" r="50" />
      <polygon v-else-if="tradingStation" points="-20,-20 0,-38 20,-20 20,20 -20,20" transform="translate(0, 0.08)"/>
      <Token v-else-if="spaceStation" :faction="faction" :scale="30" />
    </g>
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { Faction, Building as BuildingEnum, Planet, factions } from '@gaia-project/engine';
import Academy from './Buildings/Academy.vue';
import GaiaFormer from './Buildings/GaiaFormer.vue';
import Mine from './Buildings/Mine.vue';
import PlanetaryInstitute from './Buildings/PlanetaryInstitute.vue';
import ResearchLab from './Buildings/ResearchLab.vue';
import SpaceStation from './Buildings/SpaceStation.vue';
import TradingStation from './Buildings/TradingStation.vue';
import { corners } from '../graphics/hex';

const components = {
  [BuildingEnum.Mine]: "Mine",
  [BuildingEnum.TradingStation]: "TradingStation",
  [BuildingEnum.GaiaFormer]: "GaiaFormer",
  [BuildingEnum.SpaceStation]: "SpaceStation",
  [BuildingEnum.Academy1]: "Academy",
  [BuildingEnum.Academy2]: "Academy",
  [BuildingEnum.PlanetaryInstitute]: "PlanetaryInstitute",
  [BuildingEnum.ResearchLab]: "ResearchLab"
};

@Component({
  components: {
    Academy,
    GaiaFormer,
    Mine,
    PlanetaryInstitute,
    ResearchLab,
    SpaceStation,
    TradingStation
  }
})
export default class Building extends Vue {
  @Prop()
  faction: Faction;

  @Prop({ default: false, type: Boolean })
  flat: boolean;

  @Prop()
  building: BuildingEnum;

  @Prop({ default: false, type: Boolean })
  outline: boolean;

  get buildingComponent () {
    return components[this.building];
  }

  // FLAT buildings
  get planet () {
    return (this.faction as any === "wild") ? Planet.Transdim : factions.planet(this.faction);
  }

  get hexCorners () {
    return corners().map(({ x, y }) => `${x * 40},${y * 40}`).join(" ");
  }

  get triangleCorners () {
    return [{ x: -0.5, y: Math.sqrt(3) / 4 }, { x: 0.5, y: Math.sqrt(3) / 4 }, { x: 0, y: -Math.sqrt(3) / 4 }].map(({ x, y }) => `${x * 0.5},${y * 0.5}`).join(" ");
  }

  get mine () { return this.building === BuildingEnum.Mine; }
  get tradingStation () { return this.building === BuildingEnum.TradingStation; }
  get planetaryInstitute () { return this.building === BuildingEnum.PlanetaryInstitute; }
  get lab () { return this.building === BuildingEnum.ResearchLab; }
  get academy () { return this.building === BuildingEnum.Academy1 || this.building === BuildingEnum.Academy2; }
  get gaiaFormer () { return this.building === BuildingEnum.GaiaFormer; }
  get spaceStation () { return this.building === BuildingEnum.SpaceStation; }
}

</script>

<style lang="scss">

svg {
  .building {
    stroke-width: 10;
    pointer-events: none;
    stroke: #111;

    & > * {
      transform: scale(0.1);
    }
  }

  .additionalMine {
    stroke-width: 5;
  }
}

</style>
