<template>
  <g class="condition">
    <Building
      v-if="isBuilding"
      outline-white
      :building="condition"
      :flat="flat"
      faction="gen"
      transform="translate(0, 0) scale(2.2)"
    />
    <g v-else-if="condition === 'fed'" transform="scale(0.45)">
      <Federation width="50" x="-20" y="-30" :used="true" filter="url(#white-shadow-1)" />
    </g>
    <PlanetType v-else-if="condition === 'pt' || condition === 'newplanet'" transform="scale(1.1)" />
    <Sector v-else-if="condition === 's'" transform="scale(1.5)" />
    <g v-else-if="condition === 'newsector'" class="newsector-combo">
      <g transform="translate(-8, 0) scale(0.75)">
        <Sector />
      </g>
      <text x="0" y="3" class="newsector-combo__slash">/</text>
      <g transform="translate(8, 0) scale(0.75)">
        <DeepSpaceSector :white="true" />
      </g>
    </g>
    <Resource v-else-if="condition === 'gf'" kind="gf" />
    <!-- white to match the base-game Sector icon's own coloring (used right above, and in the
         newsector combo below) - the map itself keeps the dark navy fill for realism, but tile/
         condition iconography (round scoring, adv tech tiles, ...) should read the same as Sector. -->
    <DeepSpaceSector v-else-if="condition === 'ds'" :white="true" transform="scale(1.3)" />
    <g v-else-if="condition === 'g'" transform="scale(0.85)">
      <image
        xlink:href="../assets/conditions/planet.svg"
        width="25"
        height="25"
        x="-12"
        y="-11.5"
        transform="scale(-1,1)"
      />
    </g>
    <Resource v-else-if="condition === 'step'" kind="step" />
    <Resource v-else-if="condition === 'tt'" kind="tech" />
    <circle v-else-if="condition === 'ast'" r="9" class="planet-fill a" style="stroke: black; stroke-width: 0.5" />
    <g v-else-if="condition === 'shipq'">
      <polygon
        points="-10,4 -4,10 4,10 10,4 10,-4 4,-10 -4,-10 -10,-4"
        transform="scale(1.1)"
        style="fill: none; stroke: black; stroke-width: 1"
      />
      <Resource kind="q" transform="scale(0.85)" />
    </g>
    <g v-else-if="condition === 'mg'">
      <image
        v-if="!flat"
        xlink:href="../assets/conditions/planet-flat.svg"
        :height="(120 / 198) * 30"
        width="30"
        x="-12"
        y="-13.5"
        transform="translate(-2,0) scale(-1,-1)"
      />
      <circle v-else r="10" :class="['planet-fill', 'g']" transform="translate(0,0)" />
      <Building
        building="m"
        outline-white
        :flat="flat"
        faction="gen"
        :transform="`translate(${flat ? 0 : 0}, ${flat ? 0 : 0}) scale(2.2)`"
      />
    </g>
    <g v-else-if="condition === 'PA'">
      <Building
        building="PI"
        outline-white
        :flat="flat"
        faction="gen"
        :transform="`translate(${flat ? -5 : -2}, 1) scale(1.8)`"
      />
      <Building
        building="ac1"
        outline-white
        :flat="flat"
        faction="gen"
        :transform="`translate(5, ${flat ? 1 : 2}) scale(1.8)`"
      />
    </g>
    <g v-else-if="condition === 'a'">
      <!-- when tied to one specific research track (color set), tint the whole track box, not just
           the segment lines, so it reads at a glance as "that track" rather than "some track". -->
      <rect v-if="color" x="-15" y="-12" width="30" height="24" :fill="color" opacity="0.35" />
      <line x1="-15" x2="15" :stroke="color || '#666'" />
      <line x1="-15" x2="15" y1="-10" y2="-10" :stroke="color || '#666'" />
      <line x1="-15" x2="15" y1="10" y2="10" :stroke="color || '#666'" />
      <image
        xlink:href="../assets/operators/trigger.svg"
        width="15"
        :height="(529 / 328) * 15"
        :transform="`rotate(180),
      translate(6, -8), scale(0.7)`"
      />
      <!-- <text y="-1" style="font-size: 9px">3</text>
      <text y="8.5" style="font-size: 9px">2</text>-->
    </g>
  </g>
</template>
<script lang="ts">
import { Building as BuildingEnum, Condition as ConditionEnum } from "@gaia-project/engine";
import { Component, Prop, Vue } from "vue-property-decorator";
import Building from "./Building.vue";
import DeepSpaceSector from "./Conditions/DeepSpaceSector.vue";
import PlanetType from "./Conditions/PlanetType.vue";
import Sector from "./Conditions/Sector.vue";
import Federation from "./FederationTile.vue";
import Planet from "./Planet.vue";
import Resource from "./Resource.vue";

@Component({
  components: {
    Building,
    DeepSpaceSector,
    Federation,
    Planet,
    PlanetType,
    Resource,
    Sector,
  },
})
export default class Condition extends Vue {
  @Prop()
  condition!: ConditionEnum;

  // Optional override for the "a" (AdvanceResearch/ResearchLevels) icon's track-segment lines, so
  // tiles tied to one specific research track can be told apart from track-agnostic ones.
  @Prop()
  color?: string;

  get isBuilding() {
    return Object.values(BuildingEnum).includes(this.condition as any);
  }

  get flat() {
    return this.$store.state.preferences.flatBuildings;
  }
}
</script>
<style lang="scss">
g {
  &.condition {
    pointer-events: none;
    &.gaia {
      fill: var(--gaia);
    }
  }

  .newsector-combo__slash {
    font-size: 9px;
    font-weight: bold;
    text-anchor: middle;
    fill: #333;
    stroke: white;
    stroke-width: 0.4px;
    pointer-events: none;
  }
}
</style>
