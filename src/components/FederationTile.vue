<template>
  <svg viewBox="-25 -25 50 50" width="50" height="50" style="overflow: visible">
    <g :class='["federationTile", {highlighted, disabled}]'>
      <image xlink:href="../assets/conditions/federation.svg" v-if="!disabled" style="color: #247B0A" width=50 x=-25 y=-25 @click="onClick" />
      <image xlink:href="../assets/conditions/federation-used.svg" v-if="disabled" style="color: #247B0A" width=50 x=-25 y=-25 @click="onClick" />
      <circle cx="16.5" cy="-16.5" r="8" stroke="black" stroke-width="1" fill="white" v-if="numTiles>1" />
      <text x="16.5" y="-15.5" v-if="numTiles>1">
          {{numTiles}}
      </text>
      <g v-if="federation !== undefined">
        <Resource
          v-for="(reward, i) in rewards"
          :key=i
          :count=reward.count
          :kind=reward.type
          :transform="`translate(${i === 2 ? 0 : (i - Math.min(rewards.length - 1, 1)/2) * 18}, ${rewards.length === 1 ? 12.5 : (i === 2 ? -7 : 10)})`" />
      </g>
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { tiles, Event, Federation as FederationEnum, PlayerEnum, Reward } from '@gaia-project/engine';
import { eventDesc } from '../data/event';

@Component
export default class FederationTile extends Vue {
  @Prop()
  federation: FederationEnum;

  @Prop()
  used: boolean;

  @Prop()
  numTiles: number;

  get rewards (): Reward[] {
    return Reward.parse(tiles.federations[this.federation]);
  }

  get disabled () {
    return this.used || this.federation === FederationEnum.Fed1;
  }

  onClick () {
    if (!this.highlighted) {
      return;
    }
    this.$store.dispatch("gaiaViewer/federationClick", this.federation);
  }

  get highlighted () {
    return this.$store.state.gaiaViewer.context.highlighted.federations.has(this.federation);
  }
}

</script>

<style lang="scss">

g {
  &.federationTile {
    polygon {
      stroke: #333;
      stroke-width: 0.02;
      fill: #c9ffca;
    }

    text {
      text-anchor: middle;
      dominant-baseline: middle;
      font-size: 12px;
      pointer-events: none;
    }

    &.highlighted polygon {
      stroke: #2C4;
      cursor: pointer;
      stroke-width: 0.04;
    }
  }
}

</style>
