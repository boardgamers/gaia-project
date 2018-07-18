<template>
  <svg :viewBox="`-11.5 -11.5 ${right} 24`">
    <SpaceHex v-for="hex in map" :key="`${hex.q}x${hex.r}`" :transform="`translate(${center(hex).x}, ${center(hex).y})`" :hex="hex" />
  </svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component } from 'vue-property-decorator';
import {MapData, HighlightHexData} from '../data';
import { GaiaHex } from '@gaia-project/engine';
import { hexCenter } from "../graphics/hex";
import SpaceHex from './SpaceHex.vue';

@Component<SpaceMap>({
  computed: {
    map(this: SpaceMap): MapData {
      return this.$store.state.game.data.map
    },
    right() {
      return (this.$store.state.game.data.players || []).length > 2 ? 31 : 24;
    }
  },
  components: {
    SpaceHex
  }
})
export default class SpaceMap extends Vue {
  get hexCorners() {
    return corners();
  }

  center(hex: GaiaHex) {
    return hexCenter(hex);
  }
}
export default interface SpaceMap {
  highlightedHexes: HighlightHexData
}

</script>

<style lang="scss">

</style>
