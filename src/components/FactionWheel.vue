<template>
  <g>
    <circle :r="r" fill="none" />
    <g
      v-for="i in [0, 1, 2, 3, 4, 5, 6]"
      :key="i"
      :transform="
        `translate(${r * Math.sin(((-180 + i * 51) * Math.PI) / 180)}, ${r *
          Math.cos(((-180 + i * 51) * Math.PI) / 180)})`
      "
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
import Engine, { factions, Planet } from "@gaia-project/engine";

@Component
export default class FactionWheel extends Vue {
  get r () {
    return 3;
  }

  get gameData (): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  remainingPlanets (planet: string) {
    return Array.from(this.gameData.map.grid.values()).filter(hex => !hex.occupied() && hex.data.planet === planet)
      .length;
  }

  strokeWidth (pos: number) {
    const planet = this.planet(pos);
    if (this.gameData.players.some(p => p.faction && factions[p.faction].planet === planet)) {
      return "0.2px; stroke-dasharray:.5 .2";
    }

    return "0.05px";
  }

  planet (pos: number) {
    const list = [
      Planet.Terra,
      Planet.Oxide,
      Planet.Volcanic,
      Planet.Desert,
      Planet.Swamp,
      Planet.Titanium,
      Planet.Ice,
      Planet.Gaia,
      Planet.Transdim
    ];
    if (pos < 7) {
      const data = this.gameData;
      const player = this.$store.state.gaiaViewer.player?.index ?? data.currentPlayer;
      const faction = data.player(player).faction;
      if (faction != null) {
        // own faction - or current players faction - should be at the top
        const planet = factions[faction].planet;
        const offset = list.indexOf(planet);
        return list[(pos + offset) % 7];
      }
    }
    return list[pos];
  }

  planetFill (planet: string) {
    if (planet === Planet.Titanium || planet === Planet.Swamp) {
      return "white";
    }
    return "black";
  }
}
</script>
<style lang="scss" scoped>
circle {
  stroke-width: 0.05px;
  stroke: black;
}
</style>
