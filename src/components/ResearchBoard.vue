<template>
  <svg viewBox="0 0 360 440">
    <ResearchTrack v-for="(field, index) in fields" :field=field :x="index*60" :key="field" />
    <text y="186" x="130" style="font-size: 14px">Charge 3 power</text>
    <g v-if="$store.state.gaiaViewer.data.tiles && $store.state.gaiaViewer.data.tiles.techs['gaia']">
      <TechTile pos="free1" x="70" y="360" />
      <TechTile pos="free2" x="150" y="360" />
      <TechTile pos="free3" x="230" y="360" />
    </g>
    <BoardAction :scale="17" :transform="`translate(${18 + 36*i}, 420)`" v-for="(action, i) in actions" :key="action" :action="action" />
  </svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component } from 'vue-property-decorator';
import { ResearchField, BoardAction as BoardActionEnum } from '@gaia-project/engine';
import ResearchTrack from './ResearchTrack.vue';
import TechTile from './TechTile.vue';
import BoardAction from "./BoardAction.vue";

@Component({
  computed: {
    fields(): ResearchField[] {
      return Object.values(ResearchField)
    },
    actions(): BoardActionEnum[] {
      return Object.values(BoardActionEnum)
    }
  },
  components: {
    ResearchTrack,
    TechTile,
    BoardAction
  }
})
export default class ResearchBoard extends Vue {
}
</script>

<style lang="scss" scoped>

</style>
