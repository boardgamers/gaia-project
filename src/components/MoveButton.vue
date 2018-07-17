<template>
  <button class='btn btn-secondary mr-2 mb-2 move-button' @click="handleClick">
    <slot></slot>
  </button>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';

@Component
export default class Navbar extends Vue {
  @Prop()
  public command: string;

  handleClick() {
    this.$emit('trigger', this.command);
  }
}

</script>
