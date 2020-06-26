<template>
  <g class="resource">
    <template v-if="kind === 'q'" >
      <Qic class="qic" :transform="`translate(${(((i-1) % 6) + 0.5 - Math.min(count, 6)/2 + (centerLeft ? Math.min(count, 6)/2 - 0.5 : 0)) * 11}, ${-16 * Math.floor((i-1)/6)})`" y="-10" :key=i v-for="i in count" />
    </template>
    <!-- <rect v-if="kind=='q'" class="qic" width="14" height="14" x="-7" y="-7" /> -->
    <rect v-else-if="kind=='o'" class="ore" width="14" height="14" x="-7" y="-7" />
    <rect v-else-if="kind=='c'" class="credit" width="16" height="16" ry="8" rx="8" x="-8" y="-8" />
    <rect v-else-if="kind=='pw' || kind=='t'" class="power" width="15" height="15" ry="7.5" rx="7.5" x="-7.5" y="-7.5" />
    <polygon points="-7.5,3 -3,7.5 3,7.5 7.5,3 7.5,-3 3,-7.5 -3,-7.5 -7.5,-3"  v-else-if="kind=='k'" class="planet-fill r knowledge" />
    <g v-else-if="kind=='vp'" transform="translate(-7.5,-7.5)" class="vp">
      <VictoryPoint width="15" height="15" />
    </g>
    <Building v-else-if="kind=='gf'" building="gf" transform="translate(0.5, 0) scale(3)" />
    <g v-else-if="kind=='swap-PI'" transform="scale(-1,1)">
      <Building faction="ambas" building="m" transform="translate(-8.5, 0) scale(1.5)"/>
      <Building faction="ambas" building="PI" transform="translate(6, 0) scale(1.5)"/>
      <image xlink:href="../assets/resources/swap-arrow.svg" width=15 x=-7.5 y=-14 />
    </g>
    <g v-else-if="kind=='down-lab'" transform="scale(-1,1)">
      <Building faction="firaks" building="lab" transform="translate(-7.5, 0) scale(1.5)"/>
      <Building faction="firaks" building="ts" transform="translate(7.5, 0) scale(-1.5,1.5)"/>
      <image xlink:href="../assets/resources/arrow-charge.svg" width=15 x=-7.5 y=-14 />
    </g>
    <Building v-else-if="kind=='space-station'" building="sp" transform="translate(0.5, 0) scale(2.5)" faction="ivits" />
    <template v-else-if="kind === 'step'">
      <image xlink:href='../assets/resources/dig-planet.svg' width=20 x=-10 y=-10 />
      <template v-if="count === 1 || !count">
        <image xlink:href='../assets/resources/dig-arrow.svg' width=14 x=-11 y=-4 />
      </template>
      <template v-else-if="count === 2">
        <image xlink:href='../assets/resources/dig-arrow.svg' width=14 x=-13 y=-7 />
        <image xlink:href='../assets/resources/dig-arrow.svg' width=14 x=-9 y=-2 />
      </template>
    </template>
    <image v-else-if="kind === 'tech'" xlink:href='../assets/resources/tech.svg' width=22 x=-11 y=-8 />
    <Federation v-else-if="kind === 'fed'" width=22 x=-11 y=-26.5 :used=true />
    <template v-else-if="kind === 'range'">
      <image xlink:href="../assets/resources/flat-hex.svg" width=15 y=-9 x=-2 />
      <image xlink:href="../assets/resources/flat-hex.svg" width=20 y=3 x=-10 />
      <image xlink:href="../assets/resources/range-arrow.svg" width=9 y=-8 x=-2 transform="rotate(5)" />
      <text v-if="count > 1" x=-7 y=-2.5 stroke="black" stroke-width=0.3 style="font-weight: bold; font-size: 15px; stroke-width: 0.7px" >
        {{count}}
      </text>
    </template>
    <image v-if="kind === 'pw'" xlink:href='../assets/resources/power-charge.svg' width=20 transform="translate(-9, -14)" />

    <!-- <SpaceShip v-else-if="kind=='ship'" class="ship" :scale="14" /> -->
    <text x="0" y="0" v-if="['o','c','k','pw','t','vp','ship'].includes(kind) || count === '+'" :class="{plus: count === '+'}">{{count}}</text>
   </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { Resource as ResourceEnum } from '@gaia-project/engine';
import Building from './Building.vue';
import SpaceShip from './SpaceShip.vue';
import Qic from './Resources/Qic.vue';
import VictoryPoint from './Resources/VictoryPoint.vue';
import Federation from './FederationTile.vue';

@Component({
  components: {
    Building,
    Federation,
    Qic,
    SpaceShip,
    VictoryPoint
  }
})
export default class Resource extends Vue {
  @Prop()
  kind: Resource;

  @Prop()
  count: number;

  @Prop({ default: false })
  centerLeft: boolean;
}
</script>

<style lang="scss">
@import '../stylesheets/planets.scss';

g.resource {
  pointer-events: none;

  rect, .knowledge {
    stroke: #111;
    stroke-width: 0.9px;
  }

  .qic {
    fill: green;
  }

  .ore {
    fill: #ddd;
  }

  .credit {
    fill: $desert;
  }

  .power {
    fill: #984FF1;
  }

  .ore, .credit, .building.r, .ship {
    & + text {
      fill: black
    }
  }

  text {
    font-size: 10px;
    fill: white;
    font-weight: 600;
    dominant-baseline: central;
    text-anchor: middle;

    &.plus {
      font-size: 22px;

      stroke: #111;
      fill: white;
    }
  }
}
</style>
