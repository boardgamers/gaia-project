<template>
  <!-- gaia-viewer-game: Game.vue's own root class (Game.vue:2,275-287) — every planet/resource/tech
       color is a CSS custom property scoped to this class (stylesheets/planets.css, imported by
       Game.vue's <style>). Without it here, every color falls back to invalid/black. -->
  <div class="gaia-viewer-game">
    <SpaceMap class="mb-1 space-map" />
    <svg class="scoring-research-board" :viewBox="`0 0 ${researchBoardWidth + 120} 550`">
      <ResearchBoard height="450" x="-50" />
      <ScoringBoard class="ml-4" width="90" :x="researchBoardWidth + 20" />
      <BoardAction
        :scale="17"
        :transform="`translate(${45 * i + 6}, 455)`"
        v-for="(action, i) in actions"
        :key="action"
        :action="action"
      />
    </svg>
    <LostFleetShips class="mt-2" />
    <LostFleetTerraformingBoard class="mt-2" />
    <Pool class="mt-2" />
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component } from "vue-property-decorator";
import Engine, { BoardAction as BoardActionEnum, ResearchField } from "@gaia-project/engine";
import BoardAction from "../components/BoardAction.vue";
import LostFleetShips from "../components/LostFleetShips.vue";
import LostFleetTerraformingBoard from "../components/LostFleetTerraformingBoard.vue";
import Pool from "../components/Pool.vue";
import ResearchBoard from "../components/ResearchBoard.vue";
import ScoringBoard from "../components/ScoringBoard.vue";
import SpaceMap from "../components/SpaceMap.vue";

// The setup-preview counterpart of Game.vue's map/research/scoring/board-action
// composition (Game.vue:9-34) — deliberately NOT the whole Game.vue, which
// assumes real players/factions exist (Commands panel, player boards). This
// is mounted into its own nested Vuex store by SetupPreview.vue, never into
// the host app's store (which doesn't exist inside Lobby.vue's tree).
@Component<SetupPreviewBoard>({
  components: {
    SpaceMap,
    ResearchBoard,
    ScoringBoard,
    BoardAction,
    LostFleetShips,
    LostFleetTerraformingBoard,
    Pool,
  },
})
export default class SetupPreviewBoard extends Vue {
  get engine(): Engine {
    return this.$store.state.data;
  }

  get researchBoardWidth() {
    return ResearchField.values(this.engine.expansions).length * 60;
  }

  get actions(): BoardActionEnum[] {
    return BoardActionEnum.values(this.engine.expansions);
  }
}
</script>
