<template>
  <svg viewBox="0 0 360 440">
    <ResearchTrack v-for="(field, index) in fields" :field=field :x="index*60" :key="field" />
    <TechTile pos="free1" transform="translate(70, 400)" />
    <TechTile pos="free2" transform="translate(150, 400)" />
    <TechTile pos="free3" transform="translate(230, 400)" />
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
