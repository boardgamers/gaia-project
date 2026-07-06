<template>
  <div class="sticky-resource-bar d-flex align-items-center flex-wrap">
    <svg viewBox="-8 -8 16 16" width="18" height="18">
      <Resource kind="vp" :count="playerData.victoryPoints" tooltip="Victory Points" />
    </svg>
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
    <svg viewBox="-9.5 -8.5 19 17" width="26" height="23" class="sticky-resource-bar__bowls">
      <PowerBowls :player="player" />
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
    <svg viewBox="-9 -9 18 18" width="20" height="20" v-b-tooltip.hover title="Sectors occupied">
      <Sector transform="scale(0.75)" />
      <text class="sticky-resource-bar__count">{{ sectors }}</text>
    </svg>
    <svg viewBox="-9 -9 18 18" width="20" height="20" v-b-tooltip.hover title="Federation tokens formed">
      <g transform="scale(0.28)">
        <Federation :used="true" />
      </g>
      <text class="sticky-resource-bar__count">{{ federations }}</text>
    </svg>
    <!-- Reuses the same per-track color variables (--rt-*) as the shared research board
         (ResearchTile.vue) - one small pip per track showing this player's current level, so the
         same "which track is which color" reading carries over to the sticky bar. -->
    <div class="sticky-resource-bar__research d-flex align-items-center" v-b-tooltip.hover title="Research levels">
      <svg viewBox="-8 -8 16 16" width="16" height="16" v-for="field in researchFields" :key="field">
        <circle r="7.5" :style="`fill: var(--rt-${field})`" />
        <text class="sticky-resource-bar__count">{{ playerData.research[field] }}</text>
      </svg>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, { Condition, effectiveRange, Player, PlayerData, ResearchField } from "@gaia-project/engine";
import Resource from "./Resource.vue";
import PowerBowls from "./PlayerBoard/PowerBowls.vue";
import Sector from "./Conditions/Sector.vue";
import Federation from "./FederationTile.vue";

/** Compact, always-visible echo of the top-right/power-bowl corner of the player board (see
 * PlayerInfo.vue), reusing the same icon components at native size instead of the board's own
 * scale(0.1) - meant for the mobile sticky bar, where the full board can be scrolled out of view. */
@Component({
  components: { Resource, PowerBowls, Sector, Federation },
})
export default class StickyResourceBar extends Vue {
  @Prop()
  player: Player;

  get engine(): Engine {
    return this.$store.state.data;
  }

  get playerData(): PlayerData {
    return this.player.data;
  }

  get sectors(): number {
    return this.player.eventConditionCount(Condition.Sector);
  }

  /** Federation tokens already formed - a cheap, always-available proxy for "federation progress"
   * (the true "how many satellites until the next federation" figure needs a spanning-tree search
   * over the map, `Player.possibleFederations()`, which is too expensive to recompute on every
   * render of an always-visible bar - see PERFORMANCE.md). */
  get federations(): number {
    return this.player.eventConditionCount(Condition.Federation);
  }

  get researchFields(): ResearchField[] {
    return ResearchField.values(this.engine.expansions);
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

  svg {
    flex: 0 0 auto;
    overflow: visible;
  }

  &__bowls {
    margin: 0 0.15rem;
  }

  &__research {
    gap: 0.05rem;
    border-left: 1px solid #ccc;
    padding-left: 0.35rem;
    margin-left: 0.1rem;
  }

  &__count {
    text-anchor: middle;
    dominant-baseline: central;
    font-size: 7px;
    font-weight: bold;
    fill: white;
    stroke: black;
    stroke-width: 0.4px;
    pointer-events: none;
  }
}
</style>
