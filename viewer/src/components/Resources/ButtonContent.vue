<template>
  <div class="d-flex" style="justify-content: center; align-items: center">
    <div v-if="frontLabel" v-html="frontLabel"></div>
    <svg
      v-if="button.conversion"
      :viewBox="`2 -13 ${(from + to) * 8} 20`"
      :width="hasTo ? (from + to) * 28 + 37 : from * 28 + 17"
      height="30"
    >
      <Resource
        v-for="(r, i) in button.conversion.from"
        :key="i"
        :kind="r.type"
        :count="Number(r.count)"
        :transform="`translate(${i * 16 + (hasTo ? -8 : 8 - 3 * from)}, -3)`"
      />
      <use v-if="hasTo" xlink:href="#arrow" x="5" y="0" transform="translate(-2, -2.5)" />
      <Resource
        v-for="(r, i) in button.conversion.to"
        :key="i + 20"
        :kind="r.type"
        :count="Number(r.count)"
        :transform="`translate(${(i + from + 1) * 16 + -6}, -3)`"
      />
    </svg>
    <div v-if="backLabel" v-html="backLabel"></div>
    <span class="sr-only">{{ button.tooltip }}</span>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { ButtonData } from "../../data";
import { withShortcut } from "../../logic/buttons/shortcuts";

@Component
export default class ButtonContent extends Vue {
  @Prop()
  button: ButtonData;

  get hasTo(): boolean {
    return this.button.conversion?.to?.length > 0;
  }

  get from(): number {
    return this.button.conversion.from.length;
  }

  get to(): number {
    return this.button.conversion.to.length;
  }

  get frontLabel(): string {
    return this.hasTo ? null : this.htmlLabel;
  }

  get backLabel(): string {
    return this.hasTo ? this.htmlLabel : null;
  }

  get htmlLabel(): string {
    const l = this.button.label || this.button.command;
    const s = this.button.shortcuts;
    if (l && s?.length > 0) {
      const shortcut = s[0];
      if (shortcut == "Enter" || l.includes("<u>")) {
        return l;
      }
      return withShortcut(l, shortcut);
    }
    return l;
  }

}
</script>
