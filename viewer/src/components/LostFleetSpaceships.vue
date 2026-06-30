<template>
  <div v-if="isLostFleet" class="lost-fleet-ships">
    <div class="lost-fleet-ships__header">
      <h6>Lost Fleet Ship Boards</h6>
      <p>Grouped by ship, with the same action family ordering as the board actions above.</p>
    </div>
    <div class="row">
      <div v-for="ship in ships" :key="ship" class="col-xl-6 mb-3">
        <section class="lost-fleet-ship-card" :data-ship="ship">
          <header class="lost-fleet-ship-card__top">
            <div>
              <div class="lost-fleet-ship-card__eyebrow">{{ shipLabel(ship) }}</div>
              <h6>{{ shipName(ship) }}</h6>
            </div>
            <div class="lost-fleet-ship-card__meta">
              <span v-if="hasTechSlot(ship)">Tech slot</span>
              <span v-if="ship === Spaceship.Twilight">Artifacts {{ remainingArtifacts.length }}/{{ artifactSlots(ship) }}</span>
            </div>
          </header>

          <div class="lost-fleet-ship-card__body">
            <section class="lost-fleet-ship-block">
              <div class="lost-fleet-ship-block__title">Ship Actions</div>
              <div class="lost-fleet-actions">
                <div
                  v-for="action in shipActions(ship)"
                  :key="action.type"
                  class="lost-fleet-action-card"
                  :class="[action.type, { 'is-used': actionUser(ship, action.type) !== null }]"
                  :data-action="action.type"
                >
                  <svg viewBox="-28 -28 56 56" class="lost-fleet-action-card__tile" aria-hidden="true">
                    <polygon points="-24,10 -10,24 10,24 24,10 24,-10 10,-24 -10,-24 -24,-10" />
                    <text class="lost-fleet-action-card__label" x="0" y="-2">
                      {{ actionLabel(ship, action.type) }}
                    </text>
                    <text class="lost-fleet-action-card__family" x="0" y="11">
                      {{ action.type }}
                    </text>
                    <g transform="translate(-16,-16)">
                      <rect
                        x="-8"
                        y="-8"
                        width="16"
                        height="16"
                        :rx="action.type === 'power' ? 8 : 0"
                        :ry="action.type === 'power' ? 8 : 0"
                        class="lost-fleet-action-card__badge"
                      />
                      <text x="0" y="4" class="lost-fleet-action-card__badge-text">
                        {{ actionCostNumber(action.cost) }}
                      </text>
                    </g>
                  </svg>
                  <div class="lost-fleet-action-card__state">
                    {{ actionState(ship, action.type) }}
                  </div>
                  <div class="lost-fleet-action-card__effect">
                    {{ action.effect }}
                  </div>
                </div>
              </div>
            </section>

            <section class="lost-fleet-ship-block">
              <div class="lost-fleet-ship-block__title">Access Slots</div>
              <div class="lost-fleet-track">
                <div
                  v-for="slot in explorationSlots(ship)"
                  :key="slot.index"
                  class="lost-fleet-track__slot"
                  :class="{ 'lost-fleet-track__slot--occupied': !!slot.player }"
                  :data-slot="slot.index"
                  :style="slotStyle(slot.player)"
                >
                  <div class="lost-fleet-track__index">Slot {{ slot.index }}</div>
                  <div class="lost-fleet-track__cost">{{ slot.cost }}</div>
                  <div v-if="slot.player" class="lost-fleet-track__occupant">
                    {{ playerBadgeLabel(slot.player) }}
                  </div>
                  <div v-else class="lost-fleet-track__occupant lost-fleet-track__occupant--empty">Open</div>
                </div>
              </div>
            </section>

            <section class="lost-fleet-ship-block">
              <div class="lost-fleet-ship-block__title">Seeded Rewards</div>

              <div class="lost-fleet-seed" data-section="tech">
                <div class="lost-fleet-seed__title">Standard Tech</div>
                <template v-if="hasTechSlot(ship)">
                  <template v-if="shipTech(ship)">
                    <div class="lost-fleet-seed__token" :title="shipTechDescription(ship)">
                      <span class="lost-fleet-seed__shortcut">{{ shipTechShortcut(ship) }}</span>
                      <span class="lost-fleet-seed__name">{{ shipTechName(ship) }}</span>
                    </div>
                    <div class="lost-fleet-seed__status">{{ shipTech(ship).count }} left</div>
                  </template>
                  <div v-else class="lost-fleet-seed__status">Depleted</div>
                </template>
                <div v-else class="lost-fleet-seed__status">No slot on this ship</div>
              </div>

              <div class="lost-fleet-seed" data-section="federation">
                <div class="lost-fleet-seed__title">Federation Token</div>
                <template v-if="shipFederation(ship)">
                  <div class="lost-fleet-seed__token lost-fleet-seed__token--federation" :title="shipFederationDescription(ship)">
                    <span class="lost-fleet-seed__shortcut">{{ shipFederationShortcut(ship) }}</span>
                    <span class="lost-fleet-seed__name">{{ shipFederationName(ship) }}</span>
                  </div>
                  <div class="lost-fleet-seed__status">Available</div>
                </template>
                <div v-else class="lost-fleet-seed__status">Claimed</div>
              </div>

              <div v-if="ship === Spaceship.Twilight" class="lost-fleet-seed" data-section="artifacts">
                <div class="lost-fleet-seed__title">Artifacts on Twilight</div>
                <div v-if="remainingArtifacts.length > 0" class="lost-fleet-artifacts">
                  <span
                    v-for="artifact in remainingArtifacts"
                    :key="artifact"
                    class="lost-fleet-artifacts__token"
                    :data-artifact="artifact"
                    :title="artifactDescription(artifact)"
                  >
                    {{ artifactName(artifact) }}
                  </span>
                </div>
                <div v-else class="lost-fleet-seed__status">No artifacts remaining</div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
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
  Spaceship,
  SpaceshipFederation,
} from "@gaia-project/engine";
import { Player as PlayerEnum } from "@gaia-project/engine/src/enums";
import { factionColor, factionLogTextColors } from "../graphics/utils";
import { techTileData } from "../data/tech-tiles";
import { artifactTokenSpec } from "@gaia-project/engine/src/tiles/artifacts";
import { artifactSlotCount, EXPLORATION_CHARGE_TRACK, spaceshipBoards, SpaceshipActionType, shipsInPlay } from "@gaia-project/engine/src/spaceships";
import { spaceshipFederationSpec } from "@gaia-project/engine/src/tiles/spaceship-federations";
import { spaceshipTechSpec } from "@gaia-project/engine/src/tiles/spaceship-techs";

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

