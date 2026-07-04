<template>
  <g>
    <use xlink:href="#info" :transform="`scale(0.11) translate(-8,-8)`" />
    <circle class="rules-button" r="1.6" v-b-modal="'rules'" />
    <circle :r="r" fill="none" />
    <g
      v-for="i in planetPositions"
      :key="i"
      class="faction-wheel-planet"
      :data-planet="ringPlanet(i)"
      :transform="translate(r, i)"
    >
      <circle :r="1" :class="['planet-fill', ringPlanet(i)]" :style="`stroke-width: ${strokeWidth(ringPlanet(i))}`" />
      <text
        :style="`font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(ringPlanet(i))}`"
      >
        {{ remainingPlanets(ringPlanet(i)) }}
      </text>
      <circle :r="1" style="cursor: pointer; opacity: 0" @click="togglePlanetHighlight(ringPlanet(i))" />
    </g>
    <g v-for="i in planetPositions" :key="`I${i}`" :transform="translate(1.4, i)">
      <text style="font-size: 0.75pt; text-anchor: middle; dominant-baseline: central; pointer-events: none">
        {{ factionInitial(ringPlanet(i)) }}
      </text>
    </g>
    <g
      v-for="slot in extraPlanetSlots"
      :key="slot.planet"
      class="faction-wheel-planet faction-wheel-extra-planet"
      :data-planet="slot.planet"
      :transform="`translate(${slot.x}, ${slot.y})`"
    >
      <circle :r="1" :class="['planet-fill', slot.planet]" :style="`stroke-width: ${strokeWidth(slot.planet)}`" />
      <text
        :style="`font-size: 1.1px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(slot.planet)}`"
      >
        {{ remainingPlanets(slot.planet) }}
      </text>
      <circle :r="1" style="cursor: pointer; opacity: 0" @click="togglePlanetHighlight(slot.planet)" />
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
import { remainingPlanets } from "../data/planets";

const ringPlanets = [
  Planet.Terra,
  Planet.Oxide,
  Planet.Volcanic,
  Planet.Desert,
  Planet.Swamp,
  Planet.Titanium,
  Planet.Ice,
];

const standardExtraPlanets = [Planet.Gaia, Planet.Transdim];
const lostFleetExtraPlanets = [Planet.Asteroid, Planet.Protoplanet];

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
    return remainingPlanets(planet, this.gameData);
  }

  strokeWidth(planet: Planet) {
    if (this.gameData.players.some((p) => p.faction && factionPlanet(p.faction) === planet)) {
      return "0.2px; stroke-dasharray:.5 .2";
    }

    return "0.05px";
  }

  get extraPlanetSlots(): Array<{ planet: Planet; x: number; y: number }> {
    const planets = this.gameData.options.lostFleet
      ? [...standardExtraPlanets, ...lostFleetExtraPlanets]
      : standardExtraPlanets;

    // Circle markers (matching the ring's own planet circles) in a compact 2-column grid instead
    // of a single wide row: narrower than the 7-planet ring itself, so it no longer widens the
    // wheel's overall footprint - the map has more room to use the freed-up width. Spacing is
    // larger than the circles' own diameter (2x radius-1) so they don't touch edge-to-edge.
    const spacing = 2.6;
    const columns = 2;
    const startX = -((columns - 1) * spacing) / 2;
    return planets.map((planet, index) => ({
      planet,
      x: startX + (index % columns) * spacing,
      y: 4.6 + Math.floor(index / columns) * spacing,
    }));
  }

  factionInitial(planet: Planet): string {
    const player = this.gameData.players.find((p) => p.faction && factionPlanet(p.faction) === planet);
    return player ? player.faction.substr(0, 1).toUpperCase() : "";
  }

  ringPlanet(pos: number): Planet {
    const data = this.gameData;
    const player = this.$store.state.player?.index ?? data.currentPlayer;
    const faction = data.player(player)?.faction;
    if (faction != null) {
      // own faction - or current player's faction - should be at the top when it belongs to the
      // standard 7-planet ring; Lost Fleet's Asteroid/Protoplanet stay in the extra row below.
      const planet = factionPlanet(faction);
      const offset = ringPlanets.indexOf(planet);
      if (offset >= 0) {
        return ringPlanets[(pos + offset) % ringPlanets.length];
      }
    }
    return ringPlanets[pos];
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
