<template>
  <g>
    <circle
      :r="r"
      @click="convert"
      v-b-tooltip.hover.html
      :disabled="!convertTooltip"
      :style="convertTooltip ? 'cursor: pointer' : ''"
      :title="convertTooltip"
    />
    <Resource v-if="power > 0" :kind="'bowl-t'" :count="power" :transform="`translate(${xPos}, ${yPos}) scale(0.11)`" />
    <Resource
      v-if="brainstone"
      :kind="'brainstone'"
      :transform="`translate(${power > 0 ? 0.9 : 0}, ${yPos}) scale(0.11)`"
    />
    <Resource
      v-if="gaia && player.data.gaiaformersInGaia > 0"
      :kind="'gf'"
      :count="player.data.gaiaformersInGaia"
      :faction="player.faction"
      :transform="`translate(0, 0.7) scale(0.09)`"
    />
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, { Player, PowerArea } from "@gaia-project/engine";
import { FastConversionEvent } from "../../data/actions";

@Component
export default class PowerBowl extends Vue {
  @Prop()
  area: PowerArea;

  @Prop()
  player: Player;

  get r() {
    return 2;
  }

  convert() {
    this.$store.dispatch("fastConversionClick", { button: this.area as PowerArea } as FastConversionEvent);
  }

  get convertTooltip(): string {
    if (this.engine.currentPlayer == this.player.player) {
      return this.$store.state.context.fastConversionTooltips[this.area];
    }
    return null;
  }

  get engine(): Engine {
    return this.$store.state.data;
  }

  get xPos() {
    return this.brainstone ? -0.9 : 0;
  }

  get yPos() {
    return this.area == PowerArea.Gaia && this.player.data.gaiaformersInGaia > 0 ? -0.5 : 0;
  }

  get power() {
    return this.player.data.power[this.area];
  }

  get gaia() {
    return this.area == PowerArea.Gaia;
  }

  get brainstone(): boolean {
    return this.player.data.brainstone === this.area;
  }
}
</script>
