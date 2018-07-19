<template>
  <g :class='["scoringTile", {highlighted, faded}]' v-if="$store.state.game.data.techTiles"  v-b-tooltip :title="tooltip">
    <rect x="1" y="1" width="75" height="40" />
    <text class="title" x="5" y="12">Round {{round}}</text>
    <text class="content" x="5" y="31">{{content}}</text>
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { tiles, Event} from '@gaia-project/engine';
import { eventDesc } from '../data/event';

@Component<ScoringTile>({
  computed: {
    tile(this: ScoringTile) {
      return this.$store.state.game.data.roundScoringTiles[this.round - 1];
    },

    content() {
      return tiles.roundscorings[this.tile][0];
    },

    tooltip() {
      return eventDesc(new Event(this.content));
    },

    highlighted() {
      return this.$store.state.game.data.round === this.round;
    },

    faded() {
      return this.$store.state.game.data.round > this.round;
    }
  }
})
export default class ScoringTile extends Vue {
  @Prop()
  round: number;
}

</script>

<style lang="scss" scoped>

g {
  &.scoringTile {
    rect {
      stroke: #333;
      stroke-width: 1px;
      fill: white;
    }
    .title {
      font-family: sans-serif;
      font-size: 10px;
      font-weight: bold;
      pointer-events: none;
    }
    .content {
      font-family: sans-serif;
      font-size: 12px;
      pointer-events: none;
    }

    &.highlighted rect {
      stroke: #2C4;
    }

    &.faded {
      stroke-opacity: 0.5;
      fill-opacity: 0.5;
    }
  }
}

</style>
