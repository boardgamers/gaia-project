<template>
  <button class='btn btn-secondary mr-2 mb-2 move-button' @click="handleClick" @mouseenter="hover" @mouseleave="leave" :title="button.tooltip" v-b-tooltip>
    <slot></slot>
  </button>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import {GaiaHex, TechTilePos, AdvTechTilePos, Booster} from '@gaia-project/engine';
import {HighlightHexData, ButtonData} from '../data';

@Component({
  computed: {
    isActiveButton() {
      return this.$store.state.game.context.activeButton === this.button;
    }
  }
})
export default class MoveButton extends Vue {
  @Prop()
  public button: ButtonData;

  private subscription: () => {} = null;

  subscribe(action: string, callback: any) {
    this.unsubscribe();

    this.subscription = (this.$store as any).subscribeAction(({type, payload}) => {
      if (type !== action) {
        return;
      }

      if (!this.isActiveButton) {
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
    if (this.button.hexes && !this.button.hover && !this.button.selectHexes) {
      this.$store.commit("activeButton", this.button);
      this.$store.commit("highlightHexes", this.button.hexes);

      this.subscribe('hexClick', hex => this.emitCommand(`${hex.q}x${hex.r}`));
      return;
    }

    if (this.button.researchTiles) {
      this.$store.commit("activeButton", this.button);
      this.$store.commit("highlightResearchTiles", this.button.researchTiles);

      this.subscribe('researchClick', field => this.emitCommand(field, {final: true}));

      this.emitCommand(null, {disappear: false});
      return;
    }

    if (this.button.techs) {
      this.$store.commit("activeButton", this.button);
      this.$store.commit("highlightTechs", this.button.techs);

      this.subscribe('techClick', pos => this.emitCommand(pos, {final: true}));

      this.emitCommand(null, {disappear: false});
      return;
    }

    if (this.button.boosters) {
      this.$store.commit("activeButton", this.button);
      this.$store.commit("highlightBoosters", this.button.boosters);

      this.subscribe('boosterClick', booster => this.emitCommand(booster, {final: true}));

      this.emitCommand(null, {disappear: false});
      return;
    }

    if (this.button.selectHexes) {
      // If already the active button, end the selection
      if (this.isActiveButton) {
        this.button.command = [...this.$store.state.game.context.highlighted.hexes.keys()].map(hex => `${hex.q}x${hex.r}`).join(',');
        this.emitCommand();
        return;
      }

      this.$store.commit("activeButton", this.button);
      this.$store.commit("selectHexes", this.button.hexes);

      this.button.label = "Custom location - End selection";

      this.subscribe('hexClick', hex => {
        const highlighted = this.$store.state.game.context.highlighted.hexes;

        if (highlighted.has(hex)) {
          highlighted.delete(hex);
        } else {
          highlighted.set(hex, null);
        }

        const keys: GaiaHex[] = [...highlighted.keys()];
        this.$store.commit("highlightHexes", new Map([...keys.map(key => [key, null])] as any));
      });

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
    if (!this.button.hover) {
      return;
    }

    this.$store.commit("highlightHexes", this.button.hexes);
  }

  leave() {
    if (!this.button.hover) {
      return;
    }

    this.$store.commit("clearContext");
  }
}
export default interface MoveButton {
  isActiveButton: boolean;
}

</script>
