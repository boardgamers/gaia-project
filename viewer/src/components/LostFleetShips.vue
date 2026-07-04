<template>
  <div v-if="isLostFleet" class="lost-fleet-ships">
    <svg
      v-for="ship in ships"
      :key="ship"
      class="lost-fleet-ship"
      :data-ship="ship"
      viewBox="0 0 291 76"
      style="overflow: visible"
    >
      <!-- header, single row: ship marker + full name side by side -->
      <g class="lost-fleet-ship__header">
        <g v-b-tooltip.hover :title="shipLabel(ship)">
          <circle cx="9" cy="9" r="8" class="lost-fleet-ship__marker-bg" />
          <text x="9" y="12" class="lost-fleet-ship__marker">{{ shipMarker(ship) }}</text>
        </g>
        <text x="21" y="12" class="lost-fleet-ship__name">{{ shipName(ship) }}</text>

        <!-- the 4 exploration-track slots (explored-by markers), same row as the ship name, not a
             separate row underneath - pushed to the right side of the header row (past the longest
             ship name, "Rebellion") while staying clear of the Federation token at x=172. Spaced 20
             apart (was 15, which nearly touched given the circles' own 16-unit diameter) for a clear
             gap between adjacent slots. -->
        <g
          v-for="slot in explorationSlots(ship)"
          :key="slot.index"
          class="lost-fleet-ship__slot"
          :data-slot="slot.index"
          :transform="`translate(${98 + (slot.index - 1) * 20}, 9)`"
          v-b-tooltip.hover
          :title="slotTitle(slot)"
        >
          <circle r="8" class="lost-fleet-ship__slot-bg" />
          <text y="-3" class="lost-fleet-ship__slot-ordinal">{{ slot.index }}</text>
          <template v-if="!slot.player">
            <!-- same charge/power badge used everywhere else (Resource kind="pw"), just scaled down -->
            <Resource v-if="slot.cost > 0" kind="pw" :count="slot.cost" transform="translate(0, 2) scale(0.5)" />
            <text v-else x="0" y="6.5" class="lost-fleet-ship__slot-cost">0</text>
          </template>
          <Token v-else :faction="slot.player.faction" transform="translate(0, 1) scale(0.34)" />
        </g>
      </g>

      <!-- the ship's 3 board actions, rendered exactly like the base game's BoardAction row -->
      <g
        v-for="(action, i) in shipActions(ship)"
        :key="action.type"
        :class="['lost-fleet-ship__action', action.type, { used: actionUser(ship, action.type) != null }]"
        :data-action="action.type"
        :transform="`translate(${29 + i * 54}, 44)`"
        v-b-tooltip.hover
        :title="actionTooltip(ship, action)"
      >
        <SpecialAction
          :action="actionIncome(ship, action.type)"
          :planet="actionPlanet(ship, action.type)"
          :board="true"
          x="-23"
          y="-25"
          width="46"
        />
        <g v-if="actionOverlay(ship, action.type)" class="lost-fleet-ship__action-overlay" transform="translate(0, -5)">
          <template v-if="isMineBubble(actionOverlay(ship, action.type))">
            <!-- same bubble language as Condition.vue's "mg" (mine on Gaia) VP icon, just bigger and asteroid-colored;
                 nudged down from the octagon's visual center so it doesn't crowd the cost badge above it -->
            <g transform="translate(0, 5) scale(1.2)">
              <circle r="10" :class="['planet-fill', actionOverlay(ship, action.type).planet]" />
              <Building
                :building="actionOverlay(ship, action.type).building"
                faction="gen"
                :flat="flat"
                outline-white
                transform="scale(1.9)"
              />
            </g>
          </template>
          <!-- resource-only overlays (no building) never get the building branch's compounded scale(2.2),
               so they read much smaller than their siblings - boost and re-center them here. -->
          <g
            v-else-if="actionOverlay(ship, action.type).resource && !actionOverlay(ship, action.type).building"
            transform="translate(0, 6) scale(1.3)"
          >
            <Resource :kind="actionOverlay(ship, action.type).resource" />
          </g>
          <g v-else-if="actionOverlay(ship, action.type).condition" transform="translate(2, 13) scale(0.48)">
            <Condition :condition="actionOverlay(ship, action.type).condition" />
          </g>
          <g v-else transform="scale(0.82)">
            <circle
              v-if="actionOverlay(ship, action.type).planet"
              r="9"
              :class="['planet-fill', actionOverlay(ship, action.type).planet]"
            />
            <Building
              v-if="actionOverlay(ship, action.type).building"
              :building="actionOverlay(ship, action.type).building"
              faction="gen"
              :flat="flat"
              outline-white
              :transform="`translate(${actionOverlay(ship, action.type).resource ? -6 : 0}, 0) scale(2.2)`"
            />
            <Resource
              v-if="actionOverlay(ship, action.type).resource"
              :kind="actionOverlay(ship, action.type).resource"
              :transform="`translate(${actionOverlay(ship, action.type).building ? 8 : 0}, 0)`"
            />
          </g>
        </g>
        <g :transform="costBadgeTransform(ship, action.type)">
          <image v-if="costKind(action.cost) === 'pw'" xlink:href="../assets/resources/power-charge.svg" width="20"
          :height=133/345*20 transform="scale(-1,1) translate(-9, -12)" />
          <rect
            x="-8"
            y="-8"
            width="16"
            height="16"
            :rx="costKind(action.cost) === 'pw' ? 8 : 0"
            :ry="costKind(action.cost) === 'pw' ? 8 : 0"
            stroke="black"
            stroke-width="1"
            :fill="costFill(action.cost)"
            transform="scale(0.8)"
          />
          <text x="-3" y="3.5" class="lost-fleet-ship__cost">{{ costNumber(action.cost) }}</text>
          <Resource
            v-for="(extra, j) in extraCosts(action.cost)"
            :key="j"
            :kind="extra.type"
            :count="extra.count"
            :transform="`translate(0, ${13 + j * 12}) scale(0.75)`"
          />
        </g>
        <g v-if="actionUser(ship, action.type) != null">
          <line y1="-11" y2="11" x1="-11" x2="11" stroke="#333" stroke-width="5" transform="translate(0, -5)" />
          <line y1="11" y2="-11" x1="-11" x2="11" stroke="#333" stroke-width="5" transform="translate(0, -5)" />
        </g>
      </g>

      <!-- the Federation token still up for grabs on this ship (base-game token art) - bottom-
           aligned with the action octagons' bottom edge (y=65, from translate(*, 44) + the -25/+21
           SpecialAction box). FederationTile is taller than the octagons (50 vs 46), so the extra
           height bleeds UP into the header row instead of stretching the bottom margin. -->
      <g data-section="federation" v-b-tooltip.hover :title="federationTooltip(ship)">
        <FederationTile
          v-if="shipFederation(ship)"
          :rewardsOverride="federationDisplayRewards(shipFederation(ship))"
          x="172"
          y="15"
          filter="url(#shadow-1)"
        />
        <FederationTile v-else :used="true" x="172" y="15" />
      </g>

      <!-- the Standard Tech tile seeded on this ship (Twilight has artifacts instead) - same
           bottom-alignment (y=65) as the federation token/actions. -->
      <g v-if="hasTechSlot(ship)" data-section="tech" transform="translate(225, 11) scale(0.9)">
        <TechTile :pos="ship" x="0" y="0" />
      </g>
      <!-- Twilight has no Standard Tech slot (see `hasTechSlot` above) - this artifact grid fills
           the exact same slot instead, so it must match that slot's own footprint precisely:
           TechTile's rendered box (from its `translate(225, 11) scale(0.9)` wrapper, a 60x64
           viewBox scaled to 0.9 = 54x57.6 screen units, an ~54x54 rendered footprint) is centered
           on screen at (252, 38) - center-x = 225 + 30*0.9 = 252, matching the same math for y.
           ArtifactIcon is itself a self-contained nested <svg> (viewBox -13 -13 26 26, rendered
           here at size=24, smaller than its native 30x30), so a translate(x, y) here moves its
           TOP-LEFT corner, not its visual center - its content actually renders 12 screen units
           right/down of that translate (half its 24-unit rendered size), which is why every
           offset below is the intended on-screen center minus 12. With up to 4 artifact slots
           (= player count, max 4p) this 2x2 grid (26-unit repeat, bigger than each icon's own
           24-unit size so consecutive icons no longer overlap) fits inside a 56x56 box centered
           on (252, 38) - i.e. within a couple of units of TechTile's own 54x54 footprint -
           instead of the old anchor (center-x 249, starting at y 44) that pushed the 2nd row down
           to a visual bottom edge of ~85, well past the ship's own 76-tall viewBox. -->
      <g v-else data-section="artifacts">
        <g
          v-for="(artifact, i) in remainingArtifacts"
          :key="artifact"
          :data-artifact="artifact"
          :transform="`translate(${224 + (i % 2) * 26}, ${10 + Math.floor(i / 2) * 26})`"
        >
          <!-- size=24 < the 26-unit grid repeat above, so consecutive icons no longer overlap
               (they used to, at the icon's native 30-unit size). -->
          <ArtifactIcon :artifact="artifact" :size="24" />
        </g>
      </g>
    </svg>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component } from "vue-property-decorator";
