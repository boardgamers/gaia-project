<template>
  <g class="automa-status">
    <g
      class="automa-last-turn"
      transform="translate(1, 3.6) scale(.1)"
      role="img"
      :aria-label="lastTurnLabel"
      :title="lastTurnLabel"
      tabindex="0"
      v-b-tooltip.nofade="tooltipConfig"
    >
      <rect x="-5" y="-18" width="136" height="36" fill="transparent" />
      <g aria-hidden="true" class="status-icons">
        <g v-if="hasLastTurn">
          <path
            d="M3 8a7 7 0 1 1 .5 6M3 3v5h5M10 6v4l3 2"
            transform="translate(-3, -10)"
            fill="none"
            stroke="#333"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <g v-for="(action, i) in actions" :key="i" :transform="`translate(${40 + i * resultSpacing}, 0)`">
            <Building
              v-if="action[0] === 'build'"
              :building="action[1]"
              :faction="player.faction"
              :flat="flat"
              :transform="`scale(${flat ? 4 : 2.5})`"
            />
            <Condition v-else-if="action[0] === 'up'" condition="a" :color="`var(--rt-${action[1]})`" />
            <g v-else-if="action[0] === 'remove'">
              <Resource kind="tech" />
              <UsedActionMark transform="scale(.7)" />
            </g>
            <g v-else-if="action[0] === 'block'">
              <SpecialAction
                v-if="boardActions[action[1]]"
                :action="boardActions[action[1]].income"
                :board="true"
                x="-16"
                y="-16"
                width="32"
                height="32"
              />
              <MobileActionIcon v-else kind="ship-action" x="-24" y="-16" width="48" height="32" />
              <UsedActionMark transform="scale(.75)" />
            </g>
            <MobileActionIcon
              v-else-if="action[0] === 'explore'"
              kind="explore"
              x="-24"
              y="-16"
              width="48"
              height="32"
            />
            <path v-else-if="action[0] === 'pass'" d="M-9 1l6 6 14-16" fill="none" stroke="#333" stroke-width="3" />
          </g>
          <Resource
            v-if="victoryPoints"
            class="automa-last-vp"
            kind="vp"
            :count="victoryPoints"
            :transform="`translate(${40 + actions.length * resultSpacing}, 0) scale(1.4)`"
          />
        </g>
        <g v-else>
          <rect x="2" y="-12" width="17" height="24" rx="2" fill="#fff" stroke="#333" />
          <rect x="6" y="-9" width="17" height="24" rx="2" fill="#fff" stroke="#333" />
          <use xlink:href="#arrow" x="34" />
          <MobileActionIcon kind="special-actions" x="49" y="-16" width="48" height="32" />
        </g>
      </g>
    </g>
    <g
      class="automa-deck"
      transform="translate(32.5, .1) scale(.085)"
      role="button"
      tabindex="0"
      :aria-label="deckLabel"
      :title="deckLabel"
      @click.stop="$emit('details')"
      @keydown.enter.prevent="$emit('details')"
      @keydown.space.prevent="$emit('details')"
    >
      <rect class="deck-hit-area" x="-8" y="-5" width="62" height="38" rx="4" fill="transparent" />
      <g aria-hidden="true" class="status-icons">
        <rect x="0" y="0" width="20" height="26" rx="2" fill="#ffffff80" stroke="#333" />
        <rect x="4" y="3" width="20" height="26" rx="2" fill="#ffffff80" stroke="#333" />
        <rect x="8" y="6" width="20" height="26" rx="2" fill="#fff" stroke="#333" />
        <text x="41" y="23" class="deck-count">{{ engine.round ? engine.automa.remaining : "–" }}</text>
      </g>
    </g>
  </g>
</template>

<script lang="ts">
import type Engine from "@gaia-project/engine";
import type { Player } from "@gaia-project/engine";
import { boardActions } from "@gaia-project/engine";
import { Component, Prop, Vue } from "vue-property-decorator";
import { automaLastTurnPoints, describeAutomaAction } from "../data/automa";
import { tooltipTriggerConfig } from "../logic/tooltip";
import Building from "./Building.vue";
import Condition from "./Condition.vue";
import MobileActionIcon from "./MobileActionIcon.vue";
import Resource from "./Resource.vue";
import SpecialAction from "./SpecialAction.vue";
import UsedActionMark from "./UsedActionMark.vue";

@Component({ components: { Building, Condition, MobileActionIcon, Resource, SpecialAction, UsedActionMark } })
export default class AutomaStatus extends Vue {
  boardActions = boardActions;
  @Prop() player: Player;
  @Prop() engine: Engine;
  @Prop({ type: Boolean, default: false }) flat: boolean;

  get hasLastTurn() {
    return !!this.engine.automa.action || (this.engine.passedPlayers ?? []).includes(this.player.player);
  }
  get actions() {
    const state = this.engine.automa;
    // A new round clears the action card, but still retains the previous round's lastActions.
    return this.hasLastTurn ? (state.lastActions ?? []).map((action) => action.split(" ")) : [];
  }
  get victoryPoints() {
    return automaLastTurnPoints(this.engine, this.player);
  }
  get resultSpacing() {
    const count = this.actions.length + (this.victoryPoints ? 1 : 0);
    return Math.min(36, 72 / Math.max(1, count - 1));
  }
  get lastTurnLabel() {
    if (!this.hasLastTurn) return "Automa draws cards to choose its actions. It does not use normal resources.";
    const results = this.actions.map((a) => describeAutomaAction(a.join(" ")));
    if (this.victoryPoints) results.push(`${this.victoryPoints} VP`);
    return `Last Automa turn: ${results.join("; ") || "no available action"}`;
  }
  get deckLabel() {
    return this.engine.round
      ? `${this.engine.automa.remaining} cards left in Automa's draw pile — show details`
      : "Automa cards — show details";
  }
  get tooltipConfig() {
    return { trigger: `${tooltipTriggerConfig().trigger} focus` };
  }
}
</script>

<style scoped>
.automa-last-turn {
  cursor: help;
}
.automa-deck {
  cursor: pointer;
}
.automa-deck:hover .deck-hit-area,
.automa-deck:focus-visible .deck-hit-area {
  fill: #00000012;
  stroke: #333;
}
.status-icons {
  pointer-events: none;
}
.deck-count {
  font-size: 21px;
  font-weight: bold;
  text-anchor: middle;
  fill: #111;
}
</style>
