<template>
  <svg viewBox="0 0 80 470" v-if="$store.state.data.tiles && $store.state.data.tiles.scorings.final">
    <FinalScoringTile :index="0" v-if="final > 0" />
    <FinalScoringTile :index="1" v-if="final > 1" transform="translate(0, 60)" />
    <ScoringTile v-for="i in scorings" :round="i" :transform="`translate(0, ${400 - i * 45})`" :key="i" />
    <g v-if="hasScoringExtension" transform="translate(10, 398)">
      <text x="30" y="0" class="extension-label">Extension</text>
      <text x="30" y="11" class="extension-condition">{{ extensionLabel }}</text>
      <g transform="translate(30, 44) scale(0.95)">
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
import TechTile from "./TechTile.vue";

@Component({
  components: {
    ScoringTile,
    FinalScoringTile,
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

  get extensionLabel() {
    return this.engine.scoringExtensionSide === ScoringBoardExtensionSide.ExploredShips ? "3 Ships" : "25 VP";
  }
}
</script>

<style lang="scss" scoped>
.extension-label,
.extension-condition {
  font-size: 8px;
  text-anchor: middle;
}

.extension-label {
  font-weight: 700;
}
</style>
