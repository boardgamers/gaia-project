<template>
  <svg :viewBox='`0 0 ${viewWidth} 440`' class="research-board">
    <ResearchTrack v-for="(field, index) in [...fields].reverse()" :field=field :x="(fields.length - 1 - index)*60" :key="field" />
    <text y="200" x="180" style="font-size: 14px; text-anchor: middle">Charge 3 power</text>
    <g v-if="$store.state.gaiaViewer.data.tiles && $store.state.gaiaViewer.data.tiles.techs['gaia']">
      <TechTile pos="free1" x="70" y="380" />
      <TechTile pos="free2" x="150" y="380" />
      <TechTile pos="free3" x="230" y="380" />
      <TechTile pos="free4" v-if="expansions" x="310" y="380" />
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { ResearchField, BoardAction as BoardActionEnum } from '@gaia-project/engine';
import ResearchTrack from './ResearchTrack.vue';
import TechTile from './TechTile.vue';
import BoardAction from "./BoardAction.vue";

@Component({
  computed: {
    fields (): ResearchField[] {
      return ResearchField.values(this.expansions);
    },
    expansions () {
      return this.$store.state.gaiaViewer.data.expansions;
    },
    viewWidth () {
      return this.fields.length * 60;
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
svg.research-board {
  overflow: visible;
}
</style>