const spaceshipFederationNames: Record<SpaceshipFederation, string> = {
  [SpaceshipFederation.Credit]: "Credit",
  [SpaceshipFederation.Knowledge]: "Knowledge",
  [SpaceshipFederation.OreQic]: "Ore + Q.I.C.",
  [SpaceshipFederation.PowerTokens]: "Power Tokens",
  [SpaceshipFederation.Range]: "Range",
  [SpaceshipFederation.Tech]: "Tech",
  [SpaceshipFederation.Terraform]: "Terraform",
  [SpaceshipFederation.Vp]: "VP",
};

const spaceshipFederationShortcuts: Record<SpaceshipFederation, string> = {
  [SpaceshipFederation.Credit]: "8c",
  [SpaceshipFederation.Knowledge]: "4k",
  [SpaceshipFederation.OreQic]: "2o1q",
  [SpaceshipFederation.PowerTokens]: "2t",
  [SpaceshipFederation.Range]: "R",
  [SpaceshipFederation.Tech]: "T",
  [SpaceshipFederation.Terraform]: "3d",
  [SpaceshipFederation.Vp]: "12",
};

const artifactTokenNames: Record<ArtifactToken, string> = {
  [ArtifactToken.KnowledgeOre]: "Knowledge + Ore",
  [ArtifactToken.Credit]: "Credit",
  [ArtifactToken.KnowledgeQic]: "Knowledge + Q.I.C.",
  [ArtifactToken.CreditLarge]: "Credit Large",
  [ArtifactToken.Power]: "Power",
  [ArtifactToken.Asteroid]: "Asteroid",
  [ArtifactToken.Protoplanet]: "Protoplanet",
  [ArtifactToken.ResearchLevel]: "Research Level",
  [ArtifactToken.ResearchTracks]: "Research Tracks",
  [ArtifactToken.Federation]: "Federation",
  [ArtifactToken.GaiaProject]: "Gaia Project",
  [ArtifactToken.PlanetTypes]: "Planet Types",
  [ArtifactToken.DeepSpace]: "Deep Space",
};

@Component
export default class LostFleetSpaceships extends Vue {
  Spaceship = Spaceship;

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

  artifactSlots(ship: Spaceship): number {
    return artifactSlotCount(ship, this.engine.players.length);
  }

  hasTechSlot(ship: Spaceship): boolean {
    return spaceshipBoards[ship].hasStandardTechSlot;
  }

  shipActions(ship: Spaceship) {
    return spaceshipBoards[ship].actions;
  }

