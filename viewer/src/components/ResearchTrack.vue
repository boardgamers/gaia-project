<template>
  <g :transform="`translate(${x}, 0)`">
    <!-- One rounded column behind the whole track: it carries the track color's silhouette, edge
         and lift, so the track reads as a single unit on dark mode instead of six separate tiles.
         The cells are clipped to the same rounded silhouette (below) so the top/bottom cells follow
         the column's rounded caps instead of their square corners poking past them. -->
    <defs>
      <!-- Clip the cells to the track silhouette: a rounded TOP cap (rx 10) with a slim gap of
           track-bg showing. The bottom stays SQUARE and full-height; the column is a touch taller
           (bottom at 318, 2 units past the level-0 cell's 316) so the full cell fits inside it
           with a slim bottom gap instead of being clipped. -->
      <clipPath :id="`track-clip-${field}`">
        <path d="M2 12 Q2 2 12 2 H48 Q58 2 58 12 V318 H2 Z" />
      </clipPath>
    </defs>
    <path class="track-bg" :class="field" d="M0 8 Q0 0 8 0 H52 Q60 0 60 8 V318 H0 Z" />
    <g :clip-path="`url(#track-clip-${field})`">
      <ResearchTile y="278" :level="0" :field="field" />
      <ResearchTile y="240" :level="1" :field="field" />
      <ResearchTile y="202" :level="2" :field="field" />
      <ResearchTile y="146" :level="3" :field="field" />
      <ResearchTile y="108" :level="4" :field="field" />
      <ResearchTile y="0" :level="5" :field="field" />
    </g>
    <g v-if="$store.state.data.tiles && $store.state.data.tiles.techs['gaia']">
      <g transform="translate(30, 79) scale(0.95)">
        <TechTile :pos="'adv-' + field" x="-30" y="-30" />
      </g>
      <g transform="translate(30, 351) scale(0.95)">
        <TechTile :pos="field" x="-30" y="-30" />
      </g>
    </g>
  </g>
</template>

<script lang="ts">
import { ResearchField } from "@gaia-project/engine";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import ResearchTile from "./ResearchTile.vue";
import TechTile from "./TechTile.vue";

@Component({
  components: {
    ResearchTile,
    TechTile,
  },
})
export default class ResearchTrack extends Vue {
  @Prop()
  field: ResearchField;

  @Prop()
  x: number;
}
</script>

<style lang="scss">
.research-board .track-bg {
  // A deeper shade of the track color forms the column; the brighter cells sit inside it, which
  // reads as one track on any background (light or dark) without a blurry per-tile shadow.
  &.eco {
    fill: #c2a200;
  }
  &.sci {
    fill: #5a97cc;
  }
  &.terra {
    fill: #5f4634;
  }
  &.nav {
    fill: #3a4750;
  }
  &.gaia {
    fill: #6e3c66;
  }
  &.int {
    fill: #3d623f;
  }
}
</style>
