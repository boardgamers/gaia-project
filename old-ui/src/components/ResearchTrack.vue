<template>
  <g :transform="`translate(${x}, 0)`">
    <ResearchTile y="270" :level="0" :field="field" />
    <ResearchTile y="230" :level="1" :field="field" />
    <ResearchTile y="190" :level="2" :field="field" />
    <ResearchTile y="133" :level="3" :field="field" />
    <ResearchTile y="93" :level="4" :field="field" />
    <ResearchTile y="0" :level="5" :field="field" />
    <g v-if="$store.state.data.tiles && $store.state.data.tiles.techs['gaia']">
      <TechTile :pos="'adv-' + field" y="53" x="1" />
      <TechTile :pos="field" y="321" x="1" />
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
