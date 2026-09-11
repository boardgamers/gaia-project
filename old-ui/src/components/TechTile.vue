<template>
  <svg
    :class="['old-tech-tile', { highlighted, covered }]"
    v-show="this.count"
    v-b-tooltip
    :title="tooltip"
    @click="onClick"
    width="58"
    height="37"
    viewBox="0 0 58 37"
  >
    <polygon points="1,1 48,1 57,11 57,36 1,36" />
    <text class="title" x="4" y="12">{{ title }}</text>
    <text :class="['content', { smaller: content.length >= 10 }]" x="4" y="30">{{ content }}</text>
  </svg>
</template>

<script lang="ts">
import { spaceshipTechSpec } from "@gaia-project/engine/src/tiles/spaceship-techs";
import { Component } from "vue-property-decorator";
import CurrentTechTile from "../../../viewer/src/components/TechTile.vue";
import { eventDesc } from "../../../viewer/src/data/event";
@Component
export default class TechTile extends CurrentTechTile {
  get rawContent() {
    return this.event?.toString() ?? "";
  }
  get content() {
    return this.isRangeTile ? "+1 range" : this.isTerraformMineTile ? "2step + mine" : this.rawContent;
  }
  get title() {
    return this.pos;
  }
  get tooltip() {
    return spaceshipTechSpec[this.tile] ?? (this.event ? eventDesc(this.event, this.engine.expansions, true) : "");
  }
}
</script>

<style lang="scss">
svg {
  &.old-tech-tile {
    polygon {
      stroke: #333;
      stroke-width: 1px;
      fill: white;
    }
    .title {
      font-size: 10px;
      font-weight: bold;
      fill: #212529;
      text-anchor: start;
      pointer-events: none;
    }
    .content {
      font-size: 11px;
      fill: #212529;
      pointer-events: none;

      &.smaller {
        font-size: 9px;
      }
    }

    &.highlighted polygon {
      stroke: #2c4;
      cursor: pointer;
    }

    &.covered {
      stroke-opacity: 0.5;
      fill-opacity: 0.7;
    }
  }
}
</style>
