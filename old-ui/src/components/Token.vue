<template>
  <g>
    <circle cx="0" cy="0" r="1" :transform="`scale(${scale})`" :class="['player-token', 'planet-fill', renderPlanet]" />
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Faction, Planet, factionPlanet } from "@gaia-project/engine";

@Component
export default class PlayerToken extends Vue {
  @Prop()
  faction: Faction | "automa";

  @Prop()
  scale: number;

  @Prop()
  planet: Planet;

  get renderPlanet(): Planet {
    if (this.planet) {
      return this.planet;
    }
    return this.faction === "automa" ? Planet.Lost : factionPlanet(this.faction);
  }
}
</script>

<style lang="scss">
g .player-token {
  stroke: #111;
  pointer-events: none;
  stroke-width: 0.2;
}
</style>
