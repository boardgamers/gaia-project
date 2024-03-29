<template>
  <g :class="['scoringTile', { highlighted, faded }]" v-b-tooltip :title="tooltip">
    <rect x="1" y="1" width="75" height="40" rx="2" ry="2" stroke="none" fill="white" />
    <text class="title" x="58" y="36">R{{ round }}</text>
    <Resource :kind="reward.type" :count="reward.count" transform="translate(63.7, 13.1) scale(1.5)" />
    <Condition
      :condition="event.condition"
      :transform="`translate(${
        event.condition === 'step' || event.condition === 'a' || event.condition === 'PA'
          ? 27 + (event.condition === 'PA' ? 8 : 0)
          : 34
      }, ${event.condition === 'step' ? 20 : 22}) scale(1.3)`"
    />
    <Operator :condition="event.condition" :operator="event.operator" transform="translate(28, 27) scale(1)" />
    <rect x="1" y="1" width="75" height="40" rx="2" ry="2" class="contour" />
    <g v-if="faded">
      <line y1="5" y2="35" x1="5" x2="71" stroke="#333" stroke-width="5" />
      <line y1="35" y2="5" x1="5" x2="71" stroke="#333" stroke-width="5" />
    </g>
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, { Phase } from "@gaia-project/engine";
import { eventDesc } from "../data/event";
import Condition from "./Condition.vue";
import Resource from "./Resource.vue";
import Operator from "./Operator.vue";
import { roundScoringEvents } from "@gaia-project/engine/src/tiles/scoring";

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
}
</script>

<style lang="scss">
g {
  &.scoringTile {
    & > rect.contour {
      fill: none;
      stroke: #333;
      stroke-width: 1px;
    }
    .title {
      font-size: 10px;
      font-weight: bold;
      pointer-events: none;
    }
    .content {
      font-size: 12px;
      pointer-events: none;
    }

    &.highlighted > rect.contour {
      stroke: var(--highlighted);
      stroke-width: 1.5px;
    }

    &.faded {
      opacity: 0.5;
    }
  }
}
</style>
