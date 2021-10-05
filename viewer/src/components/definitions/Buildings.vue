<template>
  <defs>
    <template v-for="faction in factions">
      <g :key="'ac-' + faction" :id="'ac-' + faction">
        <image xlink:href="../../assets/buildings/academy.svg" :filter="faction ? `url(#color-${faction})` : ''"
        width=90 :height=771/641*90 x=-45 y=-53 />
      </g>
      <g :key="'gf-' + faction" :id="'gf-' + faction">
        <image xlink:href="../../assets/buildings/gaiaformer.svg" :filter="faction ? `url(#color-${faction})` : ''"
        width=80 :height=335/543*80 x=-40 y=-20 />
      </g>
      <g :key="'m-' + faction" :id="'m-' + faction">
        <image xlink:href="../../assets/buildings/mine.svg" :filter="faction ? `url(#color-${faction})` : ''" width=70
        :height=463/400*70 x=-35 y=-35 />
      </g>
      <g :key="'PI-' + faction" :id="'PI-' + faction">
        <image xlink:href="../../assets/buildings/planetary-institute.svg" :filter="faction ? `url(#color-${faction})` :
        ''" :height=651/678*110 width=110 x=-55 y=-55 />
      </g>
      <g :key="'rl-' + faction" :id="'lab-' + faction">
        <image
          xlink:href="../../assets/buildings/research-lab.svg"
          :filter="faction ? `url(#color-${faction})` : ''"
          width="80"
          height="80"
          x="-40"
          y="-40"
        />
      </g>
      <g :key="'sp-' + faction" :id="'sp-' + faction">
        <image xlink:href="../../assets/buildings/space-station.svg" :filter="faction ? `url(#color-${faction})` : ''"
        width=90 :height=430/619*90 x=-45 y=-30 />
      </g>
      <g :key="'ts-' + faction" :id="'ts-' + faction">
        <image xlink:href="../../assets/buildings/trading-station.svg" :filter="faction ? `url(#color-${faction})` : ''"
        :height=667/504*80 width=80 x=-40 y=-50 />
      </g>
    </template>
  </defs>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";

@Component
export default class Buildings extends Vue {
  get factions() {
    return [...this.$store.state.data.players.map((p) => p.faction).filter((f) => !!f), "gen"];
  }
}
</script>
