<template>
  <g :id="`${hex.q}x${hex.r}`" :title="'Cost: ' + cost(hex)">
    <title>Coordinates: {{hex.q}}x{{hex.r}}&#10;Sector: {{hex.data.sector}}{{hex.data.planet !== 'e' ? `&#10;Planet: ${planetName(hex.data.planet)}`: ''}}{{hex.data.building ? `&#10;Building: ${buildingName(hex.data.building)}` : ''}}</title>
    <polygon :points="hexCorners.map(p => `${p.x},${p.y}`).join(' ')" :class="['spaceHex', {toSelect, highlighted: highlightedHexes.has(hex), qic: cost(hex).includes('q')}]" @click='hexClick(hex)' />
    <Planet v-if="hex.data.planet !== 'e'" :planet='hex.data.planet' :faction='faction(hex.data.player)' />
    <Building v-if="hex.data.building" :building='hex.data.building' :faction='faction(hex.data.player)' />
    <Building v-if="hex.data.additionalMine !== undefined" :faction='faction(hex.data.additionalMine)' building="m" transform="translate(0.38, 0.5) rotate(36) scale(0.9)" class="additionalMine" />
    <polygon v-for="(player, index) in hex.data.federations || []" :points="hexCorners.map(p => `${p.x*(1-(index+0.5)/8)},${p.y*(1-(index+0.5)/8)}`).join(' ')" :class="['spaceHexFederation', 'planet', planet(player)]" :key="player" />
    <b-tooltip v-if="cost(hex)" :target='`${hex.q}x${hex.r}`' :html='true' />
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import {MapData, HighlightHexData} from '../data';
import { GaiaHex, factions, Building as BuildingEnum, Planet as PlanetEnum } from '@gaia-project/engine';
import {corners } from "../graphics/hex";
import Planet from './Planet.vue';
import Building from './Building.vue';
import { buildingName } from '../data/building';
import { planetNames }  from '../data/planets';

@Component<SpaceHex>({
  computed: {
    highlightedHexes(): Set<GaiaHex> {
      return this.$store.state.gaiaViewer.context.highlighted.hexes;
    },
    toSelect() {
      return !!this.$store.state.gaiaViewer.context.hexSelection;
    }
  },
  components: {
    Planet,
    Building
  }
})
export default class SpaceHex extends Vue {
  @Prop()
  hex: GaiaHex;

  get hexCorners() {
    return corners();
  }

  cost(hex: GaiaHex) {
    const data = this.highlightedHexes.get(hex);

    return (data && data.cost && data.cost !== "~") ? data.cost.replace(/,/g, ', ') : '';
  }

  hexClick(hex: GaiaHex) {
    if (this.highlightedHexes.has(hex) || this.toSelect) {
      this.$store.dispatch('gaiaViewer/hexClick', hex);
    }
  }

  faction(player) {
    if (player === undefined) {
      return;
    }
    return this.$store.state.gaiaViewer.data.players[player].faction;
  }

  planet(player) {
    return factions.planet(this.faction(player));
  }

  buildingName(building: BuildingEnum) {
    return buildingName(building);
  }

  planetName(planet: PlanetEnum) {
    return planetNames[planet];
  }
}
export default interface SpaceMap {
  highlightedHexes: HighlightHexData;
  toSelect: boolean;
}

</script>

<style lang="scss">

svg {
  .spaceHex {
    fill: #172E62;
    stroke: #666;
    stroke-width: 0.01;

    &:hover {
      fill-opacity: 0.5;
    }

    &.highlighted {
      fill: white;
      cursor: pointer;

      &.qic {
        fill: lightGreen
      }
    }

    &.toSelect {
      cursor: pointer;
      opacity: 0.7;
    }
  }

  .spaceHexFederation {
    stroke-width: 0.05;
    fill: none;
    pointer-events: none;
  }
}

</style>
