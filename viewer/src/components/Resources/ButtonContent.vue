<template>
  <div class="d-flex" style="justify-content: center; align-items: center">
    <svg
      v-if="button.conversion"
      :viewBox="`2 -13 ${(button.conversion.from.length + button.conversion.to.length) * 8} 20`"
      :width="(button.conversion.from.length + button.conversion.to.length) * 28 + 7"
      height="30"
    >
      <Resource
        v-for="(r, i) in button.conversion.from"
        :key="i"
        :kind="r.type"
        :count="Number(r.count)"
        :transform="`translate(${i * 12 - 4}, -2) scale(.7)`"
      />
      <use xlink:href="#arrow" x="5" y="0" transform="translate(-4, -2)" />
      <Resource
        v-for="(r, i) in button.conversion.to"
        :key="i + 20"
        :kind="r.type"
        :count="Number(r.count)"
        :transform="`translate(${(i + button.conversion.from.length + 1) * 12 - 4}, -2) scale(.7)`"
      />
    </svg>
    <div v-html="htmlLabel"></div>
    <span class="sr-only">{{ button.tooltip }}</span>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { ButtonData } from "../../data";
import { withShortcut } from "../../logic/commands";

@Component
export default class ButtonContent extends Vue {
  @Prop()
  button: ButtonData;

  @Prop()
  customLabel: string;

  get htmlLabel(): string {
    const l = this.customLabel || this.button.label || this.button.command;
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
