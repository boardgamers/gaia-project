<template>
  <defs>
    <linearGradient
      id="research-lab-shading"
      x1="336"
      y1="149.153"
      x2="39.0306"
      y2="438.797"
      gradientUnits="userSpaceOnUse"
    >
      <stop stop-color="#F2F2F7" />
      <stop offset="1" stop-color="#B6B6B6" />
    </linearGradient>
    <template v-for="faction in factions">
      <g :key="'ac-' + faction" :id="'ac-' + faction">
        <image
          xlink:href="../../assets/buildings/academy.svg"
          :filter="faction ? `url(#color-${faction})` : ''"
          width="90"
          :height="(771 / 641) * 90"
          x="-45"
          y="-53"
        />
      </g>
      <g :key="'gf-' + faction" :id="'gf-' + faction">
        <image
          xlink:href="../../assets/buildings/gaiaformer.svg"
          :filter="faction ? `url(#color-${faction})` : ''"
          width="80"
          :height="(335 / 543) * 80"
          x="-40"
          y="-20"
        />
      </g>
      <g :key="'m-' + faction" :id="'m-' + faction">
        <image
          xlink:href="../../assets/buildings/mine.svg"
          :filter="faction ? `url(#color-${faction})` : ''"
          width="70"
          :height="(463 / 400) * 70"
          x="-35"
          y="-35"
        />
      </g>
      <g :key="'PI-' + faction" :id="'PI-' + faction">
        <image
          xlink:href="../../assets/buildings/planetary-institute.svg"
          :filter="faction ? `url(#color-${faction})` : ''"
          :height="(651 / 678) * 110"
          width="110"
          x="-55"
          y="-55"
        />
      </g>
      <g :key="'rl-' + faction" :id="'lab-' + faction" :filter="faction ? `url(#color-${faction})` : ''">
        <!-- Keep the original artwork as a vector, not an SVG image: its 12-unit stroke extends
             beyond the 511×522 image viewport and gets cut off at small/subpixel board scales.
             Match the old 80×80 image's centered "meet" scaling without a clipping viewport. -->
        <path
          :transform="`scale(${80 / 522}) translate(-255.5, -261)`"
          d="M506 331.328C506 351.779 504.52 371.738 501.756 391.205C500.275 401.726 495.34 411.46 487.839 419.03C427.534 479.989 345.712 517.45 255.5 517.45C165.288 517.45 83.3676 479.989 23.1608 419.03C15.5609 411.263 10.6259 401.332 9.14539 390.615C6.48049 371.443 5 351.582 5 331.426C5 151.105 117.123 5.00005 255.5 5.00005C393.877 4.90173 506 151.007 506 331.328Z"
          fill="url(#research-lab-shading)"
          stroke="#010101"
          stroke-width="12"
          stroke-miterlimit="10"
        />
      </g>
      <g :key="'sp-' + faction" :id="'sp-' + faction">
        <image
          xlink:href="../../assets/buildings/space-station.svg"
          :filter="faction ? `url(#color-${faction})` : ''"
          width="90"
          :height="(430 / 619) * 90"
          x="-45"
          y="-30"
        />
      </g>
      <g :key="'ts-' + faction" :id="'ts-' + faction">
        <image
          xlink:href="../../assets/buildings/trading-station.svg"
          :filter="faction ? `url(#color-${faction})` : ''"
          :height="(667 / 504) * 80"
          width="80"
          x="-40"
          y="-50"
        />
      </g>
    </template>
  </defs>
</template>
<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class Buildings extends Vue {
  get factions() {
    return [...this.$store.state.data.players.map((p) => p.faction).filter((f) => !!f), "gen"];
  }
}
</script>