  explorationSlots(ship: Spaceship): Array<{ index: number; cost: string; player: Player | null }> {
    return EXPLORATION_CHARGE_TRACK.map((charge, index) => ({
      index: index + 1,
      cost: charge === 0 ? "Free" : `${charge} power`,
      player: this.explorerAt(ship, index + 1),
    }));
  }

  explorerAt(ship: Spaceship, slot: number): Player | null {
    return this.engine.players.find((player) => player.data.explorationShips[ship] === slot) ?? null;
  }

  playerBadgeLabel(player: Player): string {
    return player.name ? player.name.slice(0, 3) : `P${player.player + 1}`;
  }

  slotStyle(player: Player | null): string {
    if (!player?.faction) {
      return "";
    }

    const background = player.faction ? factionColor(player.faction) : "#d3d3d3";
    const color = player.faction ? factionLogTextColors[player.faction] : "black";
    return `--slot-bg:${background}; --slot-ink:${color};`;
  }

  actionUser(ship: Spaceship, type: SpaceshipActionType): Player | null {
    const player = this.engine.spaceshipActions[ship]?.[type];
    return player === undefined ? null : this.engine.player(player as PlayerEnum);
  }

  actionState(ship: Spaceship, type: SpaceshipActionType): string {
    const player = this.actionUser(ship, type);
    return player ? `Used by ${player.name || `P${player.player + 1}`}` : "Ready this round";
  }

  actionCostNumber(cost: string): number {
    const match = /^(\d+)/.exec(cost);
    return match ? Number(match[1]) : 0;
  }

  actionLabel(ship: Spaceship, type: SpaceshipActionType): string {
    const labels: Record<Spaceship, Record<SpaceshipActionType, string>> = {
      [Spaceship.Twilight]: {
        qic: "Re-score",
        power: "Build RL",
        knowledge: "+3 Range",
        credit: "",
      },
      [Spaceship.Rebellion]: {
        qic: "Tech Tile",
        power: "Build TS",
        knowledge: "2c + 1q",
        credit: "",
      },
      [Spaceship.TFMars]: {
        qic: "VP / Tech",
        power: "Instant Gaia",
        knowledge: "",
        credit: "Terraform",
      },
      [Spaceship.Eclipse]: {
        qic: "VP / Type",
        power: "Research",
        knowledge: "",
        credit: "Asteroid Mine",
      },
    };

    return labels[ship][type];
  }

  shipTech(ship: Spaceship) {
    return this.engine.tiles.spaceshipTechs[ship];
  }

  shipTechName(ship: Spaceship): string {
    return this.shipTech(ship) ? techTileData(this.shipTech(ship).tile).name : "";
  }

  shipTechShortcut(ship: Spaceship): string {
    return this.shipTech(ship) ? techTileData(this.shipTech(ship).tile).shortcut : "";
  }

  shipTechDescription(ship: Spaceship): string {
    return this.shipTech(ship) ? spaceshipTechSpec[this.shipTech(ship).tile] : "";
  }

  shipFederation(ship: Spaceship): SpaceshipFederation | undefined {
    return this.engine.tiles.spaceshipFederations[ship];
  }

  shipFederationName(ship: Spaceship): string {
    return this.shipFederation(ship) ? spaceshipFederationNames[this.shipFederation(ship)] : "";
  }

  shipFederationShortcut(ship: Spaceship): string {
    return this.shipFederation(ship) ? spaceshipFederationShortcuts[this.shipFederation(ship)] : "";
  }

  shipFederationDescription(ship: Spaceship): string {
    return this.shipFederation(ship) ? spaceshipFederationSpec[this.shipFederation(ship)] : "";
  }

  artifactName(token: ArtifactToken): string {
    return artifactTokenNames[token];
  }

  artifactDescription(token: ArtifactToken): string {
    return artifactTokenSpec[token];
  }
}
</script>

<style lang="scss" scoped>
.lost-fleet-ships {
  margin-top: 1rem;
}

.lost-fleet-ships__header {
  margin-bottom: 0.75rem;

  h6 {
    margin-bottom: 0.15rem;
  }

  p {
    margin: 0;
    color: #5f6773;
    font-size: 0.95rem;
  }
}

.lost-fleet-ship-card {
  height: 100%;
  border: 1px solid #2d3d64;
  border-radius: 10px;
  background:
    linear-gradient(180deg, #f8fafc 0%, #eef3fb 100%);
  box-shadow: 0 6px 18px rgb(23 46 98 / 10%);
  overflow: hidden;
}

.lost-fleet-ship-card__top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem 0.75rem;
  background: #172e62;
  color: white;

  h6 {
    margin: 0;
    font-size: 1rem;
  }
}

