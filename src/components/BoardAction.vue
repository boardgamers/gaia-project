<template>
  <g :class='["boardAction", kind, {highlighted}]' v-b-tooltip :title="tooltip">
    <SpecialAction :class='{faded}' :action="boardActions[action].income" :highlighted=highlighted :board=true x=-20 y=-25 width=40 @click="onClick" />
    <g transform=translate(-15,-15)>
      <image v-if="kind === 'power'" xlink:href='../assets/resources/power-charge.svg' width=20 :height=133/345*20 transform=" scale(-1,1) translate(-9, -12)" />
      <rect x=-8 y=-8 width=16 height=16 :rx="kind === 'power' ? 8 : 0" :ry="kind === 'power' ? 8 : 0" stroke="black" stroke-width="1" :fill="kind === 'power' ? '#984FF1' : 'green'" transform=scale(0.8) v-if="costNumber>1" />
      <text x="-3" y="3.5" v-if="costNumber>1" fill="white" style="fill: white !important">
          {{costNumber}}
      </text>
    </g>
    <g v-if="faded">
      <line y1="-11" y2="11" x1=-11 x2=11 stroke=#333 stroke-width=5 />
      <line y1="11" y2="-11" x1=-11 x2=11 stroke=#333 stroke-width=5 />
    </g>
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { tiles, Event, BoardAction as BoardActionEnum, boardActions, Reward } from '@gaia-project/engine';
import { eventDesc } from '../data/event';
import Resource from './Resource.vue';
import SpecialAction from './SpecialAction.vue';

@Component<BoardAction>({
  components: {
    Resource,
    SpecialAction
  }
})
export default class BoardAction extends Vue {
  @Prop()
  action: BoardActionEnum;

  onClick () {
    if (!this.highlighted) {
      return;
    }
    this.$store.dispatch("gaiaViewer/actionClick", this.action);
  }

  get highlighted () {
    return this.$store.state.gaiaViewer.context.highlighted.actions.has(this.action);
  }

  get tooltip () {
    const costDesc = "Spend " + this.cost + "\n";

    return costDesc + boardActions[this.action].income.map(x => eventDesc(new Event(x))).join('\n');
  }

  get faded () {
    return !this.$store.state.gaiaViewer.data.boardActions[this.action];
  }

  get kind () {
    return this.action[0] === 'p' ? 'power' : 'qic';
  }

  get rewards () {
    return boardActions[this.action].income.map(x => new Reward(x));
  }

  get income () {
    return [].concat(...boardActions[this.action].income.map(x => {
      if (x.includes('+')) {
        return [x.slice(0, x.indexOf('+')), x.slice(x.indexOf('+'))];
      }
      return x.split('-');
    }));
  }

  get cost () {
    return boardActions[this.action].cost;
  }

  get costNumber () {
    return new Reward(this.cost).count;
  }

  boardActions=boardActions;
}

</script>

<style lang="scss">
@import '../stylesheets/planets.scss';

g {
  &.boardAction {
    & > polygon {
      stroke: #333;
      stroke-width: 0.02;
    }

    &.qic {
      & > polygon {
        fill: $res-qic;
      }
    }

    &.power {
      & > polygon {
        fill: $res-power;
      }
    }

    & > text {
      fill: white;
      text-anchor: middle;
      dominant-baseline: middle;
      font-size: 12px;
      pointer-events: none;
    }

    &.highlighted > polygon {
      stroke: $highlighted;
      cursor: pointer;
      stroke-width: 0.08;
    }

  }

  .faded {
      opacity: 0.5;
    }
}

</style>
