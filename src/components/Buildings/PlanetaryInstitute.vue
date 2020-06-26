<template>
  <g>
    <image xlink:href="../../assets/buildings/planetary-institute.svg" :filter="faction ? `url(#color-${faction})` : ''" width=110 x=-55 y=-55 />
  </g>
</template>
<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";

@Component
export default class PlanetaryInstitute extends Vue {
  @Prop({ default: "" })
  faction: string;
}

</script>
