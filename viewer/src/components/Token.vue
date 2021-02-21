<template>
  <g>
    <circle cx="0" cy="0" r="20" :class="['player-token', 'planet-fill', planetClass]" />
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { factions, Faction, Planet } from "@gaia-project/engine";
import { planetClass } from "../graphics/utils";

@Component
export default class PlayerToken extends Vue {
  @Prop()
  faction: Faction | "automa";

  get planetClass() {
    return planetClass(this.faction);
  }
}
</script>

<style lang="scss">
g .player-token {
  stroke: #111;
  pointer-events: none;
  stroke-width: 3;
}
g.warn .player-token {
  stroke-width: 5;
  animation: token 2s linear infinite;
}

@keyframes token {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.8);
  }
  100% {
    transform: scale(1);
  }
}
</style>
