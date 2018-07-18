<template>
  <button class='btn btn-secondary mr-2 mb-2 move-button' @click="handleClick" @mouseenter="hover" @mouseleave="leave">
    <slot></slot>
  </button>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import {GaiaHex} from '@gaia-project/engine';

export interface ButtonData {
  label?: string;
  command: string;
  tooltip?: string;
  hexes?: GaiaHex[];

  buttons?: ButtonData[];
}

@Component
export default class Navbar extends Vue {
  @Prop()
  public button: ButtonData;

  private subscription: () => {} = null;

  subscribe(action: string, callback: any) {
    this.unsubscribe();

    this.subscription = (this.$store as any).subscribeAction(({type, payload}) => {
      if (type !== action) {
        return;
      }

      if (this.$store.state.game.context.activeButton !== this) {
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
    if (this.button.hexes) {
      this.$store.commit("activeButton", this);
      this.$store.commit("highlightHexes", this.button.hexes);

      this.subscribe('hexClick', hex => this.emitCommand(`${hex.q}x${hex.r}`));
      return;
    }
    
    this.emitCommand();
  }

  emitCommand(append?: string) {
    console.log("emit command", append);
    this.unsubscribe();

    this.$store.commit("activeButton", null);

    if (append) {
      this.$emit('trigger', this.button.command + " " + append, this);
    } else {
      this.$emit('trigger', this.button.command, this);
    }
  }

  hover() {

  }

  leave() {
    
  }
}

</script>
