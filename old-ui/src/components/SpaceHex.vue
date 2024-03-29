<template>
  <g :id="`${hex}`">
    <title>
      Coordinates: {{ hex }}{{ hex.data.planet !== "e" ? `&#10;Planet: ${planetName(hex.data.planet)}` : ""
      }}{{ hex.data.building ? `&#10;Building: ${buildingName(hex.data.building)}` : ""
      }}{{ cost(hex) ? `&#10;Cost: ${cost(hex)}` : "" }}
    </title>
    <polygon
      :points="hexCorners.map((p) => `${p.x},${p.y}`).join(' ')"
      :class="[
        'spaceHex',
        {
          toSelect,
          highlighted: highlightedHexes.has(hex),
          qic: cost(hex).includes('q'),
          power: cost(hex).includes('pw'),
        },
      ]"
      @click="hexClick(hex)"
    />
    <text class="sector-name" v-if="isCenter">{{
      hex.data.sector[0] === "s" ? parseInt(hex.data.sector.slice(1)) : parseInt(hex.data.sector)
    }}</text>
    <Planet v-if="hex.data.planet !== 'e'" :planet="hex.data.planet" :faction="faction(hex.data.player)" />
    <Building v-if="hex.data.building" :building="hex.data.building" :faction="faction(hex.data.player)" />
    <Building
      v-if="hex.data.additionalMine !== undefined"
      :faction="faction(hex.data.additionalMine)"
      building="m"
      transform="translate(0.58, -0.2) rotate(36) scale(0.9)"
      class="additionalMine"
    />
    <Building
      v-for="(player, index) in tradeTokens"
      :key="`${player}-${index}-trade`"
      :faction="faction(player)"
      building="gf"
      :transform="`scale(0.6) translate(${tradeX(6 - index)}, ${tradeY(6 - index)})`"
    />
    <polygon
      v-for="(player, index) in hex.data.federations || []"
      :points="hexCorners.map((p) => `${p.x * (1 - (index + 0.5) / 8)},${p.y * (1 - (index + 0.5) / 8)}`).join(' ')"
      :class="['spaceHexFederation', 'planet', planet(player)]"
      :key="`${player}-${index}`"
    />
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import {
  GaiaHex,
  Building as BuildingEnum,
  Planet as PlanetEnum,
  SpaceMap as ISpaceMap,
  factionPlanet,
} from "@gaia-project/engine";
import { corners } from "../graphics/hex";
import Planet from "./Planet.vue";
import Building from "./Building.vue";
import { buildingName } from "../data/building";
import { planetNames } from "../data/planets";

@Component<SpaceHex>({
  components: {
    Planet,
    Building,
  },
})
export default class SpaceHex extends Vue {
  @Prop()
  hex: GaiaHex;

  @Prop()
  isCenter: boolean;

  get hexCorners() {
    return corners();
  }

  get map(): ISpaceMap {
    return this.$store.state.data.map;
  }

  cost(hex: GaiaHex) {
    const data = this.highlightedHexes.get(hex);

    return data && data.cost && data.cost !== "~" ? data.cost.replace(/,/g, ", ") : "";
  }

  hexClick(hex: GaiaHex) {
    if (this.highlightedHexes.has(hex) || this.toSelect) {
      this.$store.dispatch("hexClick", hex);
    }
  }

  faction(player) {
    if (player === undefined || player === "wild") {
      return player; // Wild will get recognized as purple, for trade tokens. A bit of a hack
    }
    return this.$store.state.data.players[player].faction;
  }

  planet(player) {
    return factionPlanet(this.faction(player));
  }

  buildingName(building: BuildingEnum) {
    return buildingName(building);
  }

  planetName(planet: PlanetEnum) {
    return planetNames[planet];
  }

  get highlightedHexes(): Map<GaiaHex, any> {
    return this.$store.state.context.highlighted.hexes;
  }

  get toSelect() {
    return !!this.$store.state.context.hexSelection;
  }

  shipX(index) {
    return SpaceHex.shipXs[index % 7];
  }

  shipY(index) {
    return SpaceHex.shipYs[index % 7];
  }

  tradeX(index) {
    return SpaceHex.tradeXs[index];
  }

  tradeY(index) {
    return SpaceHex.tradeYs[index];
  }

  static shipXs = [-0.5, 0.5, -1.3, 1.3, -0.5, 0.5, 0];
  static shipYs = [-1.3, -1.3, 0, 0, 1.3, 1.3, 0];

  static tradeXs = [-0.5, 0.5, -0.9, 0, 0.9, -0.5, 0.5];
  static tradeYs = [-0.9, -0.9, 0, 0, 0, 0.9, 0.9];
}
</script>

<style lang="scss">
svg {
  .spaceHex {
    fill: #172e62;
    stroke: #666;
    stroke-width: 0.01;

    &:hover {
      fill-opacity: 0.5;
    }

    &.highlighted {
      fill: white;
      cursor: pointer;

      &.qic {
        fill: lightGreen;
      }

      &.power {
        fill: #d378d3;
      }
    }

    &.toSelect {
      cursor: pointer;
      opacity: 0.7;
    }
  }

  .spaceHexFederation {
    stroke-width: 0.1;
    fill: none;
    pointer-events: none;
  }

  .sector-name {
    text-anchor: middle;
    dominant-baseline: central;
    font-size: 1px;
    fill: white;
    opacity: 0.35;
    pointer-events: none;
  }
}
</style>
