<template>
  <g>
    <image xlink:href="../../assets/buildings/space-station.svg" :filter="faction ? `url(#color-${faction})` : ''" width=90 x=-45 y=-30 />
  </g>
</template>
<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";

@Component
export default class SpaceStation extends Vue {
  @Prop({ default: "" })
  faction: string;
}

</script>
