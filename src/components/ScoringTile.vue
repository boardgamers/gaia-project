<template>
  <g :class='["scoringTile", {highlighted, faded}]' v-b-tooltip :title="tooltip">
    <text class="title" x="58" y="36">R{{round}}</text>
    <!-- <text class="content" x="5" y="31">{{content.split(" ")[0]}}</text>-->
    <Resource :kind=reward.type :count=reward.count transform="translate(64.2, 12.6) scale(1.5)" />
    <Condition :condition=event.condition :transform="`translate(${(event.condition === 'step' || event.condition === 'a' || event.condition === 'PA') ? 27 + (event.condition === 'PA' ? 8 : 0 ) : 34}, ${event.condition === 'step' ? 20 : 22}) scale(1.3)`" />
    <Operator :condition=event.condition :operator=event.operator transform="translate(28, 27) scale(1)" />
    <rect x="1" y="1" width="75" height="40" rx=2 ry=2 />
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { tiles, Event, Phase } from '@gaia-project/engine';
import { eventDesc } from '../data/event';
import Condition from './Condition.vue';
import Resource from './Resource.vue';
import Operator from './Operator.vue';

@Component<ScoringTile>({
  components: {
    Condition,
    Operator,
    Resource
  }
})
export default class ScoringTile extends Vue {
  @Prop()
  round: number;

  get tile (this: ScoringTile) {
    return this.$store.state.gaiaViewer.data.tiles.scorings.round[this.round - 1];
  }

  get event () {
    return new Event(this.content);
  }

  get reward () {
    return this.event.rewards[0];
  }

  get content () {
    return tiles.roundScorings[this.tile][0];
  }

  get tooltip () {
    return eventDesc(this.event);
  }

  get highlighted () {
    return this.$store.state.gaiaViewer.data.round === this.round && !this.faded;
  }

  get faded () {
    return this.$store.state.gaiaViewer.data.round > this.round || this.$store.state.gaiaViewer.data.phase === Phase.EndGame;
  }
}

</script>

<style lang="scss">

g {
  &.scoringTile {
    & > rect {
      stroke: #333;
      stroke-width: 1px;
      fill: none;
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

    &.highlighted > rect {
      stroke: #2C4;
      stroke-width: 1.5px;
    }

    &.faded {
      opacity: 0.5;
    }
  }
}

</style>
