<template>
  <g v-if="support" class="automa-support-card" role="group" :aria-label="`Support card ${support.id}`">
    <rect class="card-face" width="60" height="130" rx="5" />
    <g
      class="behavior-heading"
      role="button"
      tabindex="0"
      :aria-label="label"
      :title="label"
      @click.stop="$emit('details')"
      @keydown.enter.prevent="$emit('details')"
      @keydown.space.prevent="$emit('details')"
    >
      <path class="heading-hit-area" d="M0 22V5Q0 0 5 0H55Q60 0 60 5V22Z" />
      <g class="symbol-art" aria-hidden="true">
        <g class="robot-icon" transform="translate(17, 12)">
          <path d="M0-7v-3M-11-2v5M11-2v5" />
          <rect x="-9" y="-6" width="18" height="13" rx="3" />
          <circle cx="-4" cy="-1" r="1.3" /><circle cx="4" cy="-1" r="1.3" />
          <path d="M-3 4h6" />
        </g>
        <text x="43" y="16" class="card-number">#{{ support.id }}</text>
      </g>
    </g>
    <g
      v-for="(symbol, i) in symbols"
      :key="symbol"
      :class="['support-symbol', { active: usage[symbol === 'booster' ? 'pass' : symbol] }]"
      :data-support="symbol"
      :transform="`translate(30, ${usage.pass ? 76 : 38 + i * 26})`"
      role="img"
      tabindex="0"
      :aria-label="descriptions[symbol]"
      :title="descriptions[symbol]"
      v-b-tooltip.nofade="tooltipConfig"
      @click.stop
    >
      <path v-if="symbol === 'numbered'" class="symbol-highlight" d="M-30-13H30V9Q30 14 25 14H-25Q-30 14-30 9Z" />
      <rect v-else class="symbol-highlight" x="-30" y="-13" width="60" height="26" />
      <g class="symbol-art" aria-hidden="true">
        <template v-if="symbol === 'scoring'">
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
        </template>
        <Resource v-else-if="symbol === 'range'" kind="r" :count="support.range" transform="scale(.85)" />
        <g
          v-else-if="symbol === 'direction'"
          :transform="support.directionalSelection === 'right-down' ? '' : 'rotate(180)'"
        >
          <path d="M-18-8H18L-18 1H18L-18 10H18m-5-4 5 4-5 4" class="selection-arrow" />
        </g>
        <template v-else-if="symbol === 'numbered'">
          <text y="0">{{ support.numberedSelectionCount }}</text>
          <path
            :transform="support.numberedSelection === 'right' ? '' : 'scale(-1, 1)'"
            d="M-18 7H18m-6-5 6 5-6 5"
            class="selection-arrow"
          />
        </template>
        <template v-else>
          <path v-if="engine.isLastRound" d="M-14 0l9 9 20-22" class="selection-arrow" />
          <g v-else>
            <rect
              v-for="(slot, index) in ['left', 'middle', 'right']"
              :key="slot"
              :x="-23 + index * 17"
              y="-15"
              width="12"
              height="30"
              rx="2"
              :fill="support.roundBoosterSelection === slot ? '#4aaf51' : '#eee'"
              stroke="#333"
            />
          </g>
        </template>
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
import { automaSupportDescriptions, automaSupportUsage } from "../data/automa";
import { tooltipTriggerConfig } from "../logic/tooltip";
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
  get descriptions() {
    return automaSupportDescriptions(this.engine);
  }
  get symbols() {
    return this.usage.pass ? ["booster"] : ["scoring", "range", "direction", "numbered"];
  }
  get label() {
    return `Automa behavior — support card ${this.support.id}. Show details`;
  }
  get tooltipConfig() {
    return { trigger: `${tooltipTriggerConfig().trigger} focus`, html: false };
  }
}
</script>

<style scoped>
.card-face {
  fill: #fff;
}
.card-outline {
  fill: none;
  stroke: #555;
  stroke-width: 1.3;
  pointer-events: none;
}
.behavior-heading {
  cursor: pointer;
}
.heading-hit-area {
  fill: #e3eff6;
}
.behavior-heading:hover .heading-hit-area,
.behavior-heading:focus-visible .heading-hit-area {
  stroke: #2878aa;
}
.symbol-art {
  pointer-events: none;
}
.robot-icon {
  fill: none;
  stroke: #283f51;
  stroke-width: 1.5;
  stroke-linecap: round;
}
.robot-icon circle {
  fill: #283f51;
  stroke: none;
}
.support-symbol {
  cursor: help;
}
.support-symbol .symbol-art {
  opacity: 0.45;
}
.support-symbol.active .symbol-art,
.support-symbol:hover .symbol-art,
.support-symbol:focus .symbol-art {
  opacity: 1;
}
.symbol-highlight {
  fill: transparent;
}
.active .symbol-highlight {
  fill: #e3eff6;
}
.support-symbol:hover .symbol-highlight,
.support-symbol:focus-visible .symbol-highlight {
  stroke: #2878aa;
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
.card-number {
  font-size: 12px;
}
</style>
