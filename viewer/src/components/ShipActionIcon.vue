<template>
  <svg viewBox="-27 -32 54 54" width="54" height="54" style="overflow: visible">
    <g :class="['lost-fleet-ship__action', type]" v-b-tooltip.nofade.html="tooltipTriggerConfig()" :title="tooltip">
      <SpecialAction
        :class="{ faded: isUsed }"
        :action="actionIncome"
        :planet="actionPlanet"
        :board="true"
        x="-23"
        y="-28"
        width="46"
      />
      <g v-if="overlay" class="lost-fleet-ship__action-overlay" transform="translate(0, -5)">
        <template v-if="isMineBubble(overlay)">
          <!-- same bubble language as Condition.vue's "mg" (mine on Gaia) VP icon, just bigger and asteroid-colored;
               nudged down from the octagon's visual center so it doesn't crowd the cost badge above it -->
          <g transform="translate(0, 5) scale(1.2)">
            <circle r="10" :class="['planet-fill', overlay.planet]" />
            <Building :building="overlay.building" faction="gen" :flat="flat" outline-white transform="scale(1.9)" />
          </g>
        </template>
        <!-- resource-only overlays (no building) never get the building branch's compounded scale(2.2),
             so they read much smaller than their siblings - boost and re-center them here. -->
        <g v-else-if="overlay.resource && !overlay.building" transform="translate(0, 6) scale(1.3)">
          <Resource :kind="overlay.resource" />
        </g>
        <g v-else-if="overlay.condition" transform="translate(2, 13) scale(0.48)">
          <Condition :condition="overlay.condition" />
        </g>
        <g v-else transform="scale(0.82)">
          <circle v-if="overlay.planet" r="9" :class="['planet-fill', overlay.planet]" />
          <Building
            v-if="overlay.building"
            :building="overlay.building"
            faction="gen"
            :flat="flat"
            outline-white
            :transform="`translate(${overlay.resource ? -6 : 0}, 0) scale(2.2)`"
          />
          <Resource
            v-if="overlay.resource"
            :kind="overlay.resource"
            :transform="`translate(${overlay.building ? 8 : 0}, 0)`"
          />
        </g>
      </g>
      <g :transform="costBadgeTransform(ship, type)">
        <image v-if="costKind(cost) === 'pw'" xlink:href="../assets/resources/power-charge.svg" width="20"
        :height=133/345*20 transform="scale(-1,1) translate(-9, -12)" />
        <rect
          x="-8"
          y="-8"
          width="16"
          height="16"
          :rx="costKind(cost) === 'pw' ? 8 : 0"
          :ry="costKind(cost) === 'pw' ? 8 : 0"
          stroke="black"
          stroke-width="1"
          :fill="costFill(cost)"
          transform="scale(0.8)"
        />
        <text x="-3" y="3.5" class="lost-fleet-ship__cost">{{ costNumber(cost) }}</text>
        <Resource
          v-for="(extra, j) in extraCosts(cost)"
          :key="j"
          :kind="extra.type"
          :count="extra.count"
          :transform="`translate(0, ${13 + j * 12}) scale(0.75)`"
        />
      </g>
      <UsedActionMark v-if="isUsed" transform="translate(0, -5)" />
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, { Planet, Player, Spaceship } from "@gaia-project/engine";
import { Player as PlayerEnum } from "@gaia-project/engine/src/enums";
import { spaceshipActionEffects, spaceshipBoards, SpaceshipActionType } from "@gaia-project/engine/src/spaceships";
import { factionPiecePlanet } from "../graphics/utils";
import {
  actionOverlay,
  costBadgeTransform,
  costFill,
  costKind,
  costNumber,
  extraCosts,
  isMineBubble,
} from "../data/spaceships";
import Building from "./Building.vue";
import Condition from "./Condition.vue";
import Resource from "./Resource.vue";
import SpecialAction from "./SpecialAction.vue";
import UsedActionMark from "./UsedActionMark.vue";
import { tooltipTriggerConfig } from "../logic/tooltip";

/** A single ship board action, rendered as a self-contained icon (cost badge + effect octagon) -
 * the same visual language as the base game's BoardAction, reused both on the read-only ship board
 * strip (LostFleetShips.vue) and as an icon-only button (RichTextView.vue's "spaceshipAction" case). */
@Component({
  components: { Building, Condition, Resource, SpecialAction, UsedActionMark },
})
export default class ShipActionIcon extends Vue {
  @Prop()
  ship: Spaceship;

  @Prop()
  type: SpaceshipActionType;

  get engine(): Engine {
    return this.$store.state.data;
  }

  get flat(): boolean {
    return this.$store.state.preferences.flatBuildings;
  }

  get action(): { type: SpaceshipActionType; cost: string; effect: string } {
    return spaceshipBoards[this.ship].actions.find((a) => a.type === this.type);
  }

  get cost(): string {
    return this.action.cost;
  }

  get actionIncome(): string[] {
    return spaceshipActionEffects[this.ship]?.[this.type] ?? [];
  }

  get overlay() {
    return actionOverlay(this.ship, this.type);
  }

  get user(): Player | null {
    const player = this.engine.spaceshipActions[this.ship]?.[this.type];
    return player === undefined ? null : this.engine.player(player as PlayerEnum);
  }

  get isUsed(): boolean {
    return this.user != null;
  }

  /** Colors a taken ship action's octagon by the taking player's faction, like base-game BoardAction. */
  get actionPlanet(): Planet | null {
    return this.user ? factionPiecePlanet(this.user.faction) : null;
  }

  get tooltip(): string {
    const state = this.user ? ` - used by ${this.user.name || `P${this.user.player + 1}`} this round` : "";
    return `(${this.action.cost}): ${this.action.effect}${state}`;
  }

  isMineBubble = isMineBubble;
  costKind = costKind;
  costNumber = costNumber;
  costFill = costFill;
  extraCosts = extraCosts;
  costBadgeTransform = costBadgeTransform;
  tooltipTriggerConfig = tooltipTriggerConfig;
}
</script>

<style lang="scss">
g.lost-fleet-ship__action {
  .lost-fleet-ship__cost {
    fill: white !important;
    font-size: 12px;
  }

  .lost-fleet-ship__action-overlay {
    pointer-events: none;

    circle.planet-fill {
      stroke: black;
      stroke-width: 0.5;
    }
  }
}
</style>
