<template>
  <svg viewBox="0 0 80 400">
    <FinalScoringTile :index="0" v-if="$store.state.game.data.finalScoringTiles" />
    <FinalScoringTile :index="1" transform="translate(0, 60)" v-if="$store.state.game.data.finalScoringTiles" />
    <ScoringTile v-for="i in [0, 1, 2, 3, 4, 5]" :round="i+1" :transform="`translate(0, ${400 - (i+1)*45})`" :key="i" v-if="$store.state.game.data.finalScoringTiles" />
  </svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component } from 'vue-property-decorator';
import ScoringTile from './ScoringTile.vue';
import FinalScoringTile from './FinalScoringTile.vue';

@Component({
  components: {
    ScoringTile,
    FinalScoringTile
  }
})
export default class ScoringBoard extends Vue {
}
</script>

<style lang="scss" scoped>

</style>
