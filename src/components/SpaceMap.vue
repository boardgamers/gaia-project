<template>
  <svg :viewBox="`-13 -11.5 ${right} 24`">
    <Sector v-for="center in this.sectors" :center="center" :key="`${center.q}x{center.r}`" :style="`transform: translate(${hexCenter(center).x * 1.02}px, ${hexCenter(center).y * 1.02}px) rotate(${rotation(center) * 60}deg);`"/>
  </svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component } from 'vue-property-decorator';
import { GaiaHex, SpaceMap as SpaceMapData } from '@gaia-project/engine';
import { hexCenter } from "../graphics/hex";
import Sector from './Sector.vue';
import { CubeCoordinates } from 'hexagrid';

@Component<SpaceMap>({
  computed: {
    map(this: SpaceMap): SpaceMapData {
      return this.$store.state.gaiaViewer.data.map
    },
    right() {
      return (this.$store.state.gaiaViewer.data.players || []).length > 2 ? 33.5 : 26;
    }
  },
  components: {
    Sector
  }
})
export default class SpaceMap extends Vue {
  hexCenter(hex: GaiaHex) {
    return hexCenter(hex);
  }

  get sectors(): CubeCoordinates[] {
    return this.map.configuration().centers;
  }

  rotation(center: CubeCoordinates) {
    return this.$store.state.gaiaViewer.context.rotation.get(`${center.q}x${center.r}`) || 0;
  }
}
export default interface SpaceMap {
  map: SpaceMapData
}

</script>

<style lang="scss">

</style>
