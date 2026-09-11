<template>
  <svg viewBox="-25 -25 50 50" width="50" height="50">
    <g :class="['old-special-action', { highlighted: isHighlighted, disabled }]">
      <polygon
        points="-1,0.5 -0.5,1 0.5,1 1,0.5 1,-0.5 0.5,-1 -0.5,-1 -1,-0.5"
        transform="scale(24)"
        @click="onClick"
      />
      <text>
        <tspan x="0" v-for="(line, i) in lines" :dy="`${i === 0 ? -0.5 * (lines.length - 1) * 11 : 11}px`" :key="i">
          {{ line.replace(/ /g, "") }}
        </tspan>
      </text>
    </g>
  </svg>
</template>

<script lang="ts">
import { Component } from "vue-property-decorator";
import CurrentAction from "../../../viewer/src/components/SpecialAction.vue";
@Component
export default class SpecialAction extends CurrentAction {
  get lines() {
    return this.income.split(",");
  }
}
</script>

<style lang="scss">
g {
  &.old-special-action {
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
      stroke: #2c4;
      cursor: pointer;
      stroke-width: 0.04;
    }

    &.disabled {
      stroke-opacity: 0.6;
      fill-opacity: 0.3;

      text {
        fill: #000;
      }
    }
  }
}
</style>
