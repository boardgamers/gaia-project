<template>
  <g>
    <line y1="-11" y2="11" x1="-11" x2="11" stroke="#333" stroke-width="5" />
    <line y1="11" y2="-11" x1="-11" x2="11" stroke="#333" stroke-width="5" />
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component } from "vue-property-decorator";

/** The X drawn over a board action/special action once it's been used, shared so every "used"
 * marker (base power/QIC actions, ship board actions) renders identically instead of each caller
 * redrawing its own slightly-different copy. Caller positions it (a wrapping transform) and gates
 * it with v-if; it always draws centered on its own local (0,0). */
@Component
export default class UsedActionMark extends Vue {}
</script>