import Engine, {
  ArtifactToken,
  Condition as ConditionEnum,
  Expansion,
  hasExpansion,
  Planet,
  Player,
  Reward,
  Spaceship,
  SpaceshipFederation,
} from "@gaia-project/engine";
import { Player as PlayerEnum } from "@gaia-project/engine/src/enums";
import { EXPLORATION_CHARGE_TRACK, spaceshipActionEffects, spaceshipBoards, SpaceshipActionType, shipsInPlay } from "@gaia-project/engine/src/spaceships";
import { spaceshipFederationSpec } from "@gaia-project/engine/src/tiles/spaceship-federations";
import { spaceshipFederationDisplayRewards } from "../data/federations";
import {
  actionOverlay as actionOverlaySpec,
  ActionOverlay,
  costBadgeTransform as costBadgeTransformFn,
  costFill as costFillFn,
  costNumber as costNumberFn,
  costKind as costKindFn,
  extraCosts as extraCostsFn,
  isMineBubble as isMineBubbleFn,
  spaceshipLabels,
  spaceshipMarkers,
  spaceshipNames,
} from "../data/spaceships";
import { factionPiecePlanet } from "../graphics/utils";
import ArtifactIcon from "./ArtifactIcon.vue";
import Building from "./Building.vue";
import Condition from "./Condition.vue";
import FederationTile from "./FederationTile.vue";
import Resource from "./Resource.vue";
import SpecialAction from "./SpecialAction.vue";
import TechTile from "./TechTile.vue";
import Token from "./Token.vue";

