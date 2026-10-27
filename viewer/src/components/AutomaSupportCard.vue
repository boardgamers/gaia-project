<template>
  <g
    v-if="support"
    class="automa-support-card"
    role="button"
    tabindex="0"
    :aria-label="label"
    :title="label"
    @click.stop="$emit('details')"
    @keydown.enter.prevent="$emit('details')"
    @keydown.space.prevent="$emit('details')"
  >
    <rect class="card-face" width="60" height="112" rx="5" />
    <g aria-hidden="true" class="card-symbols">
      <template v-if="!usage.pass">
        <g :class="['support-symbol', { active: usage.scoring }]" data-support="scoring" transform="translate(30, 15)">
          <rect class="symbol-highlight" x="-26" y="-11" width="52" height="24" rx="3" />
          <rect
            x="-9"
            y="-10"
            width="18"
            height="10"
            rx="2"
            :fill="support.scoringFinalTiebreaker === 'top' ? '#4aaf51' : '#eee'"
            stroke="#333"
          />
          <rect
            x="-9"
            y="3"
            width="18"
            height="10"
            rx="2"
            :fill="support.scoringFinalTiebreaker === 'bottom' ? '#4aaf51' : '#eee'"
            stroke="#333"
          />
          <path v-if="support.scoringFinalTiebreaker === 'none'" d="M-12 15L12-12" class="selection-arrow" />
        </g>
        <g :class="['support-symbol', { active: usage.range }]" data-support="range" transform="translate(30, 42)">
          <rect class="symbol-highlight" x="-26" y="-12" width="52" height="24" rx="3" />
          <Resource kind="r" :count="support.range" transform="scale(.85)" />
        </g>
        <g
          :class="['support-symbol', { active: usage.direction }]"
          data-support="direction"
          transform="translate(30, 69)"
        >
          <rect class="symbol-highlight" x="-26" y="-12" width="52" height="24" rx="3" />
          <g :transform="support.directionalSelection === 'right-down' ? '' : 'rotate(180)'">
            <path d="M-18-8H18L-18 1H18L-18 10H18m-5-4 5 4-5 4" class="selection-arrow" />
          </g>
        </g>
        <g
          :class="['support-symbol', { active: usage.numbered }]"
          data-support="numbered"
          transform="translate(30, 96)"
        >
          <rect class="symbol-highlight" x="-26" y="-12" width="52" height="24" rx="3" />
          <text y="0">{{ support.numberedSelectionCount }}</text>
          <path
            :transform="support.numberedSelection === 'right' ? '' : 'scale(-1, 1)'"
            d="M-18 7H18m-6-5 6 5-6 5"
            class="selection-arrow"
          />
        </g>
      </template>
      <g v-else data-support="booster" transform="translate(30, 56)">
        <path v-if="engine.isLastRound" d="M-14 0l9 9 20-22" class="selection-arrow" />
        <g v-else>
          <rect
            v-for="(slot, i) in ['left', 'middle', 'right']"
            :key="slot"
            :x="-23 + i * 17"
            y="-15"
            width="12"
            height="30"
            rx="2"
            :fill="support.roundBoosterSelection === slot ? '#4aaf51' : '#eee'"
            stroke="#333"
          />
        </g>
      </g>
    </g>
  </g>
</template>

<script lang="ts">
import type Engine from "@gaia-project/engine";
import type { Player } from "@gaia-project/engine";
import { cards } from "@gaia-project/engine/src/automa/cards";
import { Component, Prop, Vue } from "vue-property-decorator";
import { automaSupportUsage } from "../data/automa";
import Resource from "./Resource.vue";

@Component({ components: { Resource } })
export default class AutomaSupportCard extends Vue {
  @Prop() player: Player;
  @Prop() engine: Engine;

  get support() {
    return cards.find((card) => card.id === this.engine.automa?.support);
  }
  get usage() {
    return automaSupportUsage(this.engine, this.player);
  }
  get label() {
    return `Support card ${this.support.id} — values for the last Automa turn. Show details`;
  }
}
</script>

<style scoped>
.automa-support-card {
  cursor: pointer;
}
.card-face {
  fill: #fff;
  stroke: #555;
  stroke-width: 1.3;
}
.automa-support-card:hover .card-face,
.automa-support-card:focus-visible .card-face {
  stroke: #2878aa;
  stroke-width: 2.5;
}
.card-symbols {
  pointer-events: none;
}
.support-symbol {
  opacity: 0.45;
}
.support-symbol.active {
  opacity: 1;
}
.symbol-highlight {
  fill: none;
}
.active .symbol-highlight {
  fill: #e3eff6;
}
.selection-arrow {
  fill: none;
  stroke: #222;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
text {
  text-anchor: middle;
  font-weight: bold;
  font-size: 15px;
  fill: #111;
}
</style>
