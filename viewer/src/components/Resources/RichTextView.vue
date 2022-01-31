<template>
  <div class="d-flex flex-wrap" style="justify-content: center; align-items: center">
    <template v-for="(c, i) in filteredContent">
      <svg
        v-if="c.rewards != null"
        :viewBox="`-10 -13 ${c.rewards.length * 20} 25`"
        :width="c.rewards.length * 30"
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
import { RichText } from "../../graphics/utils";
import { Resource } from "@gaia-project/engine";

@Component
export default class RichTextView extends Vue {
  @Prop()
  content: RichText;

  get filteredContent() {
    return this.content.filter((c) => c?.rewards?.length > 0 || c?.text?.length > 0);
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
}
</script>

<style lang="scss" scoped>
.text {
  margin: 2px;
}
</style>
