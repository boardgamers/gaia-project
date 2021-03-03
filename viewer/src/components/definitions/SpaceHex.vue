<template>
  <polygon :points="hexCorners.map((p) => `${p.x},${p.y}`).join(' ')" id="space-hex" />
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { corners } from "../../graphics/hex";

@Component
export default class SpaceHex extends Vue {
  get hexCorners() {
    return corners();
  }
}
</script>
