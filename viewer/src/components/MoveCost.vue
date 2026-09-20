<template>
  <span class="move-cost" title="Estimated cost" aria-label="Estimated cost">
    <span v-if="!cost">—</span>
    <span v-else-if="!cost.length">Free</span>
    <template v-else>
      <svg v-for="(resource, index) in cost" :key="index" viewBox="-12 -14 30 28" width="45" height="42">
        <Resource :kind="resource.type" :count="-resource.count" :no-plus="true" />
      </svg>
    </template>
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
  flex-wrap: wrap;
  max-width: 100%;
  vertical-align: middle;
  margin-left: 0.5rem;
  font-size: 0.85rem;
}
.move-cost svg {
  flex: none;
}
</style>
