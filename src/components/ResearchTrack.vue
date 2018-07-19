<template>
  <g :transform="`translate(${x}, 0)`">
    <ResearchTile y="310" level="0" :field="field" />
    <ResearchTile y="260" level="1" :field="field" />
    <ResearchTile y="210" level="2" :field="field" />
    <ResearchTile y="143" level="3" :field="field" />
    <ResearchTile y="93" level="4" :field="field" />
    <ResearchTile y="0" level="5" :field="field" />
    <TechTile :pos="'adv-'+field" y="53" />
    <TechTile :pos="field" y="362" />
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { ResearchField } from '@gaia-project/engine';
import ResearchTile from './ResearchTile.vue';
import TechTile from './TechTile.vue';

@Component({
  components: {
    ResearchTile,
    TechTile
  }
})
export default class ResearchTrack extends Vue {
  @Prop()
  field: ResearchField;

  @Prop()
  x: number;
}
</script>

<style lang="scss" scoped>

</style>
