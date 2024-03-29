<template>
  <svg viewBox="-25 -25 50 50" width="50" height="50" style="overflow: visible">
    <g
      :class="['specialAction', { highlighted: isHighlighted, disabled, board, recent, warning }]"
      v-b-tooltip.html
      :title="button ? button.tooltip : null"
    >
      <polygon
        points="-10,4 -4,10 4,10 10,4 10,-4 4,-10 -4,-10 -10,-4"
        transform="scale(2.4)"
        @click="onClick"
        :class="`${planet != null ? 'planet-fill ' + planet : ''} special-action`"
      />
      <TechContent
        v-for="(act, i) in action"
        :key="i"
        :event="techEvent(act)"
        :transform="`translate(0, ${(i - (action.length - 1) / 2) * 24}) scale(${action.length === 1 ? 0.8 : 0.55})`"
      />
    </g>
    <g v-if="disabled">
      <line y1="-14" y2="14" x1="-14" x2="14" stroke="#333" stroke-width="5" />
      <line y1="14" y2="-14" x1="-14" x2="14" stroke="#333" stroke-width="5" />
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, { Event, Planet, Player } from "@gaia-project/engine";
import { ButtonData } from "../data";
import { specialActionButton } from "../logic/buttons/actions";
import { enabledButtonWarnings } from "../data/warnings";

@Component
export default class SpecialAction extends Vue {
  @Prop({ default: false })
  disabled: boolean;

  @Prop({ default: false })
  highlighted: boolean;

  @Prop({ default: false })
  board: boolean;

  @Prop({ default: false })
  recent: boolean;

  @Prop()
  action: string[];

  @Prop()
  planet: Planet;

  onClick() {
    if (!this._highlighted) {
      this.$emit("click");
      return;
    }
    this.$store.dispatch("specialActionClick", this.button);
  }

  get income() {
    return this.action.join(",");
  }

  techEvent(act: string): Event {
    return new Event((this.board ? '' : '>') + act);
  }

  get gameData(): Engine {
    return this.$store.state.data;
  }

  get button(): ButtonData | null {
    if (this.board) {
      return null;
    }
    const player = this.$store.state.player?.index ?? this.gameData.currentPlayer;
    return specialActionButton(this.income, this.gameData.player(player));
  }

  get warning(): boolean {
    const b = this.button;
    return b ? enabledButtonWarnings(b, this.$store.state.preferences).length > 0 : false;
  }

  /** When the action content is highlighted - not the parent component */
  get _highlighted() {
    const actions = this.$store.state.context.highlighted.specialActions;
    return actions.has(this.income) || actions.has(this.income.replace(/>/g, ""));
  }

  get isHighlighted() {
    return this.highlighted || this._highlighted;
  }
}
</script>

<style lang="scss">
g {
  &.specialAction {
    &.recent > polygon {
      stroke-width: 2;
      stroke: var(--recent);
    }

    & > polygon {
      stroke: black;
      stroke-width: 0.5;
      fill: var(--specialAction);
    }

    &.board > polygon:not(.planet-fill) {
      fill: var(--systemGray6);
    }

    &.highlighted > polygon {
      stroke: var(--highlighted);
      stroke-width: 1;
      cursor: pointer;
    }

    &.warning > .special-action {
      fill: var(--warning);
    }

    &.disabled {
      opacity: 0.5;
    }
  }
}
</style>
