<template>
  <g class="automa-action-card" role="group" :aria-label="card ? `Action card ${card.id}` : 'Automa action'">
    <rect class="card-face" width="60" height="130" rx="5" />
    <g
      class="action-heading"
      role="button"
      tabindex="0"
      :aria-label="label"
      :title="label"
      @click.stop="$emit('details')"
      @keydown.enter.prevent="$emit('details')"
      @keydown.space.prevent="$emit('details')"
    >
      <path d="M0 22V5Q0 0 5 0H55Q60 0 60 5V22Z" fill="#f1e5c9" />
      <g class="symbol-art" aria-hidden="true">
        <path d="M19 5l-9 9h6l-2 7 9-10h-6Z" fill="#555" />
        <text v-if="card" x="43" y="16" class="card-number">#{{ card.id }}</text>
      </g>
    </g>
    <template v-if="card">
      <g
        :class="['decision-symbol', 'card-action-symbol', { inactive: passed }]"
        role="img"
        tabindex="0"
        :aria-label="actionLabel"
        :title="actionLabel"
        v-b-tooltip.nofade="tooltipConfig"
        @click.stop
      >
        <rect
          class="symbol-hit-area"
          y="22"
          width="60"
          :height="card.action === 'faction' ? 108 : card.pass ? 47 : 63"
        />
        <g v-if="card.action === 'faction'" class="symbol-art faction-action-reference" aria-hidden="true">
          <MobileActionIcon kind="special-actions" x="2" y="42" width="56" height="48" />
          <path d="M37 97l-14 14m0-9v9h9" fill="none" stroke="#555" stroke-width="2" />
        </g>
        <g v-else class="symbol-art" aria-hidden="true" :transform="`translate(30, ${card.pass ? 47 : 57})`">
          <Building
            v-if="card.action === 'build-mine'"
            building="m"
            :faction="player.faction"
            :flat="flat"
            :transform="`scale(${flat ? 4 : 2.5})`"
          />
          <AutomaActionIcon v-else :icon="actionIcon" :faction="player.faction" :flat="flat" />
          <g
            v-if="card.action === 'research-area-highest'"
            transform="translate(19, -9)"
            fill="none"
            stroke="#333"
            stroke-width="1.5"
          >
            <path d="M-3 2l3-3 3 3M-3-2l3-3 3 3" />
          </g>
        </g>
      </g>
      <g
        v-if="card.action !== 'faction'"
        :class="['decision-symbol', 'card-vp-symbol', { inactive: passed }]"
        role="img"
        tabindex="0"
        :aria-label="pointsLabel"
        :title="pointsLabel"
        v-b-tooltip.nofade="tooltipConfig"
        @click.stop
      >
        <rect class="symbol-hit-area" :y="card.pass ? 69 : 85" width="60" :height="card.pass ? 33 : 45" />
        <g class="symbol-art" aria-hidden="true">
          <Resource
            kind="vp"
            :count="card.victoryPoints"
            :transform="`translate(30, ${card.pass ? 84 : 105}) scale(1.65)`"
          />
        </g>
      </g>
      <g
        v-if="card.pass"
        :class="['decision-symbol', 'automa-pass-symbol', { active: passActive, inactive: !passActive }]"
        role="img"
        tabindex="0"
        :aria-label="passLabel"
        :title="passLabel"
        v-b-tooltip.nofade="tooltipConfig"
        @click.stop
      >
        <rect class="symbol-hit-area" y="102" width="60" height="28" />
        <path class="symbol-art" aria-hidden="true" d="M20 116l6 6 14-16" fill="none" stroke="#333" stroke-width="3" />
      </g>
    </template>
    <g v-else class="symbol-art" aria-hidden="true">
      <path v-if="passed" d="M15 72l9 9 20-22" fill="none" stroke="#333" stroke-width="3" />
      <g v-else transform="translate(18, 72)">
        <rect x="0" y="-13" width="19" height="26" rx="2" fill="#fff" stroke="#333" />
        <rect x="5" y="-10" width="19" height="26" rx="2" fill="#fff" stroke="#333" />
      </g>
    </g>
    <rect class="card-outline" width="60" height="130" rx="5" />
  </g>
