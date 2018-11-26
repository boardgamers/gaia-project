<template>
  <g class="resource">
    <rect v-if="kind=='q'" class="qic" width="14" height="14" x="-7" y="-7" />
    <rect v-else-if="kind=='o'" class="ore" width="14" height="14" x="-7" y="-7" />
    <rect v-else-if="kind=='c'" class="credit" width="16" height="16" ry="8" rx="8" x="-8" y="-8" />
    <rect v-else-if="kind=='pw' || kind=='t'" class="power" width="15" height="15" ry="7.5" rx="7.5" x="-7.5" y="-7.5" />
    <SpaceShip v-else-if="kind=='ship'" class="ship" :scale="14" />
    <polygon points="-1,0.5 -0.5,1 0.5,1 1,0.5 1,-0.5 0.5,-1 -0.5,-1 -1,-0.5" transform="scale(7.5)" v-else-if="kind=='k'" class="planet-fill r" stroke=#333 stroke-width=0.1 />
    <Building v-else-if="kind=='gf'" faction="ivits" building="gf" transform="translate(0.5, 0) scale(20)" style="fill: none !important" />
    <text x="0" y="0" v-if="['o','c','q','k','pw','t','ship'].includes(kind) || count === '+'" :class="{plus: count === '+'}">{{count}}</text>
   </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { Resource as ResourceEnum } from '@gaia-project/engine';
import Building from './Building.vue';
import SpaceShip from './SpaceShip.vue';

@Component({
  components: {
    Building,
    SpaceShip
  }
})
export default class Resource extends Vue {
  @Prop()
  kind: Resource;

  @Prop()
  count: number;
}
</script>


<style lang="scss">
@import '../stylesheets/planets.scss';

g.resource {
  pointer-events: none;
  opacity: 0.7;

  .hide-research-track-resources & {
    display: none;
  }

  rect {
    stroke: #333;
    stroke-width: 0.8px;
  }

  .qic {
    fill: green;
  }

  .ore {
    fill: #bbb;
  }

  .credit {
    fill: $desert;
  }

  .power {
    fill: #a41894;
  }

  .building {
    stroke-width: 0.04px;
  }

  .ore, .credit, .building.r, .ship {
    & + text {
      fill: black
    }
  }

  text {
    font-size: 10px;
    fill: white;
    dominant-baseline: central;
    text-anchor: middle;

    &.plus {
      font-size: 15px;
      font-weight: bold;
      
      fill: #333;
    }
  }
}
</style>
