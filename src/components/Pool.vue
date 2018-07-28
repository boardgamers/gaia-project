<template>
  <div class="pool pb-0 mb-1" v-if="$store.state.game.data.tiles && $store.state.game.data.tiles.techs['gaia']">
    <Booster v-for="booster in boosters" :key="booster" :booster="booster" class="mb-2"  />
    <FederationTile v-for="(federation, i) in federations" :key="`${federation}-${i}`" :federation="federation" class="mb-2" />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import Booster from './Booster.vue';
import FederationTile from "./FederationTile.vue";

@Component({
  computed: {
    boosters() {
      return Object.keys(this.$store.state.game.data.tiles.boosters).filter(key => this.$store.state.game.data.tiles.boosters[key]).sort();
    },
    federations() {
      const federationObject = this.$store.state.game.data.tiles.federations;

      const ret = [];

      return Object.keys(federationObject).sort();
    }
  },
  components: {
    Booster,
    FederationTile
  }
})
export default class Pool extends Vue {
  
}

</script>

<style lang="scss" scoped>
@import "../stylesheets/frontend.scss";

.pool {
  margin-bottom: 1em;
  padding-bottom: 0.5em;
  padding-left: 0.5em;
  padding-top: 0.5em;
  border-radius: 5px;

  position: relative;
  border: 2px solid #333;
  background-color: white;

  @extend .row;
  @extend .no-gutters;
  flex-wrap: wrap;

  svg {
    @extend .mr-1;
  }
}
</style>
