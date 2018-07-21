<template>
  <g :class='["boardAction", {highlighted, faded}]' v-b-tooltip :title="tooltip">
    <polygon points="-1,0.5 -0.5,1 0.5,1 1,0.5 1,-0.5 0.5,-1 -0.5,-1 -1,-0.5" :transform="`scale(${scale})`" />
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { tiles, Event, BoardAction as BoardActionEnum } from '@gaia-project/engine';
import { eventDesc } from '../data/event';

@Component<BoardAction>({
  computed: {
    tooltip() {
      return ''; // eventDesc(new Event(this.content));
    },

    highlighted() {
      return false; // this.$store.state.game.data.round === 0;
    },

    faded() {
      return false; //this.$store.state.game.data.round > 0;
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
    // .title {
    //   font-family: sans-serif;
    //   font-size: 10px;
    //   font-weight: bold;
    //   pointer-events: none;
    // }
    // .content {
    //   font-family: sans-serif;
    //   font-size: 12px;
    //   pointer-events: none;
    // }

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
