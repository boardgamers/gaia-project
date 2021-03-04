<template>
  <defs>
    <filters />
    <space-hex />
    <buildings />
  </defs>
</template>
<script lang="ts">
import Filters from "./Filters.vue";
import SpaceHex from "./SpaceHex.vue";
import Buildings from "./Buildings.vue";

export default {
  components: {
    Buildings,
    Filters,
    SpaceHex,
  },
};
</script>
