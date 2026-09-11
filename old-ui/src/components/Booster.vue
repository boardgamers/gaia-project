<template>
  <svg
    :class="['old-booster', { highlighted, disabled }]"
    v-b-tooltip
    :title="tooltip"
    @click="onClick"
    :width="tileWidth"
    height="50"
    :viewBox="`0 0 ${tileWidth} 50`"
  >
    <rect x="1" y="1" :width="tileWidth - 2" height="48" rx="5" ry="5" />
    <text class="title" x="6" y="12">{{ title }}</text>
    <text class="event1" x="6" y="30">{{ event1 && event1.toString() }}</text>
    <text class="event1" x="6" y="44">{{ event2 && event2.toString() }}</text>
  </svg>
</template>

<script lang="ts">
import { Component } from "vue-property-decorator";
import CurrentBooster from "../../../viewer/src/components/Booster.vue";
@Component
export default class Booster extends CurrentBooster {
  get title() {
    return this.booster.replace("booster-lostfleet-", "LF ").replace("booster", "Booster ");
  }
  get tileWidth() {
    return Math.max(
      76,
      ...[this.title, this.event1?.toString() ?? "", this.event2?.toString() ?? ""].map((text) => text.length * 6 + 12)
    );
  }
  onClick() {
    this.$emit("click");
  }
}
</script>

<style lang="scss">
svg {
  &.old-booster {
    rect {
      stroke: #333;
      stroke-width: 1px;
      fill: white;
    }
    .title {
      font-size: 10px;
      font-weight: bold;
      text-anchor: start;
      fill: #212529;
      pointer-events: none;
    }
    .event1,
    .event2 {
      font-size: 12px;
      pointer-events: none;
    }

    &.highlighted rect {
      stroke: #2c4;
      cursor: pointer;
    }

    &.disabled {
      stroke-opacity: 0.5;
      fill-opacity: 0.7;
    }
  }
}
</style>
