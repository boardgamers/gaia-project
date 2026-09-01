<template>
  <g :class="['building']">
    <g :class="['planet-fill', planetClass]" v-if="flat">
      <rect v-if="mine" x="-20" y="-20" width="40" height="40" />
      <rect v-else-if="planetaryInstitute" x="-37.5" y="-37.5" width="75" height="75" />
      <polygon v-else-if="gaiaFormer" :points="hexCorners" />
      <circle v-else-if="lab" r="30" />
      <circle v-else-if="academy" r="50" />
      <polygon v-else-if="tradingStation" points="-20,-20 0,-38 20,-20 20,20 -20,20" transform="translate(0, 0.08)" />
      <circle v-else-if="spaceStation" r="20" />
    </g>
    <use
      :xlink:href="`#${buildingId}-${faction || ''}`"
      :filter="outline ? 'url(#shadow-5)' : outlineWhite ? 'url(#white-shadow-5)' : ''"
      v-else
    />
  </g>
</template>

<script lang="ts">
import { Building as BuildingEnum, Faction } from "@gaia-project/engine";
import { isAcademy } from "@gaia-project/engine/src/enums";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { corners } from "../graphics/hex";
import { planetClass } from "../graphics/utils";

@Component<Building>({})
export default class Building extends Vue {
  @Prop()
  faction: Faction;

  @Prop({ default: false, type: Boolean })
  flat: boolean;

  @Prop()
  building: BuildingEnum;

  @Prop({ default: false, type: Boolean })
  outline: boolean;

  @Prop({ default: false, type: Boolean })
  outlineWhite: boolean;

  get buildingId() {
    return isAcademy(this.building) ? "ac" : this.building;
  }

  // FLAT buildings
  get planetClass() {
    return planetClass(this.faction);
  }

  get hexCorners() {
    return corners()
      .map(({ x, y }) => `${x * 40},${y * 40}`)
      .join(" ");
  }

  get mine() {
    return this.building === BuildingEnum.Mine;
  }

  get tradingStation() {
    return this.building === BuildingEnum.TradingStation;
  }

  get planetaryInstitute() {
    return this.building === BuildingEnum.PlanetaryInstitute;
  }

  get lab() {
    return this.building === BuildingEnum.ResearchLab;
  }

  get academy() {
    return isAcademy(this.building);
  }

  get gaiaFormer() {
    return this.building === BuildingEnum.GaiaFormer;
  }

  get spaceStation() {
    return this.building === BuildingEnum.SpaceStation;
  }
}
</script>

<style lang="scss">
svg {
  .building {
    stroke-width: 3;
    pointer-events: none;
    stroke: #111;

    & > * {
      transform: scale(0.1);
    }
  }

  .additionalMine {
    stroke-width: 5;
  }

  .ship > circle {
    fill: white;
    pointer-events: none;
  }

  .ship text.i {
    fill: var(--ice);
  }
}
</style>
