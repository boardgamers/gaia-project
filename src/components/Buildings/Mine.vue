<template>
  <g>
    <image xlink:href="../../assets/buildings/mine.svg" :filter="faction ? `url(#color-${faction})` : ''" width=70 x=-35 y=-35 />
  </g>
</template>
<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";

@Component
export default class Mine extends Vue {
  @Prop({ default: "" })
  faction: string;
}

</script>
