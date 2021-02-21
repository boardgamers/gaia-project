<template>
  <g>
    <image
      xlink:href="../../assets/buildings/research-lab.svg"
      :filter="faction ? `url(#color-${faction})` : ''"
      width="80"
      height="80"
      x="-40"
      y="-40"
    />
  </g>
</template>
<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";

@Component
export default class ResearchLab extends Vue {
  @Prop({ default: "" })
  faction: string;
}
</script>
