<template>
  <g :id="`${hex.q}x${hex.r}`">
    <title>Coordinates: {{hex.q}}x{{hex.r}}&#10;Sector: {{hex.data.sector}}{{hex.data.planet !== 'e' ? `&#10;Planet: ${planetName(hex.data.planet)}`: ''}}{{hex.data.building ? `&#10;Building: ${buildingName(hex.data.building)}` : ''}}{{cost(hex) ? `&#10;Cost: ${cost(hex)}` : ''}}</title>
    <polygon :points="hexCorners.map(p => `${p.x},${p.y}`).join(' ')" :class="['spaceHex', {toSelect, highlighted: highlightedHexes.has(hex), qic: cost(hex).includes('q'), power: cost(hex).includes('pw')}]" @click='hexClick(hex)' />
    <line v-for="(l, i) in lines" :key="i" :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" class="spaceLine" />
    <text class="sector-name" v-if="isCenter">{{hex.data.sector[0] === 's' ? parseInt(hex.data.sector.slice(1)) : parseInt(hex.data.sector)}}</text>
    <Planet v-if="hex.data.planet !== 'e'" :planet='hex.data.planet' :faction='faction(hex.data.player)' />
    <Building v-if="hex.data.building" :building='hex.data.building' :faction='faction(hex.data.player)' />
    <Building v-if="hex.data.additionalMine !== undefined" :faction='faction(hex.data.additionalMine)' building="m" transform="translate(0.38, 0.5) rotate(36) scale(0.9)" class="additionalMine" />
    <SpaceShip v-for="(player, index) in hex.data.ships || []" :key="`${player}-${index}`" :faction='faction(player)' :scale="0.4" :x="shipX(index)" :y="shipY(index)" />
    <polygon v-for="(player, index) in hex.data.federations || []" :points="hexCorners.map(p => `${p.x*(1-(index+0.5)/8)},${p.y*(1-(index+0.5)/8)}`).join(' ')" :class="['spaceHexFederation', 'planet', planet(player)]" :key="`${player}-${index}`" />
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import {MapData, HighlightHexData} from '../data';
import { GaiaHex, factions, Building as BuildingEnum, Planet as PlanetEnum, SpaceMap } from '@gaia-project/engine';
import {corners } from "../graphics/hex";
import Planet from './Planet.vue';
import Building from './Building.vue';
import SpaceShip from './SpaceShip.vue';
import { buildingName } from '../data/building';
import { planetNames }  from '../data/planets';
import { Direction } from 'hexagrid';

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
    Building,
    SpaceShip
  }
})
export default class SpaceHex extends Vue {
  @Prop()
  hex: GaiaHex;
  @Prop()
  isCenter: boolean;

  get hexCorners() {
    return corners();
  }

  get map(): SpaceMap {
    return this.$store.state.gaiaViewer.data.map;
  }

  get lines() {
    const lines = [];
    const corners = this.hexCorners;
    const map = this.$store.state.gaiaViewer.data.map;

    [Direction.NorthWest, Direction.North, Direction.NorthEast, Direction.SouthEast, Direction.South, Direction.SouthWest].forEach((direction, i) => {
      const neighbour = this.map.grid.neighbour(this.hex, direction);
      // Draw delimiter if sector is different
      if (!neighbour || neighbour.data.sector !== this.hex.data.sector) {
        lines.push({
          x1: corners[i].x,
          y1: corners[i].y,
          x2: corners[(i+1) % 6].x,
          y2: corners[(i+1) % 6].y,
        })
      }
    });

    return lines;
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

  shipX(index) {
    return SpaceHex.shipXs[index]
  }

  shipY(index) {
    return SpaceHex.shipYs[index]
  }

  static shipXs = [-0.5, 0.5, -1.3, 0, 1.3, -0.5, 0.5];
  static shipYs = [-1.3, -1.3, 0, 0, 0, 1.3, 1.3];
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

      &.power {
        fill: #d378d3
      }
    }

    &.toSelect {
      cursor: pointer;
      opacity: 0.7;
    }
  }

  .spaceLine {
    stroke: #ddd;
    stroke-width: 0.02;
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
