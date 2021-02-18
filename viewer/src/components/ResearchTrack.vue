<template>
  <g :transform="`translate(${x}, 0)`">
    <ResearchTile y="278" :level="0" :field="field" />
    <ResearchTile y="240" :level="1" :field="field" />
    <ResearchTile y="202" :level="2" :field="field" />
    <ResearchTile y="146" :level="3" :field="field" />
    <ResearchTile y="108" :level="4" :field="field" />
    <ResearchTile y="0" :level="5" :field="field" />
    <g v-if="$store.state.gaiaViewer.data.tiles && $store.state.gaiaViewer.data.tiles.techs['gaia']">
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
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { ResearchField } from "@gaia-project/engine";
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

<style lang="scss" scoped></style>
