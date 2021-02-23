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
  animation: warn 7s linear infinite;
  stroke-width: 5;
  stroke-dasharray: 10 4;
}

@keyframes warn {
  100% {
    transform: rotateZ(360deg);
  }
}

g.recent .player-token {
  animation: recent 7s linear infinite;
}
g.recent.warn .player-token {
  animation: recent-warn 7s linear infinite;
}

@keyframes recent {
  50% {
    fill: var(--recent);
  }
  100% {
    transform: rotateY(360deg);
  }
}
@keyframes recent-warn {
  50% {
    fill: var(--recent);
  }
  100% {
    transform: rotateY(360deg) rotateZ(360deg);
  }
}

g.current-round .player-token {
  animation: current-round 7s linear infinite;
  opacity: 0.5;
}
g.current-round.warn .player-token {
  animation: current-round-warn 7s linear infinite;
}

@keyframes current-round {
  50% {
    fill: var(--current-round);
  }
  100% {
    transform: rotateY(360deg);
  }
}
@keyframes current-round-warn {
  50% {
    fill: var(--current-round);
  }
  100% {
    transform: rotateY(360deg) rotateZ(360deg);
  }
}
</style>
