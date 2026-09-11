<template>
  <g v-if="isLostFleet" :transform="`translate(${fields.length * 60}, 0)`">
    <g v-if="hasScoringExtension" v-b-tooltip :title="extensionTooltip">
      <rect x="1" y="2" width="75" height="42" fill="white" stroke="#333" />
      <text x="5" y="17" fill="#212529">Requirement</text>
      <text x="5" y="33" fill="#212529">{{ gateOnShips ? "3 ships" : "25 VP" }}</text>
      <TechTile pos="adv-ext" x="1" y="53" width="75" height="48" />
    </g>
    <ScoringTile
      v-for="i in scorings"
      :round="i"
      :key="i"
      :transform="`translate(0, ${scoringTileY(i)}) scale(0.82)`"
    />
    <g v-if="hasFinalScoring" :transform="`translate(0, ${finalScoringY}) scale(0.82)`">
      <FinalScoringTile
        v-for="i in finalScoringCount"
        :index="i - 1"
        :key="i"
        :transform="`translate(0, ${(i - 1) * 74})`"
      />
    </g>
  </g>
</template>
<script lang="ts">
import { Component } from "vue-property-decorator";
import CurrentResearchBoard from "../../../viewer/src/components/ResearchBoard.vue";
import FinalScoringTile from "./FinalScoringTile.vue";
import ScoringTile from "./ScoringTile.vue";
import TechTile from "./TechTile.vue";
@Component({ components: { TechTile, ScoringTile, FinalScoringTile } })
export default class FleetScoringColumn extends CurrentResearchBoard {}
</script>
