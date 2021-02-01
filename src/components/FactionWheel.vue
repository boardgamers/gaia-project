<template>
  <g>
    <circle :r=r fill=none />
    <g v-for="i in [0, 1, 2, 3, 4, 5, 6]" :key="i"
       :transform="`translate(${r*Math.sin((-180+i*51)*Math.PI/180)}, ${r*Math.cos((-180+i*51)*Math.PI/180)})`">
      <circle :r="1" :class="['player-token', 'planet-fill', planet(i)]" />
      <text
        :style="`font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(planet(i))}`">
        {{ remainingPlanets(planet(i)) }}
      </text>
    </g>
    <g v-for="i in [7, 8]" :key="i" :transform="`translate(${-2+(i-7)*4}, 5)`" >
      <circle :r="1" :class="['player-token', 'planet-fill', planet(i)]" />
      <text
        :style="`font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(planet(i))}`">
        {{ remainingPlanets(planet(i)) }}
      </text>
    </g>

  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import {Component} from 'vue-property-decorator';
import Engine, {Planet} from '@gaia-project/engine';

@Component
export default class FactionWheel extends Vue {

  get r () {
    return 3;
  }

  get spacing () {
    return 1.1;
  }

  angle (deg) {
    return deg * 180 / Math.PI;
  }

  get gameData (): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  remainingPlanets (planet: string) {
    return Array.from(this.gameData.map.grid.values())
      .filter(hex => !hex.occupied() && hex.data.planet === planet)
      .length;
  }

  planet (pos: number) {
    const list = [Planet.Terra, Planet.Oxide, Planet.Volcanic, Planet.Desert, Planet.Swamp, Planet.Titanium, Planet.Ice, Planet.Gaia, Planet.Transdim];
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
