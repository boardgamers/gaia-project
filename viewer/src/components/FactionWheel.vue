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
import Engine, { factionPlanet, Planet } from "@gaia-project/engine";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import type { MapMode } from "../data/actions";
import { remainingPlanets } from "../data/planets";
import { planetFill } from "../graphics/utils";
import { radiusTranslate } from "../logic/utils";

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
    // Circle markers (matching the ring's own planet circles). Gaia/Transdim sit in a row below
    // the wheel; the ring's own lowest circles reach y = r*cos(25.71deg) + 1 (their own radius) =
    // ~3.7 at r=3, so the below-wheel row's circle centers need to clear that by more than 1 (its
    // own radius) - use a visible margin instead of the bare minimum so they never look like
    // they're touching.
    const spacing = 2.6;
    const belowY = this.r + 2.1;
    const below = standardExtraPlanets.map((planet, index) => ({
      planet,
      x: -((standardExtraPlanets.length - 1) * spacing) / 2 + index * spacing,
      y: belowY,
    }));

    if (!this.gameData.options.lostFleet) {
      return below;
    }

    // Lost Fleet's Asteroid/Protoplanet sit in their own column to the right of the wheel instead
    // of a 3rd/4th slot below it - keeps the below-wheel row to the 2 standard planets and gives
    // the map sidebar back the width the old 2-column grid used. The ring's own rightmost circles
    // reach x = r*sin(77.14deg) + 1 = ~3.9 at r=3; same margin approach as belowY above.
    const rightX = this.r + 2.1;
    const right = lostFleetExtraPlanets.map((planet, index) => ({
      planet,
      x: rightX,
      y: -((lostFleetExtraPlanets.length - 1) * spacing) / 2 + index * spacing,
    }));

    return [...below, ...right];
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
    this.$store.commit("toggleMapMode", { type: "planetType", planet } as MapMode);
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
