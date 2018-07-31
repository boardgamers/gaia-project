<template>
  <button class='btn btn-secondary mr-2 mb-2 move-button' @click="handleClick" @mouseenter="hover" @mouseleave="leave" :title="button.tooltip" v-b-tooltip.html>
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
      return this.$store.state.game.context.activeButton && this.$store.state.game.context.activeButton.label === this.button.label;
    }
  }
})
export default class MoveButton extends Vue {
  @Prop()
  public button: ButtonData;

  private subscription: () => {} = null;

  subscribe(action: string, callback: any) {
    this.unsubscribe();
    this.$store.commit("activeButton", this.button);

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

  subscribeFinal(action: string) {
    this.subscribe(action, field => this.emitCommand(field, {final: true}));
    this.emitCommand(null, {disappear: false});
  }

  unsubscribe() {
    if (this.subscription) {
      this.subscription();
    }
  }

  handleClick() {
    if (this.button.hexes && !this.button.hover && !this.button.selectHexes) {
      this.$store.commit("highlightHexes", this.button.hexes);
      this.subscribe('hexClick', hex => this.emitCommand(`${hex.q}x${hex.r}`));
    } else if (this.button.researchTiles) {
      this.$store.commit("highlightResearchTiles", this.button.researchTiles);
      this.subscribeFinal('researchClick');
    } else if (this.button.techs) {
      this.$store.commit("highlightTechs", this.button.techs);
      this.subscribeFinal('techClick');
    } else if (this.button.boosters) {
      this.$store.commit("highlightBoosters", this.button.boosters);
      this.subscribeFinal('boosterClick');
    } else if (this.button.actions) {
      console.log("highlightActions", this.button.actions);
      this.$store.commit("highlightActions", this.button.actions);
      this.subscribeFinal('actionClick');
    } else if (this.button.selectHexes) {
      // If already the active button, end the selection
      if (this.isActiveButton) {
        this.button.command = [...this.$store.state.game.context.highlighted.hexes.keys()].map(hex => `${hex.q}x${hex.r}`).join(',');
        this.emitCommand();
        return;
      }

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
    } else {
      this.emitCommand();
    }
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
    if (!this.button.hover || this.$store.state.game.context.activeButton !== null) {
      return;
    }

    this.$store.commit("highlightHexes", this.button.hexes);
  }

  leave() {
    if (!this.button.hover || this.$store.state.game.context.activeButton !== null) {
      return;
    }

    this.$store.commit("clearContext");
  }
}
export default interface MoveButton {
  isActiveButton: boolean;
}

</script>
