<template>
  <g :class='["boardAction", kind, {highlighted, faded}]' v-b-tooltip :title="tooltip">
    <g>
      <polygon points="-1,0.5 -0.5,1 0.5,1 1,0.5 1,-0.5 0.5,-1 -0.5,-1 -1,-0.5" :transform="`scale(${scale})`" />
      <text :transform="`scale(${scale/17})`">
        <tspan x="0" v-for="(line, i) in income" :dy="`${i*1.15 - (income.length - 1) / 2.5}em`"> 
          {{line.replace(/ /g, '')}}
        </tspan>
      </text>
    </g>
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { tiles, Event, BoardAction as BoardActionEnum, boardActions } from '@gaia-project/engine';
import { eventDesc } from '../data/event';

@Component<BoardAction>({
  computed: {
    tooltip() {
      if (this.income.length === 1) {
        return eventDesc(new Event(this.income[0]));
      } else {
        return this.income.map(income => "- " + eventDesc(new Event(income))).join("\n");
      }
      return ''; // eventDesc(new Event(this.content));
    },

    highlighted() {
      return false; // this.$store.state.game.data.round === 0;
    },

    faded() {
      return !this.$store.state.game.data.boardActions[this.action];
    },

    kind() {
      return this.action[0] === 'p' ? 'power' : 'qic';
    },

    income() {
      return boardActions[this.action].income;
    }
  }
})
export default class BoardAction extends Vue {
  @Prop()
  scale: number;

  @Prop()
  action: BoardActionEnum
}

</script>

<style lang="scss">

g {
  &.boardAction {
    polygon {
      stroke: #333;
      stroke-width: 0.02;
      fill: white;
    }

    &.qic {
      polygon {
        fill: green;
      }
    }

    &.power {
      polygon {
        fill: purple;
      }
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

    &.faded {
      stroke-opacity: 0.5;
      fill-opacity: 0.5;
    }
  }
}

</style>
