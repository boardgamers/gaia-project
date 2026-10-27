<template>
  <g class="automa-status">
    <AutomaDecisionCard
      :player="player"
      :engine="engine"
      :flat="flat"
      transform="translate(1, 1.9) scale(.085)"
      @details="$emit('details')"
    />
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
import { Component, Prop, Vue } from "vue-property-decorator";
import AutomaDecisionCard from "./AutomaDecisionCard.vue";

@Component({ components: { AutomaDecisionCard } })
export default class AutomaStatus extends Vue {
  @Prop() player: Player;
  @Prop() engine: Engine;
  @Prop({ type: Boolean, default: false }) flat: boolean;

  get deckLabel() {
    return this.engine.round
      ? `${this.engine.automa.remaining} cards left in Automa's draw pile — show details`
      : "Automa cards — show details";
  }
}
</script>

<style scoped>
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
