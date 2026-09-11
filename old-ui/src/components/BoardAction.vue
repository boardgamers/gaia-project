<template>
  <g :transform="transform" :class="['old-board-action', kind, { highlighted, faded }]" v-b-tooltip :title="tooltip">
    <polygon
      points="-1,0.5 -0.5,1 0.5,1 1,0.5 1,-0.5 0.5,-1 -0.5,-1 -1,-0.5"
      :transform="`scale(${scale})`"
      @click="onClick"
    />
    <text :transform="`scale(${scale / 17})`">
      <tspan
        :x="i + 1 < income.length ? 1 : 0"
        v-for="(line, i) in income"
        :key="i"
        :dy="`${i * 1.15 - (income.length - 1) / 4}em`"
      >
        {{ line.replace(/ /g, "") }}
      </tspan>
    </text>
  </g>
</template>

<script lang="ts">
import { boardActions, Event } from "@gaia-project/engine";
import { Component, Prop } from "vue-property-decorator";
import CurrentBoardAction from "../../../viewer/src/components/BoardAction.vue";
import { eventDesc } from "../../../viewer/src/data/event";

@Component<BoardAction>({
  computed: {
    tooltip() {
      const costDesc = "Spend " + this.cost + "\n";

      return (
        costDesc +
        boardActions[this.action].income
          .map((x) => eventDesc(new Event(x), this.$store.state.data.expansions, true))
          .join("\n")
      );
    },

    faded() {
      return this.$store.state.data.boardActions[this.action] !== null;
    },

    kind() {
      return this.action[0] === "p" ? "power" : "qic";
    },

    income() {
      return [].concat(
        ...boardActions[this.action].income.map((x) => {
          if (x.includes("+")) {
            return [x.slice(0, x.indexOf("+")), x.slice(x.indexOf("+"))];
          }
          return x.split("-");
        })
      );
    },

    cost() {
      return boardActions[this.action].cost;
    },
  },
})
export default class BoardAction extends CurrentBoardAction {
  @Prop()
  scale: number;
}
</script>

<style lang="scss">
g {
  &.old-board-action {
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
      stroke: #2c4;
      cursor: pointer;
      stroke-width: 0.08;
    }

    &.faded {
      stroke-opacity: 0.5;
      fill-opacity: 0.5;
    }
  }
}
</style>
