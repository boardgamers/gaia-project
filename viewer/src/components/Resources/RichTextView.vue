<template>
  <div class="d-flex flex-wrap" style="justify-content: center; align-items: center">
    <template v-for="(c, i) in filteredContent">
      <svg
        v-if="c.rewards != null"
        :viewBox="`-10 -13 ${c.rewards.length * 20} 25`"
        :width="width(c.rewards)"
        height="36"
        :key="i"
      >
        <Resource
          v-for="(r, j) in c.rewards"
          :key="j"
          :transform="`translate(${j * 20}, ${y(r.type)}) scale(${scale(r.type)})`"
          :kind="r.type"
          :count="r.count"
        />
      </svg>
      <svg v-else-if="c.text === 'arrow'" :key="i" viewBox="0 0 10 10" width="20" height="20">
        <use xlink:href="#arrow" x="-2" y="5" />
      </svg>
      <div v-else v-html="c.text" :key="i" class="text" />
    </template>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { RichText, richTextArrow, RichTextElement } from "../../graphics/utils";
import { Resource } from "@gaia-project/engine";
import Reward from "@gaia-project/engine/src/reward";
import { plusReward } from "../../logic/utils";

@Component
export default class RichTextView extends Vue {
  @Prop()
  content: RichText;

  get filteredContent(): RichText {
    return this.content.flatMap(c => {
      if (c.rewards) {
        return c.rewards.map(r => ({rewards:[r]} as RichTextElement));
      }
      return c;
    });
  }

  scale(r: Resource): number {
    switch (r) {
      case Resource.VictoryPoint:
        return 1.3;
      case Resource.ChargePower:
      case Resource.PayPower:
        return 1;
    }
    return 1.15;
  }

  y(r: Resource): number {
    switch (r) {
      case Resource.ChargePower:
      case Resource.PayPower:
        return 2;
    }
    return 0;
  }

  width(rewards: Reward[]): number {
    return rewards[0].count as any == '+' ? 15 : rewards.length * 30;
  }
}
</script>

<style lang="scss" scoped>
.text {
  margin: 2px;
}
</style>
