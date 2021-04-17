<template>
  <g>
    <circle cx="0" cy="0" r="20" :class="['player-token', 'planet-fill', planetClass]" />
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Faction } from "@gaia-project/engine";
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
  /* apparently really slow on some browsers - safari? */
  // animation: warn 10s linear infinite;
  stroke-width: 5;
  stroke-dasharray: 10 4;
}

@keyframes warn {
  100% {
    transform: rotateZ(360deg);
  }
}
</style>
