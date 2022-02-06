<template>
  <g v-if="isShip" class="ship">
    <circle v-if="shipMoved" r="7" />
    <Planet :planet="planetClass" transform="scale(7)" :classes="['ship']" />
    <text transform="translate(-2, -.7) scale(5)" :class="`board-text ${planetClass}`" style="font-weight: bolder">{{
      shipLetter
    }}</text>
  </g>
  <g v-else-if="customsPost" class="ship">
    <Planet :planet="planetClass" transform="scale(7)" />
    <text transform="translate(-2, -.7) scale(5)" :class="`board-text ${planetClass}`" style="font-weight: bolder"
      >C</text
    >
  </g>
  <g v-else :class="['building']">
    <g :class="['planet-fill', planetClass]" v-if="flat">
      <rect v-if="mine" x="-20" y="-20" width="40" height="40" />
      <rect v-else-if="planetaryInstitute" x="-37.5" y="-37.5" width="75" height="75" />
      <polygon v-else-if="gaiaFormer" :points="hexCorners" />
      <circle v-else-if="lab" r="30" />
      <circle v-else-if="academy" r="50" />
      <polygon v-else-if="tradingStation" points="-20,-20 0,-38 20,-20 20,20 -20,20" transform="translate(0, 0.08)" />
      <polygon v-else-if="colony" points="-35,30 0,-40 35,30" transform="translate(0, 0.08)" />
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
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Building as BuildingEnum, Expansion, Faction, isShip } from "@gaia-project/engine";
import { corners } from "../graphics/hex";
import { planetClass } from "../graphics/utils";
import Planet from "./Planet.vue";
import { shipLetter } from "../data/building";
import { isAcademy } from "@gaia-project/engine/src/enums";

@Component<Building>({
  components: {
    Planet,
  },
})
export default class Building extends Vue {
  @Prop()
  faction: Faction;

  @Prop({ default: false, type: Boolean })
  flat: boolean;

  @Prop()
  shipMoved: boolean;

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

  get triangleCorners() {
    return [
      { x: -0.5, y: Math.sqrt(3) / 4 },
      { x: 0.5, y: Math.sqrt(3) / 4 },
      { x: 0, y: -Math.sqrt(3) / 4 },
    ]
      .map(({ x, y }) => `${x * 0.5},${y * 0.5}`)
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

  get colony() {
    return this.building === BuildingEnum.Colony;
  }

  get spaceStation() {
    return this.building === BuildingEnum.SpaceStation;
  }

  get customsPost() {
    return this.building === BuildingEnum.CustomsPost;
  }

  get isShip() {
    return isShip(this.building);
  }

  get shipLetter() {
    return shipLetter(this.building);
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
