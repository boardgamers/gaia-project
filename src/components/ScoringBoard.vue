<template>
  <svg viewBox="0 0 80 400">
    <ScoringTile v-for="i in [0, 1, 2, 3, 4, 5]" :round="i+1" :transform="`translate(0, ${405 - (i+1)*50})`" :key="i" />
  </svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component } from 'vue-property-decorator';
import ScoringTile from './ScoringTile.vue';

@Component({
  components: {
    ScoringTile
  }
})
export default class ScoringBoard extends Vue {
}
</script>

<style lang="scss" scoped>

</style>
