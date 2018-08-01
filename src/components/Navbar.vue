<template>
  <nav class="navbar navbar-dark bg-primary navbar-expand-sm navbar-fixed-top mb-3" id="navbar">
    <a class="navbar-brand" href="/">Gaia project</a>
  </nav>
</template>

<script lang="ts">
import Vue from 'vue'
import * as $ from "jquery";
import { Component, Prop } from 'vue-property-decorator';

@Component
export default class Navbar extends Vue {
}

</script>

<style lang="scss" scoped>

.navbar {
  // margin-bottom: 0 !important;
}

</style>
