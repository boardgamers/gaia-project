<template>
  <g :class="['scoringTile', { highlighted, faded }]" v-b-tooltip :title="tooltip">
    <rect x="1" y="1" width="75" height="40" />
    <text class="title" x="5" y="12">Round {{ round }}</text>
    <text class="content" x="5" y="31">{{ content }}</text>
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Event, Phase } from "@gaia-project/engine";
import { eventDesc } from "../data/event";
import { roundScoringEvents } from "@gaia-project/engine/src/tiles/scoring";

@Component<ScoringTile>({
  computed: {
    tile(this: ScoringTile) {
      return this.$store.state.data.tiles.scorings.round[this.round - 1];
    },

    content() {
      return roundScoringEvents(this.tile, 0)[0].toString();
    },

    tooltip() {
      return eventDesc(new Event(this.content));
    },

    highlighted() {
      return this.$store.state.data.round === this.round && !this.faded;
    },

    faded() {
      return this.$store.state.data.round > this.round || this.$store.state.data.phase === Phase.EndGame;
    },
  },
})
export default class ScoringTile extends Vue {
  @Prop()
  round: number;
}
</script>

<style lang="scss">
g {
  &.scoringTile {
    rect {
      stroke: #333;
      stroke-width: 1px;
      fill: white;
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

    &.highlighted rect {
      stroke: #2c4;
    }

    &.faded {
      stroke-opacity: 0.5;
      fill-opacity: 0.5;
    }
  }
}
</style>
