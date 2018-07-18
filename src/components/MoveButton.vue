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
  researchTiles?: string[];

  buttons?: ButtonData[];
  hide?: boolean;
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

    if (this.button.researchTiles) {
      this.$store.commit("activeButton", this);
      this.$store.commit("highlightResearchTiles", this.button.researchTiles);

      this.subscribe('researchClick', field => this.emitCommand(field, {final: true}));

      this.emitCommand(null, {disappear: false});
      return;
    }
    
    this.emitCommand();
  }

  emitCommand(append?: string, params: {disappear?: boolean, final?: boolean} = {disappear: true, final: false}) {
    console.log("emit command", append);

    const {disappear, final} = params;

    if (disappear) {
      this.unsubscribe();

      this.$store.commit("activeButton", null);
    }

    const commandBody = [final ? null : this.button.command, append].filter(x => !!x);

    this.$emit('trigger', commandBody.join(" "), this, final);
  }

  hover() {

  }

  leave() {
    
  }
}

</script>
