<template>
  <svg :viewBox='`0 0 ${viewWidth} 440`' class="research-board">
    <ResearchTrack v-for="(field, index) in [...fields].reverse()" :field=field :x="(fields.length - 1 - index)*60" :key="field" />
    <text y="198" x="180" style="font-size: 12px; text-anchor: middle">Charge 3 power</text>
    <g v-if="$store.state.gaiaViewer.data.tiles && $store.state.gaiaViewer.data.tiles.techs['gaia']">
      <g transform="translate(60, 410) scale(0.95)" >
        <TechTile pos="free1" x="-30" y="-30" />
      </g>
      <g transform="translate(120, 410) scale(0.95)" >
        <TechTile pos="free2" x="-30" y="-30" />
      </g>
      <g transform="translate(180, 410) scale(0.95)" >
        <TechTile pos="free3" x="-30" y="-30" />
      </g>
      <!--      resource conversion-->
      <g transform="translate(250, 410) scale(0.95)">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7"
                  refX="0" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7"/>
          </marker>
          <line id="arrow" x1="0" y1="0" x2="50" y2="0" stroke="#000" stroke-width="8" marker-end="url(#arrowhead)"
                transform="scale(.1)"/>
        </defs>

        <Resource kind="k" :count="4" transform="translate(-15, -15)" title="Convert 4 power from bowl III into 1 knowledge"/>
        <Resource kind="q" :count="4" transform="translate(20, -15)"/>
        <use xlink:href="#arrow" x="33" y="-15"/>
        <Resource kind="range" :count="2" transform="translate(57, -15) scale(.6)"/>
        <use xlink:href="#arrow" x="-6" y="15" transform="rotate(90)"/>
        <use xlink:href="#arrow" x="-6" y="-20" transform="rotate(90)"/>
        <Resource kind="c" :count="1" transform="translate(-15, 15)"/>
        <use xlink:href="#arrow" x="-8" y="-15" transform="rotate(180)"/>
        <Resource kind="o" :count="3" transform="translate(20, 15)"/>
        <use xlink:href="#arrow" x="33" y="15"/>
        <Resource kind="t" transform="translate(57, 15)"/>
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
