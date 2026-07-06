<template>
  <div class="sticky-resource-bar d-flex align-items-center flex-wrap">
    <svg viewBox="-8 -8 16 16" width="18" height="18">
      <Resource kind="c" :count="playerData.credits" tooltip="Credits" />
    </svg>
    <svg viewBox="-8 -8 16 16" width="18" height="18">
      <Resource kind="o" :count="playerData.ores" tooltip="Ore" />
    </svg>
    <svg viewBox="-8 -8 16 16" width="18" height="18">
      <Resource kind="k" :count="playerData.knowledge" tooltip="Knowledge" />
    </svg>
    <svg viewBox="-8 -8 16 16" width="18" height="18">
      <Resource kind="q" :count="playerData.qics" tooltip="Q.I.C." />
    </svg>
    <!-- 3 separate circles (not the player board's own triangular PowerBowls layout, which reads as
         "the same 3 identical bowls" at this small a scale) - one per bowl, each its own shade
         (reusing PowerBowls.vue's I/II/III colors) so which bowl is which is obvious at a glance.
         Taklons' Brainstone (a single shared token that substitutes for a normal power token in
         whichever bowl it currently sits in, see player.data.brainstone) gets its own small "B"
         badge in the corner of that bowl - same convention as the engine's own powerLogString(). -->
    <svg
      v-for="area in powerAreas"
      :key="area.key"
      viewBox="-10 -10 20 20"
      width="22"
      height="22"
      v-b-tooltip.hover
      :title="`Bowl ${area.label}: ${area.count} power${area.hasBrainstone ? ' (holds the Brainstone)' : ''}`"
    >
      <circle r="9.5" class="sticky-resource-bar__bowl" :style="`fill: ${area.color}`" />
      <text class="sticky-resource-bar__count">{{ area.count }}</text>
      <g v-if="area.hasBrainstone" transform="translate(6.5, -6.5)">
        <circle r="4.5" class="sticky-resource-bar__brainstone" />
        <text class="sticky-resource-bar__brainstone-label">B</text>
      </g>
    </svg>
    <svg viewBox="-8 -8 16 16" width="18" height="18">
      <Resource kind="gf" :count="availableGaiaformers" tooltip="Available Gaia Formers" />
    </svg>
    <svg viewBox="-24 -11 48 22" width="38" height="18">
      <Resource kind="r" :count="range" :tooltip="rangeTooltip" />
    </svg>
    <svg viewBox="-11 -8 22 16" width="24" height="18">
      <Resource kind="d" :count="playerData.terraformCostDiscount" tooltip="Terraforming Cost" />
    </svg>
    <svg viewBox="-8 -8 16 16" width="18" height="18">
      <Resource kind="vp" :count="playerData.victoryPoints" tooltip="Victory Points" />
    </svg>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Condition, effectiveRange, Player, PlayerData, PowerArea } from "@gaia-project/engine";
import Resource from "./Resource.vue";

type PowerAreaDisplay = { key: PowerArea; label: string; count: number; color: string; hasBrainstone: boolean };

// Same 3 shades as PowerBowls.vue's .power-bowl--1/2/3 (the player board's own bowl coloring) -
// kept as a literal copy rather than importing that component's CSS classes, so this bar's own
// compact circle-per-bowl layout doesn't couple to the player board's triangular arrangement.
const POWER_AREA_COLORS = ["#c9a3e0", "#9855c9", "#5c1f82"];

/** Compact, always-visible echo of the top-right/power-bowl corner of the player board (see
 * PlayerInfo.vue), reusing the same icon components at native size instead of the board's own
 * scale(0.1) - meant for the mobile sticky bar, where the full board can be scrolled out of view. */
@Component({
  components: { Resource },
})
export default class StickyResourceBar extends Vue {
  @Prop()
  player: Player;

  get playerData(): PlayerData {
    return this.player.data;
  }

  get powerAreas(): PowerAreaDisplay[] {
    const power = this.playerData.power;
    const brainstone = this.playerData.brainstone;
    return [
      { key: PowerArea.Area1, label: "I", count: power.area1, color: POWER_AREA_COLORS[0] },
      { key: PowerArea.Area2, label: "II", count: power.area2, color: POWER_AREA_COLORS[1] },
      { key: PowerArea.Area3, label: "III", count: power.area3, color: POWER_AREA_COLORS[2] },
    ].map((area) => ({ ...area, hasBrainstone: area.key === brainstone }));
  }

  get range(): number {
    return effectiveRange(this.playerData);
  }

  get rangeTooltip(): string {
    return this.range !== this.playerData.range
      ? "Range (includes +1 from the claimed Range spaceship tech tile)"
      : "Range";
  }

  get availableGaiaformers(): number {
    return this.player.eventConditionCount(Condition.GaiaFormer);
  }
}
</script>

<style lang="scss">
.sticky-resource-bar {
  gap: 0.35rem;
  min-height: 24px;
  // Centered as a group instead of left-packed - reads as one deliberate strip of info rather
  // than a leftover row of icons trailing off toward the left edge. The surrounding card/chip
  // look (background, border, radius) lives in Commands.vue's `.sticky-resource-bar-row` rule
  // instead of here, since that's specific to this component's mobile-sticky-bar context, not an
  // inherent part of the resource row itself.
  justify-content: center;

  svg {
    flex: 0 0 auto;
    overflow: visible;
  }

  // Matches Resource.vue's own count-text styling (its shared "text" rule) instead of a bespoke
  // weight/outline, so the bowl numbers read as the same typographic family as every other
  // resource count in this bar, just bigger.
  &__count {
    text-anchor: middle;
    dominant-baseline: central;
    font-size: 12px;
    font-weight: 600;
    fill: white;
    pointer-events: none;
  }

  // Taklons' Brainstone badge - a small black-and-white "B" circle overlaid on whichever bowl
  // currently holds it, distinct from the bowl's own count text so both stay legible together.
  &__brainstone {
    fill: #222;
    stroke: white;
    stroke-width: 1px;
  }

  &__brainstone-label {
    text-anchor: middle;
    dominant-baseline: central;
    font-size: 7px;
    font-weight: 700;
    fill: white;
    pointer-events: none;
  }
}
</style>
