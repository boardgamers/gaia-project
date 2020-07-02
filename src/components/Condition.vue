<template>
  <g class="condition">
    <Building v-if="isBuilding" outline-white :building="condition" :flat="flat" transform="translate(0, 0) scale(2.2)" />
    <g v-else-if="condition === 'fed'" transform="scale(0.45)">
      <Federation width=50 x=-20 y=-30 :used=true filter="url(#white-shadow-1)" />
    </g>
    <PlanetType v-else-if="condition === 'pt'"  transform=scale(1.1) />
    <Sector v-else-if="condition === 's'" transform=scale(1.5) />
    <g v-else-if="condition === 'g'"  transform=scale(0.85) >
      <image xlink:href="../assets/conditions/planet.svg" width=25 x=-12 y=-11.5 transform="scale(-1,1)" />
    </g>
    <Resource v-else-if="condition === 'step'" kind="step" />
    <g v-else-if="condition === 'mg'" >
      <image v-if="!flat" xlink:href="../assets/conditions/planet-flat.svg" width=30 x=-12 y=-13.5 transform="translate(-2,0) scale(-1,-1)" />
      <circle v-else r="10" :class='["planet-fill", "g" ]' transform="translate(0,0)" />
      <Building building="m" outline-white :flat="flat" :transform="`translate(${flat ? 0  : 0}, ${flat ? 0  : 0}) scale(2.2)`" />
    </g>
    <g v-else-if="condition === 'PA'">
      <Building building="PI" outline-white :flat="flat" :transform="`translate(${flat ? -5  : -2}, 1) scale(1.8)`" />
      <Building building="ac1" outline-white :flat="flat" :transform="`translate(5, ${flat ? 1 : 2}) scale(1.8)`" />
    </g>
    <g v-else-if="condition === 'a'">
      <line x1="-15" x2="15" stroke ="#666" />
      <line x1="-15" x2="15" y1=-10 y2=-10 stroke ="#666" />
      <line x1="-15" x2="15" y1=10 y2=10 stroke ="#666" />
      <image xlink:href="../assets/operators/trigger.svg" width=15 :transform="`rotate(180), translate(6, -8), scale(0.7)`" />
      <!-- <text y=-1 style="font-size: 9px">3</text>
      <text y=8.5 style="font-size: 9px">2</text>-->
    </g>
  </g>
</template>
<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import { Condition as ConditionEnum, Building as BuildingEnum } from "@gaia-project/engine";
import Building from './Building.vue';
import Federation from './FederationTile.vue';
import Planet from './Planet.vue';
import PlanetType from './Conditions/PlanetType.vue';
import Resource from './Resource.vue';
import Sector from './Conditions/Sector.vue';

@Component({
  components: {
    Building,
    Federation,
    Planet,
    PlanetType,
    Resource,
    Sector
  }
})
export default class Condition extends Vue {
  @Prop()
  condition!: ConditionEnum;

  get isBuilding () {
    return Object.values(BuildingEnum).includes(this.condition as any);
  }

  get flat () {
      return this.$store.state.gaiaViewer.preferences.flatBuildings;
  }
}

</script>
<style lang="scss">
@import '../stylesheets/planets.scss';

g {
  &.condition {

    &.gaia {
      fill: $gaia;
    }
  }

}


</style>
