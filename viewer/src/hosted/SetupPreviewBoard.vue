<template>
  <!-- gaia-viewer-game: Game.vue's own root class (Game.vue:2,275-287) — every planet/resource/tech
       color is a CSS custom property scoped to this class (stylesheets/planets.css, imported by
       Game.vue's <style>). Without it here, every color falls back to invalid/black. -->
  <div class="gaia-viewer-game">
    <svg class="setup-preview-defs" aria-hidden="true" focusable="false">
      <Definitions />
    </svg>
    <div :class="['row', 'no-gutters', 'justify-content-center', engine.players.length > 2 ? 'medium-map' : 'small-map']">
      <SpaceMap v-if="hasMap" :class="['mb-1', 'space-map', 'col-md-7']" />
      <div class="col-md-5">
        <svg
          class="scoring-research-board"
          :viewBox="`-50 0 ${researchBoardWidth + (engine.options.lostFleet ? 110 : 120) + 50} ${
            engine.options.lostFleet ? researchBoardViewHeight + 60 : 550
          }`"
        >
          <ResearchBoard :height="researchBoardViewHeight" x="-50" />
          <ScoringBoard v-if="!engine.options.lostFleet" class="ml-4" width="90" :x="researchBoardWidth + 20" />
          <BoardAction
            :scale="17"
            :transform="`translate(${45 * i - 20}, ${baseResearchBoardHeight + 5})`"
            v-for="(action, i) in actions"
            :key="action"
            :action="action"
          />
        </svg>
      </div>
    </div>
    <div class="row mt-2" v-if="engine.options.lostFleet">
      <LostFleetShips class="col-12 col-md-5 offset-md-7" />
    </div>
    <div class="row mt-2">
      <Pool class="col-12" />
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component } from "vue-property-decorator";
import Engine, { BoardAction as BoardActionEnum, ResearchField } from "@gaia-project/engine";
import BoardAction from "../components/BoardAction.vue";
import Definitions from "../components/definitions/Definitions.vue";
import LostFleetShips from "../components/LostFleetShips.vue";
import Pool from "../components/Pool.vue";
import ResearchBoard from "../components/ResearchBoard.vue";
import ScoringBoard from "../components/ScoringBoard.vue";
import SpaceMap from "../components/SpaceMap.vue";
import { BASE_RESEARCH_BOARD_HEIGHT, researchBoardHeight } from "../logic/utils";

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
    Definitions,
    BoardAction,
    LostFleetShips,
    Pool,
  },
})
export default class SetupPreviewBoard extends Vue {
  get engine(): Engine {
    return this.$store.state.data;
  }

  // Mirrors Game.vue's own `hasMap` guard - `OpenGamePreview.vue` mounts this component before its
  // deferred `$nextTick` data load commits a real, mapped engine (see `SpaceMap.vue`'s `map` getter
  // dereferencing `engine.map`), so the very first render here can hit a placeholder `new Engine()`
  // with no map. Without this guard, that first render throws inside SpaceMap, Vue 2 swallows the
  // render-function exception, and the map is left permanently blank even once the real engine
  // commits a tick later (the failed render never subscribed to `state.data` as a dependency).
  get hasMap(): boolean {
    return !!this.engine.map;
  }

  get researchBoardWidth() {
    return ResearchField.values(this.engine.expansions).length * 60;
  }

  get researchBoardViewHeight() {
    return researchBoardHeight(this.engine);
  }

  get baseResearchBoardHeight() {
    return BASE_RESEARCH_BOARD_HEIGHT;
  }

  get actions(): BoardActionEnum[] {
    return BoardActionEnum.values(this.engine.expansions);
  }
}
</script>

<style lang="scss">
@import "../stylesheets/frontend.scss";
@import "../stylesheets/planets.css";

.gaia-viewer-game .space-map,
.gaia-viewer-game .scoring-research-board {
  width: 100%;
  max-width: 100%;
  max-height: 600px;
  height: intrinsic;
  display: block;
}

.gaia-viewer-game .medium-map,
.gaia-viewer-game .small-map {
  flex-wrap: nowrap;
}

.gaia-viewer-game .setup-preview-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}

@media (max-width: 767px) {
  .gaia-viewer-game .small-map,
  .gaia-viewer-game .medium-map {
    flex-wrap: wrap;
  }

  .gaia-viewer-game .scoring-research-board {
    width: calc(100% + 1rem);
    max-width: none;
    max-height: none;
    margin-left: -0.5rem;
    margin-right: -0.5rem;
  }
}
</style>
