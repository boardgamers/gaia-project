<template>
  <span class="move-cost" title="Estimated cost" aria-label="Estimated cost">
    <span v-if="!cost">—</span>
    <span v-else-if="!cost.length">Free</span>
    <svg v-else :viewBox="`-12 -14 ${cost.length * 30} 28`" :width="cost.length * 30" height="28">
      <Resource
        v-for="(resource, index) in cost"
        :key="index"
        :kind="resource.type"
        :count="resource.count"
        :no-plus="true"
        :transform="`translate(${index * 30}, 0)`"
      />
    </svg>
  </span>
</template>
<script lang="ts">
import Vue from "vue";
import type { MoveCost } from "../logic/analysis";
import Resource from "./Resource.vue";
export default Vue.extend({
  components: { Resource },
  props: { cost: { type: Array as () => MoveCost, default: undefined } },
});
</script>
<style scoped>
.move-cost {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  margin-left: 0.5rem;
  font-size: 0.85rem;
}
</style>
