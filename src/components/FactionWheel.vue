<template>
  <g>
    <circle :r=r fill=none />
    <g v-for="i in [0, 1, 2, 3, 4, 5, 6]" :key="i" :transform="`translate(${r*Math.sin((-180+i*51)*Math.PI/180)}, ${r*Math.cos((-180+i*51)*Math.PI/180)})`">
        <circle :r="1"  :class="['player-token', 'planet-fill', planet(i)]" />
    </g>
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import { Planet } from '@gaia-project/engine';

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

  planet (pos: number) {
    const list = [Planet.Terra, Planet.Oxide, Planet.Volcanic, Planet.Desert, Planet.Swamp, Planet.Titanium, Planet.Ice];
    return list[pos];
  }

}

</script>
<style lang="scss" scoped>

circle {
  stroke-width: 0.05px;
  stroke: black;
}

</style>
