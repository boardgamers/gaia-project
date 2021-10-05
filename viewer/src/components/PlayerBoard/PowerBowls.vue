<template>
  <g class="power-bowls">
    <line
      x1="0"
      y1="0"
      :x2="-r * spacing"
      :y2="(isTerran ? -1 : 1) * 2 * r * sin60 * spacing"
      stroke="black"
      stroke-width="0.06px"
    />
    <circle :r="2 * r * spacing" fill="none" />
    <g>
      <PowerBowl :player="player" area="gaia" class="gaia-bowl" gaia="true" />
    </g>
    <g :transform="`translate(${-r * spacing}, ${2 * r * sin60 * spacing})`">
      <PowerBowl :player="player" area="area1" class="power-bowl" />
      <text y="1.7" transform="scale(0.7)" v-if="!engine.isLastRound && income('t')">+{{ income("t") }}</text>
      <text class="label" x="-2.6">I</text>
    </g>
    <g :transform="`translate(${-r * spacing}, ${-2 * r * sin60 * spacing})`">
      <PowerBowl :player="player" area="area2" class="power-bowl" />
      <text class="label" x="-2.6">II</text>
    </g>
    <g :transform="`translate(${2 * r * spacing}, 0)`">
      <PowerBowl :player="player" area="area3" class="power-bowl" />
      <text class="label" y="2.6" x="0">III</text>
    </g>
    <text class="label" transform="translate(-3.5, 0) scale(0.75)" v-if="!engine.isLastRound && income('pw')"
      >+{{ income("pw") }}
    </text>
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Resource from "../Resource.vue";
import Engine, { Faction, Player, Resource as ResourceEnum } from "@gaia-project/engine";
import PowerBowl from "./PowerBowl.vue";

@Component<PowerBowls>({
  components: {
    Resource,
    PowerBowl,
  },
})
export default class PowerBowls extends Vue {
  @Prop()
  player: Player;

  get engine(): Engine {
    return this.$store.state.data;
  }

  get isTerran() {
    return this.player.faction === Faction.Terrans;
  }

  get r() {
    return 2;
  }

  get spacing() {
    return 1.1;
  }

  get sin60() {
    return 0.86602540378;
  }

  income(resource: ResourceEnum) {
    const index = this.player.income.search(new RegExp("[0-9]+" + resource));

    if (index < 0) {
      return 0;
    }

    return parseInt(this.player.income.substr(index));
  }
}
</script>
<style lang="scss">
.power-bowls {
  circle {
    stroke-width: 0.05px;
    stroke: black;
  }

  .gaia-bowl circle {
    fill: #00aa00;
  }

  .power-bowl circle {
    fill: purple;
  }

  .power {
    fill: var(--res-power);
  }

  .brainstone {
    fill: var(--res-power);
  }

  text {
    fill: white;
    font-size: 1.2px;
    text-anchor: middle;
    dominant-baseline: mathematical;

    &.label {
      fill: #333;
    }
  }
}
</style>
