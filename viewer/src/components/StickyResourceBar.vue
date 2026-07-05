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
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Condition, effectiveRange, Player, PlayerData } from "@gaia-project/engine";
import Resource from "./Resource.vue";
import PowerBowls from "./PlayerBoard/PowerBowls.vue";

/** Compact, always-visible echo of the top-right/power-bowl corner of the player board (see
 * PlayerInfo.vue), reusing the same icon components at native size instead of the board's own
 * scale(0.1) - meant for the mobile sticky bar, where the full board can be scrolled out of view. */
@Component({
  components: { Resource, PowerBowls },
})
export default class StickyResourceBar extends Vue {
  @Prop()
  player: Player;

  get playerData(): PlayerData {
    return this.player.data;
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
}
</style>
