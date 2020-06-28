<template>
  <svg :viewBox='`0 0 ${viewWidth} 440`' class="research-board">
    <ResearchTrack v-for="(field, index) in [...fields].reverse()" :field=field :x="(fields.length - 1 - index)*60" :key="field" />
    <text y="198" x="180" style="font-size: 12px; text-anchor: middle">Charge 3 power</text>
    <g v-if="$store.state.gaiaViewer.data.tiles && $store.state.gaiaViewer.data.tiles.techs['gaia']">
      <g transform="translate(100, 410) scale(0.95)" >
        <TechTile pos="free1" x="-30" y="-30" />
      </g>
      <g transform="translate(180, 410) scale(0.95)" >
        <TechTile pos="free2" x="-30" y="-30" />
      </g>
      <g transform="translate(260, 410) scale(0.95)" >
        <TechTile pos="free3" x="-30" y="-30" />
      </g>
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
