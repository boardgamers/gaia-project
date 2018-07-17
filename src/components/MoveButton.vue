<template>
  <button class='btn btn-secondary mr-2 mb-2 move-button' @click="handleClick" @mouseenter="hover" @mouseleave="leave">
    <slot></slot>
  </button>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import {GaiaHex} from '@gaia-project/engine';

@Component
export default class Navbar extends Vue {
  @Prop()
  public command: string;
  @Prop()
  public hexes: GaiaHex[];

  private subscription: () => {} = null;

  subscribe(action: string, callback: any) {
    this.unsubscribe();

    this.subscription = this.$store.subscribeAction(({type, payload}) => {
      if (type !== action) {
        return;
      }

      callback(payload);
    });
  }

  unsubscribe() {
    if (this.subscription) {
      this.subscription();
    }
  }

  handleClick() {
    if (this.hexes) {
      this.$store.commit("activeButton", this);
      this.$store.commit("highlightHexes", this.hexes);

      this.subscribe('hexClick', hex => this.emitCommand(`${hex.q}x${hex.r}`));
      return;
    }
    
    this.emitCommand();
  }

  emitCommand(append?: string) {
    this.unsubscribe();
    
    this.$store.commit("activeButton", null);

    if (append) {
      this.$emit('trigger', this.command + " " + append);
    } else {
      this.$emit('trigger', this.command);
    }
  }

  hover() {

  }

  leave() {
    
  }
}

</script>
