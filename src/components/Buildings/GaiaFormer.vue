<template>
  <g>
    <image xlink:href="../../assets/buildings/gaiaformer.svg" :filter="faction ? `url(#color-${faction})` : ''" width=80 x=-40 y=-20 />
  </g>
</template>
<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";

@Component
export default class GaiaFormer extends Vue {
  @Prop({ default: "" })
  faction: string;
}

</script>
