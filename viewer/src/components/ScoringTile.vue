<template>
  <g :class="['scoringTile', { highlighted, faded }]" v-b-tooltip.nofade="tooltipTriggerConfig()" :title="tooltip">
    <!-- Accent underlay: the round tab (bottom-right) is the tile's own number plate, echoed in
         the contour's highlight when the round is active. -->
    <rect x="1" y="1" width="75" height="40" rx="6" ry="6" class="accent" />
    <rect x="1" y="1" width="75" height="40" rx="6" ry="6" stroke="none" fill="white" class="body" />
    <text class="title" x="70" y="36">R{{ round }}</text>
    <Resource :kind="reward.type" :count="reward.count" transform="translate(63.7, 13.1) scale(1.5)" />
    <Condition
      :condition="event.condition"
      :transform="`translate(${
        event.condition === 'step' || event.condition === 'a' || event.condition === 'PA'
          ? 27 + (event.condition === 'PA' ? 8 : 0)
          : 34
      }, ${event.condition === 'step' ? 20 : 22}) scale(1.3)`"
    />
    <Operator
      v-if="event.condition !== 'newsector'"
      :condition="event.condition"
      :operator="event.operator"
      transform="translate(28, 27) scale(1)"
    />
    <rect x="1" y="1" width="75" height="40" rx="6" ry="6" class="contour" />
    <g v-if="faded" class="strike">
      <line y1="6" y2="34" x1="6" x2="70" />
    </g>
  </g>
</template>

<script lang="ts">
import Engine, { Phase } from "@gaia-project/engine";
import { roundScoringEvents } from "@gaia-project/engine/src/tiles/scoring";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { eventDesc } from "../data/event";
import { tooltipTriggerConfig } from "../logic/tooltip";
import Condition from "./Condition.vue";
import Operator from "./Operator.vue";
import Resource from "./Resource.vue";

@Component<ScoringTile>({
  components: {
    Condition,
    Operator,
    Resource,
  },
})
export default class ScoringTile extends Vue {
  @Prop()
  round: number;

  get tile() {
    return this.engine.tiles.scorings.round[this.round - 1];
  }

  get event() {
    return roundScoringEvents(this.tile, this.round)[0];
  }

  get reward() {
    return this.event.rewards[0];
  }

  get engine(): Engine {
    return this.$store.state.data;
  }

  get tooltip() {
    return eventDesc(this.event, this.engine.expansions);
  }

  get highlighted() {
    return this.engine.round === this.round && !this.faded;
  }

  get faded() {
    return this.engine.round > this.round || this.engine.phase === Phase.EndGame;
  }

  tooltipTriggerConfig = tooltipTriggerConfig;
}
</script>

<style lang="scss">
g {
  &.scoringTile {
    & > rect.accent {
      fill: #4d5766;
      stroke: none;
    }

    // Sit the white card slightly up-left on the accent plate, so the plate reads as the tile's
    // bottom-right edge rather than an outline.
    & > rect.body {
      transform: translate(-1.5px, -1.5px);
    }

    & > rect.contour {
      fill: none;
      stroke: #333;
      stroke-width: 1px;
      transform: translate(-1.5px, -1.5px);
    }

    .title {
      font-size: 10px;
      font-weight: bold;
      pointer-events: none;
      text-anchor: end;
      // the tile background is white, so keep the label dark even under a dark-mode host
      fill: #212529;
    }

    .content {
      font-size: 12px;
      pointer-events: none;
      fill: #212529;
    }

    &.highlighted > rect.contour {
      stroke: var(--highlighted);
      stroke-width: 1.5px;
    }

    // A single slim diagonal carries the "this round is over" read; the old thick X crossed the
    // whole tile out so aggressively it read as a rendering bug.
    .strike line {
      stroke: #333;
      stroke-width: 2;
      stroke-linecap: round;
      opacity: 0.65;
    }

    &.faded {
      opacity: 0.55;
    }
  }
}
</style>
