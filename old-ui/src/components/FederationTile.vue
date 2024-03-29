<template>
  <svg viewBox="-25 -25 50 50" width="50" height="50">
    <g :class="['federationTile', { highlighted, disabled }]">
      <polygon
        points="-1,0.5 -0.5,1 0.5,1 1,0.5 1,-0.7 0.5,-1 -0.5,-1 -1,-0.7"
        transform="scale(24)"
        @click="onClick"
      />
      <circle cx="16.5" cy="-16.5" r="8" stroke="black" stroke-width="1" fill="white" v-if="numTiles > 1" />
      <text x="16.5" y="-15.5" v-if="numTiles > 1">
        {{ numTiles }}
      </text>
      <text>
        <tspan x="0" v-for="(line, i) in income" :key="i" :dy="`${i * 1.5 - (income.length - 1) / 2.2}em`">
          {{ line.replace(/ /g, "") }}
        </tspan>
      </text>
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Federation as FederationEnum } from "@gaia-project/engine";
import { federationRewards } from "@gaia-project/engine/src/tiles/federations";

@Component<FederationTile>({
  computed: {
    income() {
      const [first, ...others] = federationRewards(this.federation).map(r => r.toString());
      return others.length > 0 ? [first, others.join(", ")] : first.split("-");
    },

    disabled() {
      return this.used || this.federation === FederationEnum.Fed1;
    },
  },
})
export default class FederationTile extends Vue {
  @Prop()
  federation: FederationEnum;

  @Prop()
  used: boolean;

  @Prop()
  numTiles: number;

  onClick() {
    if (!this.highlighted) {
      return;
    }
    this.$store.dispatch("federationClick", this.federation);
  }

  get highlighted() {
    return this.$store.state.context.highlighted.federations.has(this.federation);
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
      stroke: #2c4;
      cursor: pointer;
      stroke-width: 0.04;
    }

    &.disabled {
      polygon {
        fill: #ddd;
      }
    }
  }
}
</style>
