<template>
  <g class="resource">
    <template v-if="kind === 'q'" >
      <Qic v-if="!flat" class="qic" :transform="`translate(-0.5,0)`"  />
      <rect v-else class="qic" width="14" height="14" x="-7" y="-7" />
    </template>
    <!-- <rect v-if="kind=='q'" class="qic" width="14" height="14" x="-7" y="-7" /> -->
    <rect v-else-if="kind=='o'" class="ore" width="14" height="14" x="-7" y="-7" />
    <rect v-else-if="kind=='c'" class="credit" width="16" height="16" ry="8" rx="8" x="-8" y="-8" />
    <rect v-else-if="['pw', 'pay-pw', 't', 'bowl-t', 'tg', 'brainstone'].includes(kind)"
          :class="kind === 'tg' ? 'gaia': 'power'"
          width="15" height="15" ry="7.5" rx="7.5" x="-7.5" y="-7.5" />
    <polygon points="-7.5,3 -3,7.5 3,7.5 7.5,3 7.5,-3 3,-7.5 -3,-7.5 -7.5,-3"  v-else-if="kind=='k'" class="knowledge" />
    <g v-else-if="kind=='vp'" transform="translate(-7.5,-7.5)" class="vp">
      <VictoryPoint width="15" height="15" />
    </g>
    <Building v-else-if="kind=='gf'" building="gf" transform="translate(0.5, 0) scale(2.5)" :flat="flat" :faction="faction"/>
    <g v-else-if="kind=='swap-PI'" transform="scale(-1,1)">
      <Building faction="ambas" building="m" transform="translate(-8.5, 0) scale(1.5)" :flat="flat"/>
      <Building faction="ambas" building="PI" transform="translate(6, 0) scale(1.5)" :flat="flat"/>
      <image xlink:href="../assets/resources/swap-arrow.svg" width=15 :height=129/343*15 x=-7.5 y=-14 />
    </g>
    <g v-else-if="kind=='down-lab'" transform="scale(-1,1)">
      <Building faction="firaks" building="lab" transform="translate(-7.5, 0) scale(1.5)" :flat="flat"/>
      <Building faction="firaks" building="ts" transform="translate(7.5, 0) scale(-1.5,1.5)" :flat="flat"/>
      <image xlink:href="../assets/resources/arrow-charge.svg" width=15 :height=133/346*15 x=-7.5 y=-14 />
    </g>
    <Building v-else-if="kind=='space-station'" building="sp" transform="translate(0.5, 0) scale(2.5)" faction="ivits" :flat="flat" />
    <template v-else-if="kind === 'step'">
      <image v-if="!flat" xlink:href='../assets/resources/dig-planet.svg' width=20 height=20 x=-10 y=-10 />
      <circle v-else r="10" :class='["planet-fill", "dig" ]'  />
      <template v-if="count === 1 || !count">
        <image xlink:href='../assets/resources/dig-arrow.svg' width=14 :height=325/308*14 x=-11 y=-4 />
      </template>
      <template v-else-if="count === 2">
        <image xlink:href='../assets/resources/dig-arrow.svg' width=14 :height=325/308*14 x=-13 y=-7 />
        <image xlink:href='../assets/resources/dig-arrow.svg' width=14 :height=325/308*14 x=-9 y=-2 />
      </template>
    </template>
    <template v-else-if="kind === 'd'">
      <g transform=translate(3,0) >
        <image v-if="!flat" xlink:href='../assets/resources/dig-planet.svg' width=20 height=20 x=-10 y=-10 />
        <circle v-else r="10" :class='["planet-fill", "dig" ]'  />
        <image xlink:href='../assets/resources/dig-arrow.svg' :height=325/308*14 width=14 x=-11 y=-4 />
      </g>
      <g transform=translate(-7,-7)>
        <rect class="ore" width="12" height="12" x="-6" y="-6" />
        <text x="0" y="0">{{4-count}}</text>
      </g>
    </template>
    <image v-else-if="kind === 'tech'" xlink:href='../assets/resources/tech.svg' :height=155/211*22 width=22 x=-11 y=-8 />
    <Federation v-else-if="kind === 'fed'" width=22 x=-11 y=-26.5 :used=true />
    <template v-else-if="kind === 'range'">
      <image xlink:href="../assets/resources/flat-hex.svg" :height=162/328*20 width=15 y=-9 x=-2 />
      <image xlink:href="../assets/resources/flat-hex.svg" :height=162/328*20 width=20 y=3 x=-10 />
      <image xlink:href="../assets/resources/range-arrow.svg" :height=285/164*9 width=9 y=-8 x=-2 transform="rotate(5)" />
      <text v-if="count > 1" x=-7 y=-2.5 stroke="black" stroke-width=0.3 style="font-weight: bold; font-size: 15px; stroke-width: 0.7px" >
        {{count}}
      </text>
    </template>
    <template v-else-if="kind === 'r'">
      <g transform="scale(1) translate(-13,0)">
        <image xlink:href="../assets/resources/flat-hex.svg" :height=162/328*20  width=20 x=-10 y=-4 />
      </g>
      <g transform="scale(1) translate(13,0)">
        <image xlink:href="../assets/resources/flat-hex.svg" :height=162/328*20 width=20 x=-10 y=-4 />
      </g>
      <g  transform="translate(1,0) rotate(70)">
        <image xlink:href="../assets/resources/range-arrow.svg" :height=285/164*9 width=10 x=-5 y=-8 />
      </g>
      <text v-if="count >= 1" x=13 y=1.2 stroke-width=0.3 style="font-weight: bold; font-size: 10px" >
        {{count}}
      </text>
    </template>
    <template v-else-if="kind === 'up-lowest'">
      <Condition condition="a" transform="scale(0.75)" />
      <Token faction="bescods" transform="scale(0.15) translate(50,-24)" />
      <Token faction="bescods" transform="scale(0.15) translate(-5,26)" />
    </template>
    <image v-if="kind === 'pw'" xlink:href='../assets/resources/power-charge.svg' :height=133/346*20 width=20 transform="translate(-9.5, -13.5)" />
    <image v-if="kind === 'pay-pw'" xlink:href='../assets/resources/power-charge.svg' :height=133/346*20 width=20 transform="translate(9.5, -13.5) scale(-1,1) " />
    <text x="0" y="0" v-if="count >=0 && ['o','c','k','pw','pay-pw','t','bowl-t','tg','vp','q','gf'].includes(kind) || count === '+'" :class="{plus: count === '+'}">{{kind === 't' ? '+' : ''}}{{count}}</text>
    <text x="0" y="0" v-if="kind=='brainstone'">B</text>
   </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { Faction } from '@gaia-project/engine';
import Building from './Building.vue';
import Qic from './Resources/Qic.vue';
import VictoryPoint from './Resources/VictoryPoint.vue';
import Federation from './FederationTile.vue';
import Token from './Token.vue';

@Component({
  components: {
    Building,
    Federation,
    Qic,
    Token,
    VictoryPoint
  }
})
export default class Resource extends Vue {
  @Prop()
  kind: Resource | "brainstone";

  @Prop()
  count: number;

  @Prop({ default: false })
  centerLeft: boolean;

  @Prop({ default: 'gen' })
  faction: Faction;

  get flat () {
    return this.$store.state.gaiaViewer.preferences.flatBuildings;
  }
}
</script>

<style lang="scss">
@import '../stylesheets/planets.scss';

g.resource {
  pointer-events: none;

  rect, .knowledge {
    stroke: #111;
    stroke-width: 0.9px;
    fill: $res-knowledge;
  }

  .qic {
    fill: $res-qic;
  }

  .ore {
    fill: $res-ore;
  }

  .credit {
    fill: $res-credit;
  }

  .power {
    fill: $res-power
  }

  .gaia {
    fill: $gaia
  }

  .ore, .credit, .building.r {
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
