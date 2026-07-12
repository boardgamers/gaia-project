<template>
  <div v-if="isLostFleet" class="lost-fleet-ships">
    <svg
      v-for="ship in ships"
      :key="ship"
      class="lost-fleet-ship"
      :data-ship="ship"
      viewBox="0 -16 291 68"
      style="overflow: visible"
    >
      <!-- The board is a rounded card outlined in the ship's color. Its name and the player
           (exploration) slots live in two tabs that sit on top of this card's top edge (drawn last,
           below), which frees the card interior for just the action row + Federation/Tech tiles and
           lets the whole board be shorter than when those lived inside it. -->
      <rect
        x="1.25"
        y="0"
        width="288.5"
        height="50"
        rx="7"
        ry="7"
        class="lost-fleet-ship__card"
        :style="{ stroke: shipColor(ship) }"
      />

      <!-- the ship's 3 board actions, rendered exactly like the base game's BoardAction row -->
      <g
        v-for="(action, i) in shipActions(ship)"
        :key="action.type"
        :class="['lost-fleet-ship__action', action.type, { used: actionUser(ship, action.type) != null }]"
        :data-action="action.type"
        :transform="`translate(${29 + i * 54}, 25)`"
        v-b-tooltip.hover.nofade
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

      <!-- the Federation token still up for grabs on this ship (base-game token art), scaled down a
           touch (0.8) and centered in the shorter card so the board can be more compact now that the
           name/slots have moved out to the tabs. -->
      <g data-section="federation" transform="translate(173, 5) scale(0.8)">
        <FederationTile
          v-if="shipFederation(ship)"
          :rewardsOverride="federationDisplayRewards(shipFederation(ship))"
          :spaceship-federation="shipFederation(ship)"
          x="0"
          y="0"
          filter="url(#shadow-1)"
        />
        <g v-else v-b-tooltip.hover.click :title="federationTooltip(ship)">
          <FederationTile :used="true" x="0" y="0" />
        </g>
      </g>

      <!-- the Standard Tech tile seeded on this ship (Twilight has artifacts instead), centered in
           the card beside the Federation tile. -->
      <g v-if="hasTechSlot(ship)" data-section="tech" transform="translate(223, 6) scale(0.82)">
        <TechTile :pos="ship" x="0" y="0" />
      </g>
      <!-- Twilight has no Standard Tech slot (see `hasTechSlot` above) - this artifact grid fills the
           same right-hand slot instead, a 2-column grid sized to fit the shorter card (up to 4
           artifacts = player count at 4p, so 2 rows). -->
      <g v-else data-section="artifacts">
        <g
          v-for="(artifact, i) in remainingArtifacts"
          :key="artifact"
          :data-artifact="artifact"
          :transform="`translate(${224 + (i % 2) * 26}, ${5 + Math.floor(i / 2) * 23})`"
        >
          <ArtifactIcon :artifact="artifact" :size="22" />
        </g>
      </g>

      <!-- Left tab: the ship name, sitting like a folder tab on the card's top-left border, filled
           in the ship color (dark text, which reads better than white on the lighter ship colors). -->
      <g class="lost-fleet-ship__tab" v-b-tooltip.hover.nofade :title="shipLabel(ship)">
        <path :d="nameTabPath(ship)" :style="{ fill: shipColor(ship) }" class="lost-fleet-ship__tab-shape" />
        <text :x="nameTabCenterX(ship)" y="-7" dy="3.1" class="lost-fleet-ship__name">{{ shipFullName(ship) }}</text>
      </g>

      <!-- Right tab: the 4 exploration/player slots, its negative space filled in the ship color and
           the slot circles (charge-power icons, or a claiming player's token) sitting on top. -->
      <g class="lost-fleet-ship__tab">
        <path :d="slotsTabPath" :style="{ fill: shipColor(ship) }" class="lost-fleet-ship__tab-shape" />
        <g
          v-for="slot in explorationSlots(ship)"
          :key="slot.index"
          class="lost-fleet-ship__slot"
          :data-slot="slot.index"
          :transform="`translate(${slotTabX(slot.index)}, -7)`"
          v-b-tooltip.hover.nofade
          :title="slotTitle(slot)"
        >
          <circle r="6" class="lost-fleet-ship__slot-bg" />
          <template v-if="!slot.player">
            <!-- the free (0-power) slot shows no number at all - a bare circle reads as "free". -->
            <Resource v-if="slot.cost > 0" kind="pw" :count="slot.cost" transform="translate(0, 1.5) scale(0.38)" />
          </template>
          <Token v-else :faction="slot.player.faction" transform="translate(0, 0.7) scale(0.26)" />
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
import {
  EXPLORATION_CHARGE_TRACK,
  spaceshipActionEffects,
  spaceshipBoards,
  SpaceshipActionType,
  shipsInPlay,
} from "@gaia-project/engine/src/spaceships";
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
  spaceshipColors,
  spaceshipDisplayNames,
  spaceshipLabels,
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

  shipLabel(ship: Spaceship): string {
    return spaceshipLabels[ship];
  }

  shipColor(ship: Spaceship): string {
    return spaceshipColors[ship];
  }

  /** Full uppercase ship name shown in the left tab, e.g. "REBELLION" ("T F Mars" -> "MARS"). */
  shipFullName(ship: Spaceship): string {
    return spaceshipDisplayNames[ship].toUpperCase();
  }

  /** Width of the left (name) tab, sized to the ship name (~6.4 units per uppercase letter + padding). */
  private nameTabWidth(ship: Spaceship): number {
    return Math.max(42, this.shipFullName(ship).length * 6.4 + 18);
  }

  /** Rounded-top "folder tab" outline: flat bottom on the card's top border, rounded top corners. */
  private tabPath(x0: number, x1: number): string {
    const r = 6;
    const top = -15;
    const bot = 1;
    return `M${x0},${bot} L${x0},${top + r} Q${x0},${top} ${x0 + r},${top} L${x1 - r},${top} Q${x1},${top} ${x1},${
      top + r
    } L${x1},${bot} Z`;
  }

  nameTabPath(ship: Spaceship): string {
    return this.tabPath(6, 6 + this.nameTabWidth(ship));
  }

  nameTabCenterX(ship: Spaceship): number {
    return 6 + this.nameTabWidth(ship) / 2;
  }

  /** Right (slots) tab is a fixed width, sized to hold the 4 slots and pinned near the right edge. */
  get slotsTabPath(): string {
    return this.tabPath(204, 284);
  }

  /** X of the given exploration slot's center within the right tab (index 1-4). */
  slotTabX(index: number): number {
    return 221 + (index - 1) * 15;
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

  // Desktop only, per the owner's brief - matches the base-game power/QIC action octagons
  // (BoardAction.vue) at the same viewport: measured live (a 3-player desktop layout), the ship
  // action octagon rendered ~34.6px wide against the base game's ~30.6px, a 0.884 ratio. Shrinking
  // the whole ship SVG's own width (rather than a transform, which would leave the grid cell's
  // reserved height unchanged and an empty gap below) scales every element on the board - art,
  // labels, action tiles - uniformly together, since the SVG's own aspect ratio keeps height in
  // proportion automatically. Mobile keeps the existing full-width 100%.
  @media (min-width: 768px) {
    width: 88%;
    margin: 0 auto;
  }

  // The board card outline, in the ship's color (stroke set per-ship inline).
  .lost-fleet-ship__card {
    fill: none;
    stroke-width: 2.5;
  }

  // The two tabs (name + slots) that sit on the card's top border; fill is set per-ship inline, with
  // a slightly darker same-color edge so the tab reads as a distinct shape against the card border.
  .lost-fleet-ship__tab-shape {
    stroke: rgba(0, 0, 0, 0.25);
    stroke-width: 0.6;
  }

  // The ship name, centered in the left tab. Dark reads better than white on the lighter ship
  // colors (grey / gold), so it stays dark on every tab for consistency.
  .lost-fleet-ship__name {
    font-size: 9px;
    font-weight: 700;
    fill: #17161a;
    text-anchor: middle;
    letter-spacing: 0.4px;
    pointer-events: none;
  }

  .lost-fleet-ship__slot-bg {
    fill: #eef2f8;
    stroke: #b8c2d4;
    stroke-width: 1;
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
