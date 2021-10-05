<template>
  <g>
    <path
      :transform="`scale(0.16) translate(-8,-8)`"
      d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"
    />
    <circle class="rules-button" r="1.6" v-b-modal="'rules'" />
    <circle :r="r" fill="none" />
    <g
      v-for="i in [0, 1, 2, 3, 4, 5, 6]"
      :key="i"
      :transform="`translate(${r * Math.sin(((-180 + i * 51) * Math.PI) / 180)}, ${
        r * Math.cos(((-180 + i * 51) * Math.PI) / 180)
      })`"
    >
      <circle :r="1" :class="['planet-fill', planet(i)]" :style="`stroke-width: ${strokeWidth(i)}`" />
      <text
        :style="`font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(planet(i))}`"
      >
        {{ remainingPlanets(planet(i)) }}
      </text>
    </g>
    <g v-for="i in [7, 8]" :key="i" :transform="`translate(${-2 + (i - 7) * 4}, 5)`">
      <circle :r="1" :class="['planet-fill', planet(i)]" />
      <text
        :style="`font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(planet(i))}`"
      >
        {{ remainingPlanets(planet(i)) }}
      </text>
    </g>
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component } from "vue-property-decorator";
import { planetFill } from "../graphics/utils";
import Engine, { factionPlanet, Planet } from "@gaia-project/engine";

@Component
export default class FactionWheel extends Vue {
  get r() {
    return 3;
  }

  get gameData(): Engine {
    return this.$store.state.data;
  }

  remainingPlanets(planet: string) {
    return Array.from(this.gameData.map.grid.values()).filter((hex) => !hex.occupied() && hex.data.planet === planet)
      .length;
  }

  strokeWidth(pos: number) {
    const planet = this.planet(pos);
    if (this.gameData.players.some((p) => p.faction && factionPlanet(p.faction) === planet)) {
      return "0.2px; stroke-dasharray:.5 .2";
    }

    return "0.05px";
  }

  planet(pos: number) {
    const list = [
      Planet.Terra,
      Planet.Oxide,
      Planet.Volcanic,
      Planet.Desert,
      Planet.Swamp,
      Planet.Titanium,
      Planet.Ice,
      Planet.Gaia,
      Planet.Transdim,
    ];
    if (pos < 7) {
      const data = this.gameData;
      const player = this.$store.state.player?.index ?? data.currentPlayer;
      const faction = data.player(player)?.faction;
      if (faction != null) {
        // own faction - or current players faction - should be at the top
        const planet = factionPlanet(faction);
        const offset = list.indexOf(planet);
        return list[(pos + offset) % 7];
      }
    }
    return list[pos];
  }

  planetFill(planet: string) {
    return planetFill(planet);
  }
}
</script>
<style lang="scss" scoped>
circle {
  stroke-width: 0.05px;
  stroke: black;
}

.rules-button {
  cursor: pointer;
  opacity: 0;
}
</style>
