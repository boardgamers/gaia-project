<template>
  <g>
    <use xlink:href="#info" :transform="`scale(0.11) translate(-8,-8)`" />
    <circle class="rules-button" r="1.6" v-b-modal="'rules'" />
    <circle :r="r" fill="none" />
    <g v-for="i in planetPositions" :key="i" :transform="translate(r, i)">
      <circle :r="1" :class="['planet-fill', planet(i)]" :style="`stroke-width: ${strokeWidth(i)}`" />
      <text
        :style="`font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(planet(i))}`"
      >
        {{ remainingPlanets(planet(i)) }}
      </text>
      <circle :r="1" style="cursor: pointer; opacity: 0" @click="togglePlanetHighlight(planet(i))" />
    </g>
    <g v-for="i in planetPositions" :key="`I${i}`" :transform="translate(1.4, i)">
      <text style="font-size: 0.75pt; text-anchor: middle; dominant-baseline: central; pointer-events: none">
        {{ factionInitial(planet(i)) }}
      </text>
    </g>
    <g v-for="i in [7, 8]" :key="i" :transform="`translate(${-2 + (i - 7) * 4}, 5)`">
      <circle :r="1" :class="['planet-fill', planet(i)]" />
      <text
        :style="`font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(planet(i))}`"
      >
        {{ remainingPlanets(planet(i)) }}
      </text>
      <circle :r="1" style="cursor: pointer; opacity: 0" @click="togglePlanetHighlight(planet(i))" />
    </g>
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component } from "vue-property-decorator";
import { planetFill } from "../graphics/utils";
import Engine, { factionPlanet, Planet } from "@gaia-project/engine";
import { radiusTranslate } from "../logic/utils";
import { MapMode } from "../data/actions";

const planets = [
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

@Component
export default class FactionWheel extends Vue {
  get r() {
    return 3;
  }

  get planetPositions(): number[] {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  translate(radius: number, index: number) {
    return radiusTranslate(radius, index, 7);
  }

  get gameData(): Engine {
    return this.$store.state.data;
  }

  remainingPlanets(planet: Planet) {
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

  factionInitial(planet: Planet): string {
    const player = this.gameData.players.find((p) => p.faction && factionPlanet(p.faction) === planet);
    return player ? player.faction.substr(0, 1).toUpperCase() : "";
  }

  planet(pos: number): Planet {
    if (pos < 7) {
      const data = this.gameData;
      const player = this.$store.state.player?.index ?? data.currentPlayer;
      const faction = data.player(player)?.faction;
      if (faction != null) {
        // own faction - or current players faction - should be at the top
        const planet = factionPlanet(faction);
        const offset = planets.indexOf(planet);
        return planets[(pos + offset) % 7];
      }
    }
    return planets[pos];
  }

  planetFill(planet: string) {
    return planetFill(planet);
  }

  togglePlanetHighlight(planet: Planet) {
    this.$store.commit("toggleMapMode", { type: "planetType", planet  } as MapMode);
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
