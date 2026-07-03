<template>
  <div v-if="isLostFleet" class="lost-fleet-ships">
    <svg
      v-for="ship in ships"
      :key="ship"
      class="lost-fleet-ship"
      :data-ship="ship"
      viewBox="0 0 258 96"
      style="overflow: visible"
    >
      <!-- header: ship marker, then the 4 exploration-track slots (explored-by markers) as a 2x2 grid.
           No ship name (dropped for space - the tooltip on the marker still gives the full name). -->
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
            <image
              v-if="slot.cost > 0"
              xlink:href="../assets/resources/power-charge.svg"
              width="7"
              :height="(133 / 345) * 7"
              x="-6.5"
              y="0"
            />
            <text :x="slot.cost > 0 ? 2.5 : 0" y="6.5" class="lost-fleet-ship__slot-cost">{{ slot.cost }}</text>
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
        :transform="`translate(${27 + i * 48}, 62)`"
        v-b-tooltip
        :title="actionTooltip(ship, action)"
      >
        <SpecialAction
          :action="actionIncome(ship, action.type)"
          :planet="actionPlanet(ship, action.type)"
          :board="true"
          x="-20"
          y="-25"
          width="40"
        />
        <g v-if="actionOverlay(ship, action.type)" class="lost-fleet-ship__action-overlay" transform="translate(0, -5)">
          <template v-if="isMineBubble(actionOverlay(ship, action.type))">
            <!-- same bubble language as Condition.vue's "mg" (mine on Gaia) VP icon, just bigger and asteroid-colored -->
            <circle r="10" :class="['planet-fill', actionOverlay(ship, action.type).planet]" />
            <Building
              :building="actionOverlay(ship, action.type).building"
              faction="gen"
              :flat="flat"
              outline-white
              transform="scale(1.9)"
            />
          </template>
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
            <Condition
              v-if="actionOverlay(ship, action.type).condition"
              :condition="actionOverlay(ship, action.type).condition"
            />
          </g>
        </g>
        <g transform="translate(-15,-15)">
          <image v-if="costKind(action) === 'pw'" xlink:href="../assets/resources/power-charge.svg" width="20"
          :height=133/345*20 transform="scale(-1,1) translate(-9, -12)" />
          <rect
            x="-8"
            y="-8"
            width="16"
            height="16"
            :rx="costKind(action) === 'pw' ? 8 : 0"
            :ry="costKind(action) === 'pw' ? 8 : 0"
            stroke="black"
            stroke-width="1"
            :fill="costFill(action)"
            transform="scale(0.8)"
          />
          <text x="-3" y="3.5" class="lost-fleet-ship__cost">{{ costNumber(action) }}</text>
          <Resource
            v-for="(extra, j) in extraCosts(action)"
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

      <!-- the Federation token still up for grabs on this ship (base-game token art) -->
      <g data-section="federation" v-b-tooltip :title="federationTooltip(ship)">
        <FederationTile
          v-if="shipFederation(ship)"
          :rewardsOverride="federationDisplayRewards(shipFederation(ship))"
          x="149"
          y="32"
          filter="url(#shadow-1)"
        />
        <FederationTile v-else :used="true" x="149" y="32" />
      </g>

      <!-- the Standard Tech tile seeded on this ship (Twilight has artifacts instead) -->
      <g v-if="hasTechSlot(ship)" data-section="tech" transform="translate(202, 33) scale(0.9)">
        <TechTile :pos="ship" x="0" y="0" />
      </g>
      <g v-else data-section="artifacts">
        <g
          v-for="(artifact, i) in remainingArtifacts"
          :key="artifact"
          class="lost-fleet-ship__artifact"
          :data-artifact="artifact"
          :transform="`translate(${213 + (i % 2) * 26}, ${49 + Math.floor(i / 2) * 26})`"
          v-b-tooltip
          :title="artifactTooltip(artifact)"
        >
          <circle r="12" class="lost-fleet-ship__artifact-bg" />
          <g transform="scale(0.55)">
            <Resource
              v-for="(reward, j) in artifactDisplay(artifact).rewards"
              :key="j"
              :kind="reward.type"
              :count="reward.count"
              :transform="`translate(${(j - (artifactDisplay(artifact).rewards.length - 1) / 2) * 20}, ${
                artifactDisplay(artifact).condition || artifactDisplay(artifact).planet ? -7 : 0
              })`"
            />
            <Condition
              v-if="artifactDisplay(artifact).condition"
              :condition="artifactDisplay(artifact).condition"
              transform="translate(0, 10) scale(0.8)"
            />
            <circle
              v-if="artifactDisplay(artifact).planet"
              r="6"
              :class="['planet-fill', artifactDisplay(artifact).planet]"
              transform="translate(0, 11)"
            />
          </g>
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
import { Building as BuildingEnum, Player as PlayerEnum } from "@gaia-project/engine/src/enums";
import {
  EXPLORATION_CHARGE_TRACK,
  spaceshipActionEffects,
  spaceshipBoards,
  SpaceshipActionType,
  shipsInPlay,
} from "@gaia-project/engine/src/spaceships";
import { artifactTokenSpec } from "@gaia-project/engine/src/tiles/artifacts";
import { spaceshipFederationSpec } from "@gaia-project/engine/src/tiles/spaceship-federations";
import { spaceshipFederationDisplayRewards } from "../data/federations";
import { factionPiecePlanet } from "../graphics/utils";
import Building from "./Building.vue";
import Condition from "./Condition.vue";
import FederationTile from "./FederationTile.vue";
import Resource from "./Resource.vue";
import SpecialAction from "./SpecialAction.vue";
import TechTile from "./TechTile.vue";
import Token from "./Token.vue";

const spaceshipNames: Record<Spaceship, string> = {
  [Spaceship.Twilight]: "Twilight",
  [Spaceship.Rebellion]: "Rebellion",
  [Spaceship.TFMars]: "T F Mars",
  [Spaceship.Eclipse]: "Eclipse",
};

const spaceshipLabels: Record<Spaceship, string> = {
  [Spaceship.Twilight]: "Nautilaks",
  [Spaceship.Rebellion]: "Vo'Kron",
  [Spaceship.TFMars]: "Gaia Federation",
  [Spaceship.Eclipse]: "Eridani Empire",
};

const spaceshipMarkers: Record<Spaceship, string> = {
  [Spaceship.Twilight]: "T",
  [Spaceship.Rebellion]: "R",
  [Spaceship.TFMars]: "M",
  [Spaceship.Eclipse]: "E",
};

type ActionOverlay = {
  building?: BuildingEnum;
  planet?: Planet;
  resource?: string;
  condition?: ConditionEnum;
};

/**
 * Display-only icons for the ship actions whose engine effect arrays are empty because they are
 * wired via bespoke SubPhases rather than declarative rewards (see engine spaceships.ts). Composed
 * exclusively of existing base-game primitives - no new art.
 */
const shipActionOverlays: { [key in Spaceship]?: Partial<{ [key in SpaceshipActionType]: ActionOverlay }> } = {
  [Spaceship.Twilight]: {
    power: { building: BuildingEnum.ResearchLab },
  },
  [Spaceship.Rebellion]: {
    power: { building: BuildingEnum.TradingStation },
  },
  [Spaceship.TFMars]: {
    power: { resource: "instant-gaiaforming" },
    credit: { building: BuildingEnum.Mine, resource: "step" },
  },
  [Spaceship.Eclipse]: {
    power: { condition: ConditionEnum.AdvanceResearch },
    credit: { building: BuildingEnum.Mine, planet: Planet.Asteroid },
  },
};

/** Icon rows for the 13 artifact tokens, again composed only of existing Resource/Condition icons. */
const artifactDisplaySpec: { [key in ArtifactToken]: { rewards: string; condition?: ConditionEnum; planet?: Planet } } = {
  [ArtifactToken.KnowledgeOre]: { rewards: "k,o" },
  [ArtifactToken.Credit]: { rewards: "3c,3o" },
  [ArtifactToken.KnowledgeQic]: { rewards: "3k,q" },
  [ArtifactToken.CreditLarge]: { rewards: "5c,2o" },
  [ArtifactToken.Power]: { rewards: "2t" },
  [ArtifactToken.Asteroid]: { rewards: "7vp", planet: Planet.Asteroid },
  [ArtifactToken.Protoplanet]: { rewards: "7vp", planet: Planet.Protoplanet },
  [ArtifactToken.ResearchLevel]: { rewards: "3vp", condition: ConditionEnum.AdvanceResearch },
  [ArtifactToken.ResearchTracks]: { rewards: "3vp", condition: ConditionEnum.AdvanceResearch },
  [ArtifactToken.Federation]: { rewards: "fed" },
  [ArtifactToken.GaiaProject]: { rewards: "3vp", condition: ConditionEnum.GaiaFormer },
  [ArtifactToken.PlanetTypes]: { rewards: "3vp", condition: ConditionEnum.PlanetType },
  [ArtifactToken.DeepSpace]: { rewards: "3vp", condition: ConditionEnum.DeepSpaceSector },
};

@Component({
  components: {
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
    return shipActionOverlays[ship]?.[type] ?? null;
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
    return overlay.planet != null;
  }

  actionTooltip(ship: Spaceship, action: { type: SpaceshipActionType; cost: string; effect: string }): string {
    const user = this.actionUser(ship, action.type);
    const state = user ? ` - used by ${user.name || `P${user.player + 1}`} this round` : "";
    return `${this.shipName(ship)} (${action.cost}): ${action.effect}${state}`;
  }

  costRewards(action: { cost: string }): Reward[] {
    return Reward.parse(action.cost);
  }

  costKind(action: { cost: string }): string {
    return this.costRewards(action)[0].type;
  }

  costNumber(action: { cost: string }): number {
    return this.costRewards(action)[0].count;
  }

  extraCosts(action: { cost: string }): Reward[] {
    return this.costRewards(action).slice(1);
  }

  costFill(action: { cost: string }): string {
    const fills = { pw: "#984FF1", q: "green", k: "#3b82f6", c: "#d6a23c" };
    return fills[this.costKind(action)] ?? "green";
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

  artifactDisplay(artifact: ArtifactToken): { rewards: Reward[]; condition?: ConditionEnum; planet?: Planet } {
    const spec = artifactDisplaySpec[artifact];
    return { rewards: Reward.parse(spec.rewards), condition: spec.condition, planet: spec.planet };
  }

  artifactTooltip(artifact: ArtifactToken): string {
    return artifactTokenSpec[artifact];
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
  grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
  gap: 0.4rem;
}

svg.lost-fleet-ship {
  width: 100%;
  height: auto;
  display: block;

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