</template>

<script lang="ts">
import type Engine from "@gaia-project/engine";
import type { Player } from "@gaia-project/engine";
import { cards } from "@gaia-project/engine/src/automa/cards";
import { Component, Prop, Vue } from "vue-property-decorator";
import type { AutomaIcon } from "../data/automa";
import { automaFactionAction, describeAutomaAction } from "../data/automa";
import { tooltipTriggerConfig } from "../logic/tooltip";
import AutomaActionIcon from "./AutomaActionIcon.vue";
import Building from "./Building.vue";
import MobileActionIcon from "./MobileActionIcon.vue";
import Resource from "./Resource.vue";

@Component({ components: { AutomaActionIcon, Building, MobileActionIcon, Resource } })
export default class AutomaDecisionCard extends Vue {
  @Prop() player: Player;
  @Prop() engine: Engine;
  @Prop({ type: Boolean, default: false }) flat: boolean;
  get card() {
    return cards.find((card) => card.id === this.engine.automa?.action);
  }
  get passed() {
    return (this.engine.passedPlayers ?? []).includes(this.player.player) || this.engine.ended;
  }
  get factionAction() {
    return automaFactionAction(this.player.faction);
  }
  get actionIcon(): AutomaIcon {
    return {
      kind: this.card.action === "upgrade" ? "upgrade" : this.card.action === "power-qic" ? "block" : "research",
    };
  }
  get passActive() {
    return this.card?.pass && this.engine.automa.remaining < 3;
  }
  get passLabel() {
    return this.passActive
      ? "This is one of the last three cards: Automa passes and scores the round tile. The support card chooses its next booster."
      : "Pass only when drawn among the last three cards. Drawn earlier, this card resolves its action and VP normally.";
  }
  get actionDescription() {
    return {
      "build-mine": "Build a mine",
      upgrade: "Upgrade a structure",
      "power-qic": "Block a power/Q.I.C. action",
      "research-area-highest": "Advance a highest research track",
      "research-area-random": "Advance a research track using numbered selection",
      faction: "Resolve the full faction action shown at the bottom left of the board",
    }[this.card.action];
  }
  get actionLabel() {
    return `${this.actionDescription}.${this.passed ? " Passing replaces this action." : ""}`;
  }
  get pointsLabel() {
    return this.passed
      ? `${this.card.victoryPoints} VP for the card's action. Passing scores the round tile instead.`
      : `Gain ${this.card.victoryPoints} VP after this action, even if it cannot be completed.`;
  }
  get tooltipConfig() {
    return { trigger: `${tooltipTriggerConfig().trigger} focus`, html: false };
  }
  get label() {
    if (this.passed)
      return this.card
        ? `Action card ${this.card.id}: Automa passed. Show details`
        : "Automa passed after exhausting its deck. Show details";
    if (!this.card) return "Automa draws cards to choose its actions. Show details";
    const vp =
      this.card.action === "faction"
        ? this.factionAction.find((icon) => icon.kind === "vp").count
        : this.card.victoryPoints;
    const result = (this.engine.automa.lastActions ?? []).map(describeAutomaAction).join("; ");
    return `Action card ${this.card.id}: ${this.actionDescription}; ${vp} VP. Last turn: ${result || "no available action"}. Show details`;
  }
}
</script>

<style scoped>
.action-heading {
  cursor: pointer;
}
.card-face {
  fill: #ffffffa0;
}
.card-outline {
  fill: none;
  stroke: #555;
  stroke-width: 1;
  pointer-events: none;
}
.automa-action-card:hover .card-outline,
.automa-action-card:focus-within .card-outline {
  stroke: #2878aa;
  stroke-width: 2;
}
.symbol-art {
  pointer-events: none;
}
.decision-symbol {
  cursor: help;
}
.decision-symbol.inactive .symbol-art {
  opacity: 0.4;
}
.symbol-hit-area {
  fill: transparent;
}
.card-number {
  text-anchor: middle;
  fill: #333;
  font-size: 12px;
  font-weight: bold;
}
</style>
