<template>
  <svg height="400px" viewBox="0 0 360 450">
    <ResearchTrack v-for="(field, index) in fields" :field=field :x="index*60" />
  </svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component } from 'vue-property-decorator';
import { ResearchField } from '@gaia-project/engine';
import ResearchTrack from './ResearchTrack.vue';

@Component({
  computed: {
    fields(): ResearchField[] {
      return Object.values(ResearchField)
    }
  },
  components: {
    ResearchTrack
  }
})
export default class ResearchBoard extends Vue {
}
</script>

<style lang="scss" scoped>

</style>
