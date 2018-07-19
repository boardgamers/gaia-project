<template>
  <svg viewBox="0 0 360 440">
    <ResearchTrack v-for="(field, index) in fields" :field=field :x="index*60" :key="field" />
    <g v-if="$store.state.game.data.techTiles && $store.state.game.data.techTiles['gaia']">
      <TechTile pos="free1" x="70" y="400" />
      <TechTile pos="free2" x="150" y="400" />
      <TechTile pos="free3" x="230" y="400" />
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component } from 'vue-property-decorator';
import { ResearchField } from '@gaia-project/engine';
import ResearchTrack from './ResearchTrack.vue';
import TechTile from './TechTile.vue';

@Component({
  computed: {
    fields(): ResearchField[] {
      return Object.values(ResearchField)
    }
  },
  components: {
    ResearchTrack,
    TechTile
  }
})
export default class ResearchBoard extends Vue {
}
</script>

<style lang="scss" scoped>

</style>
