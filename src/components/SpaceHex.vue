<template>
  <g :id="`${hex.q}x${hex.r}`" :title="'Cost: ' + cost(hex)">
    <title>Coordinates: {{hex.q}}x{{hex.r}}&#10;Sector: {{hex.data.sector}}</title>
    <polygon :points="hexCorners.map(p => `${p.x},${p.y}`).join(' ')" :class="{spaceHex: true, highlighted: highlightedHexes.has(hex), qic: cost(hex).includes('q')}" @click='hexClick(hex)' />
    <Planet v-if="hex.data.planet !== 'e'" :planet='hex.data.planet' />
    <Building v-if="hex.data.building" :building='hex.data.building' :faction='faction(hex.data.player)' />
    <polygon v-for="(player, index) in hex.data.federations || []" :points="hexCorners.map(p => `${p.x*(1-(index+0.5)/8)},${p.y*(1-(index+0.5)/8)}`).join(' ')" :class="['spaceHexFederation', 'planet-stroke', planet(player)]" />
    <b-tooltip v-if="cost(hex)" :target='`${hex.q}x${hex.r}`' :html='true' />
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import {MapData, HighlightHexData} from '../data';
import { GaiaHex, factions } from '@gaia-project/engine';
import {corners } from "../graphics/hex";
import Planet from './Planet.vue';
import Building from './Building.vue';

@Component<SpaceHex>({
  computed: {
    highlightedHexes(): Set<GaiaHex> {
      return this.$store.state.game.context.highlighted.hexes
    }
  },
  components: {
    Planet,
    Building
  }
})
export default class SpaceMap extends Vue {
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
    if (this.highlightedHexes.has(hex)) {
      this.$store.dispatch('hexClick', hex);
    }
  }

  faction(player) {
    return this.$store.state.game.data.players[player].faction;
  }
  planet(player) {
    return factions.planet(this.faction(player));
  }
}
export default interface SpaceMap {
  highlightedHexes: HighlightHexData
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
  }

  .spaceHexFederation {
    stroke-width: 0.03;
    fill: none;
  }
}

</style>
