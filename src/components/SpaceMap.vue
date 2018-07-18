<template>
  <svg :viewBox="`-11.5 -11.5 ${right} 24`" height="400px">
    <g v-for="hex in map" :key="`${hex.q}x${hex.r}`" :transform="`translate(${center(hex).x}, ${center(hex).y})`">
      <title>Coordinates: {{hex.q}}x{{hex.r}}&#10;Sector: {{hex.data.sector}}</title>
      <polygon :points="hexCorners.map(p => `${p.x},${p.y}`).join(' ')" :class="{spaceHex: true, highlighted: !!highlightedHexes.has(hex)}" @click='hexClick(hex)'>
      </polygon>
      <Planet v-if="hex.data.planet !== 'e'" :planet='hex.data.planet' />
      <Building v-if="hex.data.building" :building='hex.data.building' :faction='faction(hex.data.player)' />
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component } from 'vue-property-decorator';
import {MapData} from '../data';
import { GaiaHex } from '@gaia-project/engine';
import {corners, hexCenter } from "../graphics/hex";
import Planet from './Planet.vue';
import Building from './Building.vue';

@Component<SpaceMap>({
  computed: {
    map(this: SpaceMap): MapData {
      return this.$store.state.game.data.map
    },
    highlightedHexes(): Set<GaiaHex> {
      return this.$store.state.game.context.highlighted.hexes
    },
    right() {
      return (this.$store.state.game.data.players || []).length > 2 ? 31 : 24;
    }
  },
  components: {
    Planet,
    Building
  }
})
export default class SpaceMap extends Vue {
  get hexCorners() {
    return corners();
  }

  center(hex: GaiaHex) {
    return hexCenter(hex);
  }

  hexClick(hex: GaiaHex) {
    if (this.highlightedHexes.has(hex)) {
      this.$store.dispatch('hexClick', hex);
    }
  }

  faction(player) {
    return this.$store.state.game.data.players[player].faction;
  }
}
export default interface SpaceMap {
  highlightedHexes: Set<GaiaHex>
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
    }
  }
}

</style>
