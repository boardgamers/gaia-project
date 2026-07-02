<template>
  <svg viewBox="0 0 80 470" v-if="$store.state.data.tiles && $store.state.data.tiles.scorings.final">
    <FinalScoringTile :index="0" v-if="final > 0" />
    <FinalScoringTile :index="1" v-if="final > 1" transform="translate(0, 60)" />
    <ScoringTile v-for="i in scorings" :round="i" :transform="`translate(0, ${400 - i * 45})`" :key="i" />
    <g v-if="hasScoringExtension" transform="translate(10, 398)" v-b-tooltip :title="extensionTooltip">
      <text x="30" y="0" class="extension-label">Extension</text>
      <g v-if="gateOnShips" data-extension-gate="ships" transform="translate(30, 9)">
        <circle v-for="i in [0, 1, 2]" :key="i" :cx="(i - 1) * 13" r="5.5" class="extension-ship" />
        <text v-for="i in [0, 1, 2]" :key="`t${i}`" :x="(i - 1) * 13" y="2.8" class="extension-ship-label">
          {{ ["T", "R", "E"][i] }}
        </text>
      </g>
      <Resource v-else data-extension-gate="vp" kind="vp" :count="25" transform="translate(30, 9) scale(0.9)" />
      <g transform="translate(30, 46) scale(0.95)">
        <TechTile pos="adv-ext" x="-30" y="-30" />
      </g>
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component } from "vue-property-decorator";
import Engine, { ScoringBoardExtensionSide } from "@gaia-project/engine";
import ScoringTile from "./ScoringTile.vue";
import FinalScoringTile from "./FinalScoringTile.vue";
import Resource from "./Resource.vue";
import TechTile from "./TechTile.vue";

@Component({
  components: {
    ScoringTile,
    FinalScoringTile,
    Resource,
    TechTile,
  },
})
export default class ScoringBoard extends Vue {
  get scorings() {
    return this.$store.state.data.tiles.scorings.round.length;
  }

  get final() {
    return this.$store.state.data.tiles.scorings.final.length;
  }

  get engine(): Engine {
    return this.$store.state.data;
  }

  get hasScoringExtension() {
    return !!this.engine.tiles?.techs?.["adv-ext"];
  }

  get gateOnShips() {
    return this.engine.scoringExtensionSide === ScoringBoardExtensionSide.ExploredShips;
  }

  get extensionTooltip() {
    return this.gateOnShips
      ? "Scoring Board Extension: this Advanced Tech tile requires 3 explored spaceships (plus the usual federation token and coverable tech tile)"
      : "Scoring Board Extension: this Advanced Tech tile requires 25 VP (plus the usual federation token and coverable tech tile)";
  }
}
</script>

<style lang="scss" scoped>
.extension-label {
  font-size: 8px;
  text-anchor: middle;
  font-weight: 700;
}

.extension-ship {
  fill: #efe6c4;
  stroke: #d8c57c;
  stroke-width: 1;
}

.extension-ship-label {
  font-size: 6px;
  font-weight: 700;
  fill: #172e62;
  text-anchor: middle;
  pointer-events: none;
}
</style>
