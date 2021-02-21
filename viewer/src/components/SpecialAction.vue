<template>
  <svg viewBox="-25 -25 50 50" width="50" height="50" style="overflow: visible">
    <g :class="['specialAction', { highlighted: isHighlighted, disabled, board }]">
      <polygon
        points="-10,4 -4,10 4,10 10,4 10,-4 4,-10 -4,-10 -10,-4"
        transform="scale(2.4)"
        @click="onClick"
        :class="`${planet != null ? 'planet-fill ' + planet : ''}`"
      />
      <!-- <Resource v-for="(reward, i) in rewards" :key=i :count=reward.count :kind=reward.type :transform="`translate(${rewards.length > 1 ? (i - 0.5) * 20  : 0}, ${reward.type === 'pw' ? 4 : 0}), scale(1.5)`" />-->
      <TechContent
        :content="act"
        v-for="(act, i) in action"
        :key="i"
        :transform="`translate(0, ${(i - (action.length - 1) / 2) * 24}) scale(${action.length === 1 ? 0.8 : 0.55})`"
      />
    </g>
    <g v-if="disabled">
      <line y1="-14" y2="14" x1="-14" x2="14" stroke="#333" stroke-width="5" />
      <line y1="14" y2="-14" x1="-14" x2="14" stroke="#333" stroke-width="5" />
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Event, Planet } from "@gaia-project/engine";

@Component
export default class SpecialAction extends Vue {
  @Prop({ default: false })
  disabled: boolean;

  @Prop({ default: false })
  highlighted: boolean;

  @Prop({ default: false })
  board: boolean;

  @Prop()
  action: string[];

  @Prop()
  planet: Planet;

  onClick() {
    if (!this._highlighted) {
      this.$emit("click");
      return;
    }
    this.$store.dispatch("gaiaViewer/actionClick", this.action.join(","));
  }

  get rewards() {
    return new Event(this.action[0]).rewards;
  }

  /** When the action content is highlighted - not the parent component */
  get _highlighted() {
    return (
      this.$store.state.gaiaViewer.context.highlighted.actions.has(this.action.join(",")) ||
      this.$store.state.gaiaViewer.context.highlighted.actions.has(this.action.join(",").replace(/>/g, ""))
    );
  }

  get isHighlighted() {
    return this.highlighted || this._highlighted;
  }
}
</script>

<style lang="scss">
@import "../stylesheets/planets.scss";

g {
  &.specialAction {
    & > polygon {
      stroke: black;
      stroke-width: 0.5;
      fill: $specialAction;
    }

    &.board > polygon:not(.planet-fill) {
      fill: $systemGray6;
    }

    &.highlighted > polygon {
      stroke: $highlighted;
      stroke-width: 1;
      cursor: pointer;
    }

    &.disabled {
      opacity: 0.5;
    }
  }
}
</style>
