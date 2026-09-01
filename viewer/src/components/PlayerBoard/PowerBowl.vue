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
      v-if="gaia && data.gaiaformersInGaia > 0"
      :kind="'gf'"
      :count="data.gaiaformersInGaia"
      :faction="player.faction"
      :transform="`translate(0, 0.7) scale(0.09)`"
    />
  </g>
</template>

<script lang="ts">
import Engine, { Player, PlayerData, PowerArea } from "@gaia-project/engine";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import type { FastConversionEvent } from "../../data/actions";
import Resource from "../Resource.vue";

@Component({
  components: {
    Resource,
  },
})
export default class PowerBowl extends Vue {
  @Prop()
  area: PowerArea;

  @Prop()
  player: Player;

  // The bowl counts/brainstone/gaiaformers to render - kept separate from `player` so a caller can
  // show a different faction's starting values (e.g. a not-yet-loaded real board during the faction
  // pick/bid setup phases) while `player` itself still drives identity-bound behavior (whose turn it
  // is, which seat a click should act on).
  @Prop()
  data: PlayerData;

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
    return this.area == PowerArea.Gaia && this.data.gaiaformersInGaia > 0 ? -0.5 : 0;
  }

  get power() {
    return this.data.power[this.area];
  }

  get gaia() {
    return this.area == PowerArea.Gaia;
  }

  get brainstone(): boolean {
    return this.data.brainstone === this.area;
  }
}
</script>
