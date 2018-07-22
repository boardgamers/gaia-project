<template>
  <svg viewBox="-25 -25 50 50" width="50" height="50">
    <g :class='["specialAction", {highlighted, disabled}]'>
      <polygon points="-1,0.5 -0.5,1 0.5,1 1,0.5 1,-0.5 0.5,-1 -0.5,-1 -1,-0.5" transform="scale(24)" />
      <text>
        <tspan x="0" v-for="(line, i) in income" :dy="`${i*1.25 - (income.length - 1) / 2.5}em`"> 
          {{line.replace(/ /g, '')}}
        </tspan>
      </text>
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { tiles, Event} from '@gaia-project/engine';
import { eventDesc } from '../data/event';

@Component<BoardAction>({
  computed: {
    highlighted() {
      return false;
    },

    income() {
      return this.action.split('-');
    }
  }
})
export default class BoardAction extends Vue {
  @Prop()
  disabled: boolean;

  @Prop()
  action: string
}

</script>

<style lang="scss">

g {
  &.specialAction {
    polygon {
      stroke: #333;
      stroke-width: 0.02;
      fill: orange;
    }

    text {
      fill: white;
      text-anchor: middle;
      dominant-baseline: middle;
      font-size: 12px;
      pointer-events: none;
    }

    &.highlighted polygon {
      stroke: #2C4;
    }

    &.disabled {
      stroke-opacity: 0.6;
      fill-opacity: 0.6;

      text {
        fill: #000;
      }
    }
  }
}

</style>
