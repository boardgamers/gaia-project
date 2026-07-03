<template>
  <div v-if="isLostFleet" class="lost-fleet-ships">
    <svg
      v-for="ship in ships"
      :key="ship"
      class="lost-fleet-ship"
      :data-ship="ship"
      viewBox="0 -16 291 112"
      style="overflow: visible"
    >
      <!-- header: full ship name, then the marker + the 4 exploration-track slots (explored-by
           markers) as a 2x2 grid. -->
      <text x="0" y="-4" class="lost-fleet-ship__name">{{ shipName(ship) }}</text>
      <g class="lost-fleet-ship__header">
        <g v-b-tooltip :title="shipLabel(ship)">
          <circle cx="9" cy="9" r="8" class="lost-fleet-ship__marker-bg" />
          <text x="9" y="12" class="lost-fleet-ship__marker">{{ shipMarker(ship) }}</text>
        </g>
        <g
          v-for="slot in explorationSlots(ship)"
          :key="slot.index"
          class="lost-fleet-ship__slot"
          :data-slot="slot.index"
          :transform="`translate(${28 + ((slot.index - 1) % 2) * 18}, ${slot.index <= 2 ? 8 : 26})`"
          v-b-tooltip
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
        :data-action="action.type"
        :transform="`translate(${29 + i * 54}, 64)`"
      >
        <ShipActionIcon :ship="ship" :type="action.type" />
      </g>

      <!-- the Federation token still up for grabs on this ship (base-game token art) -->
      <g data-section="federation" v-b-tooltip :title="federationTooltip(ship)">
        <FederationTile
          v-if="shipFederation(ship)"
          :rewardsOverride="federationDisplayRewards(shipFederation(ship))"
          x="172"
          y="32"
          filter="url(#shadow-1)"
        />
        <FederationTile v-else :used="true" x="172" y="32" />
      </g>

      <!-- the Standard Tech tile seeded on this ship (Twilight has artifacts instead) -->
      <g v-if="hasTechSlot(ship)" data-section="tech" transform="translate(225, 33) scale(0.9)">
        <TechTile :pos="ship" x="0" y="0" />
      </g>
      <g v-else data-section="artifacts">
        <g
          v-for="(artifact, i) in remainingArtifacts"
          :key="artifact"
          :data-artifact="artifact"
          :transform="`translate(${236 + (i % 2) * 26}, ${49 + Math.floor(i / 2) * 26})`"
        >
          <ArtifactIcon :artifact="artifact" />
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
  Expansion,
  hasExpansion,
  Player,
  Reward,
  Spaceship,
  SpaceshipFederation,
} from "@gaia-project/engine";
import { EXPLORATION_CHARGE_TRACK, spaceshipBoards, shipsInPlay } from "@gaia-project/engine/src/spaceships";
import { spaceshipFederationSpec } from "@gaia-project/engine/src/tiles/spaceship-federations";
import { spaceshipFederationDisplayRewards } from "../data/federations";
import { spaceshipLabels, spaceshipMarkers, spaceshipNames } from "../data/spaceships";
import ArtifactIcon from "./ArtifactIcon.vue";
import FederationTile from "./FederationTile.vue";
import Resource from "./Resource.vue";
import ShipActionIcon from "./ShipActionIcon.vue";
import TechTile from "./TechTile.vue";
import Token from "./Token.vue";

@Component({
  components: {
    ArtifactIcon,
    FederationTile,
    Resource,
    ShipActionIcon,
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
  // Single row, always - each ship gets a comfortable minimum width and never wraps to a 2nd row;
  // on narrow/mobile viewports the strip scrolls horizontally instead of shrinking ships to
  // illegibility or stacking them into a 2x2 grid.
  grid-auto-flow: column;
  grid-auto-columns: minmax(210px, 1fr);
  overflow-x: auto;
  gap: 0.4rem;
}

svg.lost-fleet-ship {
  width: 100%;
  min-width: 210px;
  height: auto;
  display: block;

  .lost-fleet-ship__name {
    font-size: 9px;
    font-weight: 700;
    fill: var(--font-color, #172e62);
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
}
</style>
