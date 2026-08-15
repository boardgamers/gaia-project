<template>
  <!-- Hover on devices that support it, click-to-toggle on touch-only devices (tooltipTriggerConfig) -
       a hover trigger on a touch device races its own show/hide against the global "close whatever
       tooltip is open" click handler in launcher.ts (see that file's comment), which is what caused
       tooltips to flash-and-vanish or get left open after tapping elsewhere. -->
  <svg
    viewBox="-25 -25 50 50"
    width="50"
    height="50"
    style="overflow: visible"
    v-b-tooltip.nofade="tooltipTriggerConfig()"
    :title="tooltip"
  >
    <g :class="['federationTile', { disabled, 'last-move': lastMove }]">
      <image xlink:href="../assets/conditions/federation.svg" :height=739/636*50 v-if="!disabled" style="color: #247B0A"
      width=50 x=-25 y=-25 :filter=filter /> <image xlink:href="../assets/conditions/federation-used.svg"
      v-if="disabled" :height=739/636*50 style="color: #247B0A" width=50 x=-25 y=-25 :filter=filter />
      <circle cx="16.5" cy="-16.5" r="8" stroke="black" stroke-width="1" fill="white" v-if="numTiles > 1" />
      <text x="16.5" y="-15.5" v-if="numTiles > 1">
        {{ numTiles }}
      </text>
      <!-- Mimics TechTile.vue's isTerraformMineTile icon (free mine + terraforming-step arrows), just
           with 3 arrows instead of 2 - this token's bonus Build-a-Mine action is the same shape as
           that Standard Tech tile's, one step more generous. A generic reward loop can't render this:
           it's not a plain reward (no direct resource gain). Inlines Resource.vue's own "step" markup
           (rather than using <Resource kind="step"> directly) because Resource.vue imports this file
           back for kind="fed", and importing Resource here in turn would be a circular dependency. -->
      <g v-if="isTerraformMineToken" style="pointer-events: none">
        <Building building="m" outline-white faction="gen" transform="translate(-11, 0) scale(2.2)" />
        <g transform="translate(8, 0) scale(1.3)">
          <image xlink:href="../assets/resources/dig-planet.svg" width="20" height="20" x="-10" y="-10" />
          <image xlink:href="../assets/resources/dig-arrow.svg" width="14" :height="(325 / 308) * 14" x="-14" y="-9" />
          <image xlink:href="../assets/resources/dig-arrow.svg" width="14" :height="(325 / 308) * 14" x="-10" y="-4" />
          <image xlink:href="../assets/resources/dig-arrow.svg" width="14" :height="(325 / 308) * 14" x="-6" y="1" />
        </g>
      </g>
      <!-- Same "free mine" pairing as the Terraform token above (a bonus Build-a-Mine action), just
           with the plain range icon instead of terraforming-step arrows, since this token's bonus
           mine has unlimited range rather than free terraforming steps. Was previously the generic
           "range" reward icon alone with no mine icon at all, reading as "gain range" rather than
           "gain a mine, at any range". -->
      <g v-else-if="isRangeMineToken" style="pointer-events: none" transform="translate(0, 3)">
        <Building building="m" outline-white faction="gen" transform="translate(-11, 0) scale(2.2)" />
        <g transform="translate(9, 0) scale(1.2)">
          <image xlink:href="../assets/resources/flat-hex.svg" :height="(162 / 328) * 20" width="15" y="-9" x="-2" />
          <image xlink:href="../assets/resources/flat-hex.svg" :height="(162 / 328) * 20" width="20" y="3" x="-10" />
          <image
            xlink:href="../assets/resources/range-arrow.svg"
            :height="(285 / 164) * 9"
            width="9"
            y="-8"
            x="-2"
            transform="rotate(5)"
          />
        </g>
        <!-- "unlimited range" - the plain hex+arrow range icon alone doesn't distinguish this from
             a normal +1/+2 range gain, so mark it with the infinity symbol used nowhere else in the
             icon set. -->
        <text x="9" y="14" class="lost-fleet-federation__unlimited">∞</text>
      </g>
      <g v-else-if="rewards.length > 0">
        <Resource
          v-for="(reward, i) in rewards"
          :key="i"
          :count="reward.count"
          :kind="reward.type"
          :transform="`translate(${i === 2 ? 0 : (i - Math.min(rewards.length - 1, 1) / 2) * 22}, ${
            rewards.length === 1 ? 12.5 : i === 2 ? -7 : 10
          })`"
        />
      </g>
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Federation as FederationEnum, PlayerEnum, Reward, SpaceshipFederation } from "@gaia-project/engine";
import { federationRewards } from "@gaia-project/engine/src/tiles/federations";
import { spaceshipFederationSpec } from "@gaia-project/engine/src/tiles/spaceship-federations";
import Building from "./Building.vue";
import { tooltipTriggerConfig } from "../logic/tooltip";

@Component({
  components: { Building },
})
export default class FederationTile extends Vue {
  @Prop()
  federation: FederationEnum;

  @Prop()
  used: boolean;

  @Prop({ default: "" })
  filter: string;

  @Prop()
  numTiles: number;

  /** Renders the same token art with custom reward icons (Lost Fleet spaceship Federation tokens). */
  @Prop()
  rewardsOverride?: Reward[];

  /** Set for Lost Fleet spaceship Federation tokens - drives this component's own tooltip (matching
   * every other tile type's self-hosted-tooltip convention) and the Terraform token's dedicated icon,
   * neither of which a bare `rewardsOverride: Reward[]` carries enough information for. */
  @Prop()
  spaceshipFederation?: SpaceshipFederation;

  /** Whose board this token sits on. Unset in the shared pool and on a ship's own Federation slot. */
  @Prop()
  player?: PlayerEnum;

  /**
   * An opponent claimed this token since the viewer's last turn - marked both on the pool stack it
   * came from (which has no owner, so any taker counts) and on the taker's own player board.
   */
  get lastMove(): boolean {
    const tile = this.spaceshipFederation ?? this.federation;
    const takers = tile !== undefined ? this.$store.getters.recentOpponentFederationTiles?.get(tile) : undefined;
    if (!takers) {
      return false;
    }
    return this.player === undefined || takers.has(this.$store.state.data.players[this.player]?.faction);
  }

  get rewards(): Reward[] {
    if (this.rewardsOverride) {
      return this.rewardsOverride;
    }
    return this.federation !== undefined ? federationRewards(this.federation) : [];
  }

  get isTerraformMineToken(): boolean {
    return this.spaceshipFederation === SpaceshipFederation.Terraform;
  }

  get isRangeMineToken(): boolean {
    return this.spaceshipFederation === SpaceshipFederation.Range;
  }

  get tooltip(): string | undefined {
    return this.spaceshipFederation !== undefined ? spaceshipFederationSpec[this.spaceshipFederation] : undefined;
  }

  get disabled() {
    return this.used || this.federation === FederationEnum.Fed1;
  }

  tooltipTriggerConfig = tooltipTriggerConfig;
}
</script>

<style lang="scss">
g {
  &.federationTile {
    polygon {
      stroke: #333;
      stroke-width: 0.02;
      fill: #c9ffca;
    }

    text {
      text-anchor: middle;
      dominant-baseline: middle;
      font-size: 12px;
      pointer-events: none;
    }

    .lost-fleet-federation__unlimited {
      font-size: 11px;
      font-weight: bold;
      fill: white;
      stroke: black;
      stroke-width: 0.5px;
    }
  }

  // Claimed by an opponent since the viewer's last turn. The token's art is an <image>, so there is
  // no shape to stroke - a stacked gold drop-shadow hugs the token's own silhouette instead.
  &.federationTile.last-move {
    filter: drop-shadow(0 0 1px var(--recent)) drop-shadow(0 0 2px var(--recent)) drop-shadow(0 0 3px var(--recent));
  }
}
</style>