@Component({
  components: {
    ArtifactIcon,
    Building,
    Condition,
    FederationTile,
    Resource,
    SpecialAction,
    TechTile,
    Token,
  },
})
export default class LostFleetShips extends Vue {
  get engine(): Engine {
    return this.$store.state.data;
  }

  get isLostFleet(): boolean {
    return hasExpansion(this.engine.expansions, Expansion.LostFleet);
  }

  get ships(): Spaceship[] {
    return shipsInPlay(this.engine.expansions, this.engine.players.length);
  }

  get flat(): boolean {
    return this.$store.state.preferences.flatBuildings;
  }

  get remainingArtifacts(): ArtifactToken[] {
    return this.engine.tiles.artifacts ?? [];
  }

  shipName(ship: Spaceship): string {
    return spaceshipNames[ship];
  }

  shipLabel(ship: Spaceship): string {
    return spaceshipLabels[ship];
  }

  shipMarker(ship: Spaceship): string {
    return spaceshipMarkers[ship];
  }

  shipActions(ship: Spaceship) {
    return spaceshipBoards[ship].actions;
  }

  actionIncome(ship: Spaceship, type: SpaceshipActionType): string[] {
    return spaceshipActionEffects[ship]?.[type] ?? [];
  }

  actionOverlay(ship: Spaceship, type: SpaceshipActionType): ActionOverlay | null {
    return actionOverlaySpec(ship, type);
  }

  actionUser(ship: Spaceship, type: SpaceshipActionType): Player | null {
    const player = this.engine.spaceshipActions[ship]?.[type];
    return player === undefined ? null : this.engine.player(player as PlayerEnum);
  }

