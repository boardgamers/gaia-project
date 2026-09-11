<template>
  <svg :viewBox="`0 0 ${viewWidth} ${viewHeight}`" :height="height" :width="width">
    <ResearchTrack v-for="(field, index) in fields" :field="field" :x="index * 60" :key="field" />
    <FleetScoringColumn v-if="$store.state.data.options.lostFleet" />
    <text y="186" x="130" style="font-size: 14px; fill: currentColor">Charge 3 power</text>
    <g v-if="$store.state.data.tiles && $store.state.data.tiles.techs['gaia']">
      <TechTile pos="free1" x="70" y="360" />
      <TechTile pos="free2" x="150" y="360" />
      <TechTile pos="free3" x="230" y="360" />
      <TechTile pos="free4" v-if="$store.state.data.tiles.techs.free4" x="310" y="360" />
    </g>
    <BoardAction
      :scale="17"
      :transform="`translate(${18 + 36 * Math.min(i, 12)}, ${i == 13 ? 382 : 420})`"
      v-for="(action, i) in actions"
      :key="action"
      :action="action"
    />
  </svg>
</template>

<script lang="ts">
import { BoardAction as BoardActionEnum, ResearchField } from "@gaia-project/engine";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { researchBoardHeight } from "../../../viewer/src/logic/utils";
import BoardAction from "./BoardAction.vue";
import FleetScoringColumn from "./FleetScoringColumn.vue";
import ResearchTrack from "./ResearchTrack.vue";
import TechTile from "./TechTile.vue";

@Component({
  computed: {
    fields(): ResearchField[] {
      return ResearchField.values(this.expansions);
    },
    actions(): BoardActionEnum[] {
      return BoardActionEnum.values(this.expansions);
    },
    expansions() {
      return this.$store.state.data.expansions;
    },
    viewWidth() {
      return this.fields.length * 60 + (this.$store.state.data.options.lostFleet ? 80 : 0);
    },
    viewHeight() {
      return researchBoardHeight(this.$store.state.data);
    },
    width() {
      return (this.height / 440) * this.viewWidth;
    },
  },
  components: {
    FleetScoringColumn,
    ResearchTrack,
    TechTile,
    BoardAction,
  },
})
export default class ResearchBoard extends Vue {
  @Prop({ default: 450 })
  height: number;
}
</script>

<style lang="scss" scoped></style>
