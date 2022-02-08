<template>
  <svg viewBox="-25 -25 50 50" width="50" height="50" style="overflow: visible">
    <g :class="['federationTile', { disabled }]">
      <image xlink:href="../assets/conditions/federation.svg" :height=739/636*50 v-if="!disabled" style="color: #247B0A"
      width=50 x=-25 y=-25 :filter=filter /> <image xlink:href="../assets/conditions/federation-used.svg"
      v-if="disabled" :height=739/636*50 style="color: #247B0A" width=50 x=-25 y=-25 :filter=filter />
      <circle cx="16.5" cy="-16.5" r="8" stroke="black" stroke-width="1" fill="white" v-if="numTiles > 1" />
      <text x="16.5" y="-15.5" v-if="numTiles > 1">
        {{ numTiles }}
      </text>
      <g v-if="federation !== undefined">
        <Resource
          v-for="(reward, i) in rewards"
          :key="i"
          :count="reward.count"
          :kind="reward.type"
          :transform="`translate(${i === 2 ? 0 : (i - Math.min(rewards.length - 1, 1) / 2) * 22}, ${
            rewards.length === 1 ? 12.5 : i === 2 ? -7 : 10
          })`"
        />
      </g>
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Federation as FederationEnum, Reward } from "@gaia-project/engine";
import { federationRewards } from "@gaia-project/engine/src/tiles/federations";

@Component
export default class FederationTile extends Vue {
  @Prop()
  federation: FederationEnum;

  @Prop()
  used: boolean;

  @Prop({ default: "" })
  filter: string;

  @Prop()
  numTiles: number;

  get rewards(): Reward[] {
    return federationRewards(this.federation);
  }

  get disabled() {
    return this.used || this.federation === FederationEnum.Fed1;
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
  }
}
</style>
