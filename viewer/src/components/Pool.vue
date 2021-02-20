<template>
  <div class="container-fluid">
    <div
      class="pool pb-0 mb-1 row no-gutters"
      v-if="$store.state.gaiaViewer.data.tiles && $store.state.gaiaViewer.data.tiles.techs['gaia']"
    >
      <Booster v-for="booster in boosters" :key="booster" :booster="booster" class="mb-2 mr-2" />
      <FederationTile
        v-for="([tile, numTiles], i) in federations"
        :key="`${tile}-${i}`"
        :federation="tile"
        :numTiles="numTiles"
        class="mb-2 mr-2"
        filter="url(#shadow-1)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Booster from "./Booster.vue";
import FederationTile from "./FederationTile.vue";
import { Booster as BoosterEnum, Expansion } from "@gaia-project/engine";

@Component({
  computed: {
    boosters() {
      return BoosterEnum.values(Expansion.All).filter(key => this.$store.state.gaiaViewer.data.tiles.boosters[key]);
    },
    federations() {
      return Object.entries(this.$store.state.gaiaViewer.data.tiles.federations).filter(([key, value]) => value > 0);
    },
  },
  components: {
    Booster,
    FederationTile,
  },
})
export default class Pool extends Vue {}
</script>

<style lang="scss" scoped>
.pool {
  margin-bottom: 1em;
  padding-bottom: 0.5em;
  padding-left: 0.5em;
  padding-top: 0.5em;
  border-radius: 5px;

  position: relative;
  border: 2px solid #333;
  background-color: white;

  flex-wrap: wrap;
}
</style>
