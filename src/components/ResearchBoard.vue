<template>
  <svg :viewBox="`0 0 ${viewWidth} 440`" class="research-board">
    <ResearchTrack
      v-for="(field, index) in [...fields].reverse()"
      :field="field"
      :x="(fields.length - 1 - index) * 60"
                   :key="field"/>
    <text y="198" x="180" style="font-size: 12px; text-anchor: middle">Charge 3 power</text>
    <g v-if="$store.state.gaiaViewer.data.tiles && $store.state.gaiaViewer.data.tiles.techs['gaia']">
      <g transform="translate(30, 410) scale(0.95)">
        <TechTile pos="free1" x="-30" y="-30"/>
      </g>
      <g transform="translate(90, 410) scale(0.95)">
        <TechTile pos="free2" x="-30" y="-30"/>
      </g>
      <g transform="translate(150, 410) scale(0.95)">
        <TechTile pos="free3" x="-30" y="-30"/>
      </g>
      <!--      resource conversion-->
      <g transform="translate(247, 412) scale(0.95)">
        <defs>
          <polygon id="arrow" points="0 0, 10 3.5, 0 7" fill="white" stroke="black"
                   transform="scale(.7) translate(4, -3.5)"/>
        </defs>

        <Resource kind="pay-pw" :count="4" transform="translate(-45, -15)"/>
        <Resource kind="pay-pw" :count="1" transform="translate(-15, -15)"/>
        <Resource kind="pay-pw" :count="3" transform="translate(15, -15)"/>
        <Resource kind="pay-pw" :count="4" transform="translate(57, -15)"/>

        <use xlink:href="#arrow" x="-6" y="45" transform="rotate(90)"/>
        <use xlink:href="#arrow" x="-6" y="15" transform="rotate(90)"/>
        <use xlink:href="#arrow" x="-6" y="-15" transform="rotate(90)"/>
        <use xlink:href="#arrow" x="50" y="0" transform="rotate(90 57 0)"/>

        <use xlink:href="#arrow" x="14" y="18" transform="rotate(-30)"/>
        <Resource kind="t" :count="1" transform="translate(38, 0)"/>
        <use xlink:href="#arrow" x="66" y="15" transform="rotate(-32 57 15)"/>
        <Resource kind="range" :count="2" transform="translate(88, -2) scale(1)"/>

        <Resource kind="k" :count="1" transform="translate(-45, 15)"/>
        <use xlink:href="#arrow" x="-37" y="15"/>
        <Resource kind="c" :count="1" transform="translate(-15, 15)"/>
        <use xlink:href="#arrow" x="-6" y="-15" transform="rotate(180)"/>
        <Resource kind="o" :count="1" transform="translate(15, 15)"/>
        <use xlink:href="#arrow" x="32" y="15" transform="rotate(180 38 15)"/>
        <Resource kind="q" :count="1" transform="translate(57, 15)"/>
      </g>
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { ResearchField, BoardAction as BoardActionEnum } from "@gaia-project/engine";
import ResearchTrack from "./ResearchTrack.vue";
import TechTile from "./TechTile.vue";
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