  /** Colors a taken ship action's octagon by the taking player's faction, like base-game BoardAction. */
  actionPlanet(ship: Spaceship, type: SpaceshipActionType): Planet | null {
    const user = this.actionUser(ship, type);
    return user ? factionPiecePlanet(user.faction) : null;
  }

  isMineBubble(overlay: ActionOverlay): boolean {
    return isMineBubbleFn(overlay);
  }

  actionTooltip(ship: Spaceship, action: { type: SpaceshipActionType; cost: string; effect: string }): string {
    const user = this.actionUser(ship, action.type);
    const state = user ? ` - used by ${user.name || `P${user.player + 1}`} this round` : "";
    return `(${action.cost}): ${action.effect}${state}`;
  }

  costKind(cost: string): string {
    return costKindFn(cost);
  }

  costNumber(cost: string): number {
    return costNumberFn(cost);
  }

  extraCosts(cost: string): Reward[] {
    return extraCostsFn(cost);
  }

  costFill(cost: string): string {
    return costFillFn(cost);
  }

  costBadgeTransform(ship: Spaceship, type: SpaceshipActionType): string {
    return costBadgeTransformFn(ship, type);
  }

  hasTechSlot(ship: Spaceship): boolean {
    return spaceshipBoards[ship].hasStandardTechSlot;
  }

  shipFederation(ship: Spaceship): SpaceshipFederation | undefined {
    return this.engine.tiles.spaceshipFederations[ship];
  }

  federationDisplayRewards(federation: SpaceshipFederation): Reward[] {
    return spaceshipFederationDisplayRewards(federation);
  }

  federationTooltip(ship: Spaceship): string {
    const federation = this.shipFederation(ship);
    return federation ? spaceshipFederationSpec[federation] : "Federation token already claimed";
  }

  explorationSlots(ship: Spaceship): Array<{ index: number; cost: number; player: Player | null }> {
    return EXPLORATION_CHARGE_TRACK.map((cost, index) => ({
      index: index + 1,
      cost,
      player: this.engine.players.find((player) => player.data.explorationShips[ship] === index + 1) ?? null,
    }));
  }

  slotTitle(slot: { index: number; cost: number; player: Player | null }): string {
    if (slot.player) {
      return `Slot ${slot.index}: explored by ${slot.player.name || `P${slot.player.player + 1}`} (${slot.cost} power)`;
    }
    return `Slot ${slot.index}: open (charge ${slot.cost} power)`;
  }
}
</script>

<style lang="scss">
.lost-fleet-ships {
  display: grid;
  // Always 2 columns, so 4 ships land in exactly 2 rows (2 side by side, then 2 more) instead of a
  // single horizontally-scrolling row - the 3-ship 2-player case wraps its 3rd ship onto its own
  // second row the same way.
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
}

svg.lost-fleet-ship {
  width: 100%;
  height: auto;
  display: block;

  .lost-fleet-ship__name {
    font-size: 9px;
    font-weight: 700;
    fill: #172e62;
    pointer-events: none;
  }

  .lost-fleet-ship__marker-bg {
    fill: #efe6c4;
    stroke: #d8c57c;
    stroke-width: 1;
  }

  .lost-fleet-ship__marker {
    font-size: 10px;
    font-weight: 700;
    fill: #172e62;
    text-anchor: middle;
    pointer-events: none;
  }

  .lost-fleet-ship__slot-bg {
    fill: #eef2f8;
    stroke: #b8c2d4;
    stroke-width: 1;
  }

  .lost-fleet-ship__slot-ordinal {
    font-size: 5px;
    fill: #9aa4b2;
    text-anchor: middle;
    pointer-events: none;
  }

  .lost-fleet-ship__slot-cost {
    font-size: 7.5px;
    fill: #5f6773;
    text-anchor: middle;
    pointer-events: none;
  }

  .lost-fleet-ship__cost {
    fill: white !important;
    font-size: 12px;
  }

  .lost-fleet-ship__action.used {
    opacity: 0.7;
  }

  .lost-fleet-ship__action-overlay {
    pointer-events: none;

    circle.planet-fill {
      stroke: black;
      stroke-width: 0.5;
    }
  }

  .lost-fleet-ship__artifact-bg {
    fill: #efe6c4;
    stroke: #d8c57c;
    stroke-width: 1;
  }
}
</style>
