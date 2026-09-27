<template>
  <svg class="mobile-action-icon" viewBox="-24 -16 48 32" aria-hidden="true" focusable="false">
    <Condition v-if="kind === 'research'" condition="a" />
    <g
      v-else-if="kind === 'board-actions' || kind === 'special-actions'"
      class="specialAction"
      :class="{ board: kind === 'board-actions' }"
    >
      <polygon points="-10,4 -4,10 4,10 10,4 10,-4 4,-10 -4,-10 -10,-4" transform="scale(1.3)" />
    </g>
    <g v-else-if="kind === 'federation' || kind === 'rescore-federation'">
      <image xlink:href="../assets/conditions/federation-used.svg" x="-13" y="-15" width="26" height="30" />
      <path
        v-if="kind === 'rescore-federation'"
        d="M12 -10a15 15 0 1 1 -20 -1M-8 -16v6h-6"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      />
    </g>
    <g v-else-if="kind === 'explore' || kind === 'ship-action'">
      <g v-if="kind === 'ship-action'" class="specialAction board">
        <polygon points="-10,4 -4,10 4,10 10,4 10,-4 4,-10 -4,-10 -10,-4" transform="scale(1.4)" />
      </g>
      <SpaceshipSymbol :transform="kind === 'ship-action' ? 'scale(.8)' : 'translate(-7 0)'" />
      <use v-if="kind === 'explore'" xlink:href="#arrow" x="8.7" />
    </g>
    <Resource v-else-if="kind === 'power-ring'" kind="power-ring" transform="scale(1.8)" />
    <g v-else-if="kind === 'instant-gaiaforming'">
      <image xlink:href="../assets/buildings/gaiaformer.svg" x="-23" y="-10" width="20" height="20" />
      <use xlink:href="#arrow" x="-4.3" />
      <circle cx="15" r="8" fill="var(--gaia)" stroke="currentColor" />
    </g>
    <g v-else-if="kind === 'swap-PI'">
      <!-- Standalone art: faction-specific SVG definitions may not exist for an absent faction. -->
      <image xlink:href="../assets/buildings/mine.svg" x="-22" y="-4" width="18" height="18" />
      <image xlink:href="../assets/buildings/planetary-institute.svg" x="3" y="-5" width="21" height="20" />
      <use xlink:href="#arrow" x="-6.3" y="-11" />
      <use xlink:href="#arrow" x="-6.3" y="-5" transform="scale(-1, 1)" />
    </g>
    <Resource v-else-if="kind === 'tech'" kind="tech" />
    <g v-else-if="kind === 'booster'">
      <rect x="-8" y="-14" width="16" height="28" rx="1.5" fill="var(--booster-tile)" stroke="currentColor" />
      <path d="M-8 -2H8" stroke="currentColor" />
      <Resource kind="o" transform="translate(0 -8) scale(.55)" />
      <Resource kind="c" transform="translate(0 6) scale(.55)" />
    </g>
    <g v-else-if="kind === 'artifact'">
      <ellipse rx="19" ry="12" fill="#d5a62a" stroke="#856719" />
      <path v-for="i in 16" :key="i" d="M0 -12V-8" :transform="`rotate(${i * 22.5})`" stroke="white" />
      <ellipse rx="14" ry="8" fill="var(--ui-surface)" />
    </g>
    <g v-else-if="kind === 'conversions'">
      <Resource kind="t" transform="translate(-14 0)" />
      <use xlink:href="#arrow" x="-6.3" />
      <Resource kind="c" transform="translate(16 0) scale(.8)" />
    </g>
  </svg>
</template>
<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import type { ButtonData } from "../data";
import Condition from "./Condition.vue";
import Resource from "./Resource.vue";
import SpaceshipSymbol from "./SpaceshipSymbol.vue";
@Component({ components: { Condition, Resource, SpaceshipSymbol } })
export default class MobileActionIcon extends Vue {
  @Prop({ required: true }) kind!: NonNullable<ButtonData["mobileIcon"]>;
}
</script>
