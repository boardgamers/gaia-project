<template>
  <defs>
    <filters />
    <space-hex />
    <buildings />
    <path
      id="info"
      d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"
    />
    <polygon
      id="arrow"
      points="0 0, 10 3.5, 0 7"
      fill="white"
      stroke="black"
      transform="scale(.7) translate(4, -3.5)"
    />
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
