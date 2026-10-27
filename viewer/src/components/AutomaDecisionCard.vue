<template>
  <g
    class="automa-action-card automa-last-turn"
    role="button"
    tabindex="0"
    :aria-label="label"
    :title="label"
    v-b-tooltip.hover.nofade
    @click.stop="$emit('details')"
    @keydown.enter.prevent="$emit('details')"
    @keydown.space.prevent="$emit('details')"
  >
    <rect class="card-face" width="150" height="44" rx="5" />
    <g class="card-icons" aria-hidden="true">
      <text v-if="card" x="17" y="14" class="card-number">#{{ card.id }}</text>
      <path v-if="passed" d="M59 22l9 9 20-22" fill="none" stroke="#333" stroke-width="3" />
      <template v-else-if="card">
        <g v-if="card.action === 'faction'">
          <AutomaActionIcon
            v-for="(icon, i) in factionAction"
            :key="i"
            :icon="icon"
            :faction="player.faction"
            :flat="flat"
            :transform="`translate(${48 + i * 34}, 24) scale(.8)`"
          />
        </g>
        <template v-else>
          <Building
            v-if="card.action === 'build-mine'"
            building="m"
            :faction="player.faction"
            :flat="flat"
            :transform="`translate(65, 24) scale(${flat ? 4 : 2.5})`"
          />
          <AutomaActionIcon
            v-else
            :icon="actionIcon"
            :faction="player.faction"
            :flat="flat"
            transform="translate(65, 24)"
          />
          <g
            v-if="card.action === 'research-area-highest'"
            transform="translate(85, 20)"
            fill="none"
            stroke="#333"
            stroke-width="1.5"
          >
            <path d="M-3 2l3-3 3 3M-3-2l3-3 3 3" />
          </g>
          <Resource kind="vp" :count="card.victoryPoints" transform="translate(119, 24) scale(1.35)" />
        </template>
      </template>
      <g v-else transform="translate(41, 22)">
        <rect x="0" y="-13" width="19" height="26" rx="2" fill="#fff" stroke="#333" />
        <rect x="5" y="-10" width="19" height="26" rx="2" fill="#fff" stroke="#333" />
        <use xlink:href="#arrow" x="38" />
        <polygon points="57,-8 65,-16 77,-16 85,-8 85,8 77,16 65,16 57,8" fill="#ffa500" stroke="#333" />
      </g>
    </g>
  </g>
</template>

<script lang="ts">
import type Engine from "@gaia-project/engine";
import type { Player } from "@gaia-project/engine";
import { cards } from "@gaia-project/engine/src/automa/cards";
import { Component, Prop, Vue } from "vue-property-decorator";
import type { AutomaIcon } from "../data/automa";
import { automaFactionAction, describeAutomaAction } from "../data/automa";
import AutomaActionIcon from "./AutomaActionIcon.vue";
import Building from "./Building.vue";
import Resource from "./Resource.vue";

@Component({ components: { AutomaActionIcon, Building, Resource } })
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
  get label() {
    if (this.passed)
      return this.card
        ? `Action card ${this.card.id}: Automa passed. This card's action and VP were not used. Show details`
        : "Automa passed after exhausting its deck. Show details";
    if (!this.card) return "Automa draws cards to choose its actions. Show details";
    const action = {
      "build-mine": "Build a mine",
      upgrade: "Upgrade a structure",
      "power-qic": "Block a power/Q.I.C. action",
      "research-area-highest": "Advance a highest research track",
      "research-area-random": "Advance a research track using numbered selection",
      faction: "Faction action",
    }[this.card.action];
    const vp =
      this.card.action === "faction"
        ? this.factionAction.find((icon) => icon.kind === "vp").count
        : this.card.victoryPoints;
    const result = (this.engine.automa.lastActions ?? []).map(describeAutomaAction).join("; ");
    return `Action card ${this.card.id}: ${action}; ${vp} VP. Last turn: ${result || "no available action"}. Show details`;
  }
}
</script>

<style scoped>
.automa-action-card {
  cursor: pointer;
}
.card-face {
  fill: #ffffffa0;
  stroke: #555;
  stroke-width: 1;
}
.automa-action-card:hover .card-face,
.automa-action-card:focus-visible .card-face {
  stroke: #2878aa;
  stroke-width: 2;
}
.card-icons {
  pointer-events: none;
}
.card-number {
  text-anchor: middle;
  fill: #333;
  font-size: 12px;
  font-weight: bold;
}
</style>
