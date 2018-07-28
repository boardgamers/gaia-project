<template>
  <svg viewBox="-25 -25 50 50" width="50" height="50">
    <g :class='["federationTile", {highlighted, disabled}]'>
      <polygon points="-1,0.5 -0.5,1 0.5,1 1,0.5 1,-0.7 0.5,-1 -0.5,-1 -1,-0.7" transform="scale(24)" @click="onClick" />
      <circle cx="16.5" cy="-16.5" r="8" stroke="black" stroke-width="1" fill="white" v-if="this.numTiles>1" />
      <text x="16.5" y="-16.5" v-if="this.numTiles>1">
          {{numTiles}}
      </text>
      <text>
        <tspan x="0" v-for="(line, i) in income" :dy="`${i*1.5 - (income.length - 1) / 2.2}em`"> 
          {{line.replace(/ /g, '')}}
        </tspan>
      </text>
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { tiles, Event, Federation, PlayerEnum } from '@gaia-project/engine';
import { eventDesc } from '../data/event';

@Component<FederationTile>({
  computed: {
    highlighted() {
      return this.$store.state.game.context.highlighted.federations.has(this.federation);
    },

    income() {   
      const [first, ...others] = tiles.federations[this.federation].split(",");
      return others.length > 0 ? [first, others.join(", ")] : [first];
    },

    disabled() {
      return this.used || this.federation === Federation.Federation1;
    },

    numTiles() {
      const federationObject = this.$store.state.game.data.tiles.federations;
      if (this.player !== undefined) {
        return 1;
      }
      return federationObject[this.federation];
    }
  }
})
export default class FederationTile extends Vue {
  @Prop()
  federation: Federation;

  @Prop()
  used: boolean;

  @Prop()
  player: PlayerEnum;

  onClick() {
    if (!this.highlighted) {
      return;
    }
    this.$store.dispatch("federationClick", this.federation);
  }
}
export default interface Federation {
  highlighted: boolean;
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

    &.disabled {
      polygon {
        fill: #ddd;
      }
    }
  }
}

</style>
