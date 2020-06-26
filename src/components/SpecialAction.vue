<template>
  <svg viewBox="-25 -25 50 50" width="50" height="50" style="overflow: visible">
    <g :class='["specialAction", {highlighted: isHighlighted, disabled}]'>
      <polygon points="-10,4 -4,10 4,10 10,4 10,-4 4,-10 -4,-10 -10,-4" transform="scale(2.4)" @click="onClick" />
      <!-- <Resource v-for="(reward, i) in rewards" :key=i :count=reward.count :kind=reward.type :transform="`translate(${rewards.length > 1 ? (i - 0.5) * 20  : 0}, ${reward.type === 'pw' ? 4 : 0}), scale(1.5)`" />-->
      <TechContent :content="act" v-for="(act, i) in action" :key=i :transform="`translate(0, ${(i - (action.length-1)/2) * 24}) scale(${action.length === 1 ? 0.8 : 0.55})`" />
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { tiles, Event, Reward } from '@gaia-project/engine';
import { eventDesc } from '../data/event';

@Component
export default class SpecialAction extends Vue {
  @Prop({ default: false })
  disabled: boolean;

  @Prop({ default: false })
  highlighted: boolean;

  @Prop()
  action: string[];

  onClick () {
    if (!this.isHighlighted) {
      this.$emit("click");
      return;
    }
    this.$store.dispatch("gaiaViewer/actionClick", this.action.join(","));
  }

  get rewards () {
    return new Event(this.action[0]).rewards;
  }

  get isHighlighted () {
    return this.highlighted || this.$store.state.gaiaViewer.context.highlighted.actions.has(this.action.join(","));
  }
}

</script>

<style lang="scss">

g {
  &.specialAction {
    & > polygon {
      stroke: black;
      stroke-width: 0.5;
      fill: orange;
    }

    &.highlighted > polygon {
      stroke: #2C4;
      cursor: pointer;
    }

    &.disabled {
      opacity: 0.5;
    }
  }
}

</style>
