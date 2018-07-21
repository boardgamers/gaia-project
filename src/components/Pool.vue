<template>
  <div class="pool" v-show="boosters.length > 0">
    <Booster v-for="booster in boosters" :key="booster" :booster="booster" />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import Booster from './Booster.vue';

@Component({
  computed: {
    boosters() {
      return Object.keys(this.$store.state.game.data.roundBoosters).filter(key => !!this.$store.state.game.data.roundBoosters[key]).sort();
    }
  },
  components: {
    Booster
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