.lost-fleet-ship-card__eyebrow {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.72;
}

.lost-fleet-ship-card__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  font-size: 0.75rem;
  text-align: right;

  span {
    padding: 0.1rem 0.45rem;
    border: 1px solid rgb(255 255 255 / 22%);
    border-radius: 999px;
    background: rgb(255 255 255 / 10%);
  }
}

.lost-fleet-ship-card__body {
  padding: 0.9rem 1rem 1rem;
}

.lost-fleet-ship-block {
  min-width: 0;
  margin-bottom: 0.9rem;

}

.lost-fleet-ship-block__title {
  display: block;
  margin-bottom: 0.45rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #44506a;
}

.lost-fleet-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.lost-fleet-action-card__tile {
  width: 100%;
  height: auto;
  overflow: visible;
}

.lost-fleet-action-card {
  min-width: 0;

  polygon {
    stroke: black;
    stroke-width: 1.3;
  }

  &.power polygon {
    fill: var(--res-power);
  }

  &.qic polygon {
    fill: var(--res-qic);
  }

  &.knowledge polygon {
    fill: var(--rt-sci);
  }

  &.credit polygon {
    fill: var(--rt-eco);
  }

  &.is-used polygon {
    opacity: 0.55;
  }
}

.lost-fleet-action-card__label,
.lost-fleet-action-card__family,
.lost-fleet-action-card__badge-text {
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
  font-weight: 700;
}

.lost-fleet-action-card__label {
  font-size: 5.2px;
  fill: white;
}

.lost-fleet-action-card__family {
  font-size: 5px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  fill: white;
  opacity: 0.85;
}

.lost-fleet-action-card__badge {
  fill: white;
  stroke: black;
  stroke-width: 1;
}

.lost-fleet-action-card__badge-text {
  font-size: 7px;
  fill: #172e62;
}

.lost-fleet-action-card__state,
.lost-fleet-action-card__effect {
  font-size: 0.76rem;
  line-height: 1.3;
  color: #5d6572;
}

.lost-fleet-action-card__state {
  margin-top: 0.2rem;
  font-weight: 700;
  color: #172e62;
}

.lost-fleet-action-card__effect {
  margin-top: 0.15rem;
}

.lost-fleet-track {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
}

.lost-fleet-track__slot,
.lost-fleet-seed {
  border: 1px solid #ccd5e3;
  border-radius: 8px;
  background: white;
}

.lost-fleet-track__slot {
  padding: 0.5rem 0.55rem;
}

.lost-fleet-track__slot--occupied {
  background: var(--slot-bg);
  color: var(--slot-ink);
}

.lost-fleet-track__slot--occupied .lost-fleet-track__index,
.lost-fleet-track__slot--occupied .lost-fleet-track__cost,
.lost-fleet-track__slot--occupied .lost-fleet-track__occupant {
  color: inherit;
}

.lost-fleet-track__index {
  font-size: 0.72rem;
  font-weight: 700;
  color: #172e62;
}

.lost-fleet-track__cost {
  font-size: 0.78rem;
  color: #6a7280;
}

.lost-fleet-track__occupant {
  display: inline-flex;
  margin-top: 0.35rem;
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}

.lost-fleet-track__occupant--empty {
  background: #eff3f8;
  color: #6a7280;
}

.lost-fleet-seed__status {
  font-size: 0.78rem;
  line-height: 1.35;
  color: #5d6572;
}

.lost-fleet-seed {
  padding: 0.55rem 0.6rem;
  margin-bottom: 0.45rem;
}

.lost-fleet-seed__title {
  margin-bottom: 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #172e62;
}

.lost-fleet-seed__token {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.3rem;
}

.lost-fleet-seed__token--federation .lost-fleet-seed__shortcut {
  background: #f5d77a;
  color: #5f4500;
}

.lost-fleet-seed__shortcut {
  min-width: 2.6rem;
  padding: 0.15rem 0.35rem;
  border-radius: 6px;
  background: #d9e6ff;
  color: #172e62;
  font-size: 0.74rem;
  font-weight: 700;
  text-align: center;
}

.lost-fleet-seed__name {
  font-size: 0.8rem;
  font-weight: 700;
  color: #172e62;
}

.lost-fleet-artifacts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.lost-fleet-artifacts__token {
  display: inline-flex;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  background: #efe6c4;
  color: #172e62;
  font-size: 0.74rem;
  font-weight: 700;
}

@media (max-width: 991px) {
  .lost-fleet-actions {
    grid-template-columns: 1fr;
  }

  .lost-fleet-track {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
