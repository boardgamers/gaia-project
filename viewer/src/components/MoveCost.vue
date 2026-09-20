<template>
  <span class="move-cost" title="Expected spending and gains" aria-label="Expected spending and gains">
    <span v-if="!cost">—</span>
    <span v-else-if="!cost.length">Free</span>
    <RichTextView v-else :content="content" />
  </span>
</template>
<script lang="ts">
import Vue from "vue";
import type { MoveCost } from "../logic/analysis";
import { parseRewardsForLog } from "../logic/utils";
import RichTextView from "./Resources/RichTextView.vue";
export default Vue.extend({
  components: { RichTextView },
  computed: {
    content() {
      return parseRewardsForLog(
        (this.cost ?? []).map((resource) => `${resource.gain ? "" : "-"}${resource.count}${resource.type}`).join(",")
      );
    },
  },
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
</style>
