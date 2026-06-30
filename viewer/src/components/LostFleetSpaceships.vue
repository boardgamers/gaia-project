<template>
  <div v-if="isLostFleet" class="lost-fleet-ships">
    <div class="lost-fleet-ships__header">
      <h6>Lost Fleet Rewards</h6>
      <p>Claimable tech, federation, and artifact rewards still on each ship.</p>
    </div>
    <div class="row">
      <div v-for="ship in ships" :key="ship" class="col-lg-4 col-md-6 mb-3">
        <section class="lost-fleet-ship-card" :data-ship="ship">
          <header class="lost-fleet-ship-card__top">
            <div>
              <div class="lost-fleet-ship-card__eyebrow">{{ shipLabel(ship) }}</div>
              <h6>{{ shipName(ship) }}</h6>
            </div>
          </header>

          <div class="lost-fleet-ship-card__body">
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
  Spaceship,
  SpaceshipFederation,
} from "@gaia-project/engine";
import { techTileData } from "../data/tech-tiles";
import { artifactTokenSpec } from "@gaia-project/engine/src/tiles/artifacts";
import { spaceshipBoards, shipsInPlay } from "@gaia-project/engine/src/spaceships";
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

  hasTechSlot(ship: Spaceship): boolean {
    return spaceshipBoards[ship].hasStandardTechSlot;
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
.lost-fleet-ships__header {
  margin-bottom: 0.75rem;

  h6 {
    margin-bottom: 0.15rem;
  }

  p {
    margin: 0;
    color: #5f6773;
    font-size: 0.9rem;
  }
}

.lost-fleet-ship-card {
  height: 100%;
  border: 1px solid #ccd5e3;
  border-radius: 10px;
  background: white;
  box-shadow: 0 3px 12px rgb(23 46 98 / 8%);
  overflow: hidden;
}

.lost-fleet-ship-card__top {
  padding: 0.8rem 0.95rem 0.55rem;
  border-bottom: 1px solid #e2e8f2;
  background: #f6f8fc;

  h6 {
    margin: 0;
    font-size: 0.96rem;
    color: #172e62;
  }
}

.lost-fleet-ship-card__eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5f6773;
}

.lost-fleet-ship-card__body {
  padding: 0.8rem 0.95rem 0.95rem;
}

.lost-fleet-seed {
  padding: 0.55rem 0.6rem;
  margin-bottom: 0.45rem;
  border: 1px solid #dce3ef;
  border-radius: 8px;
  background: #fbfcfe;
}

.lost-fleet-seed__title {
  margin-bottom: 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #172e62;
}

.lost-fleet-seed__status {
  font-size: 0.78rem;
  line-height: 1.35;
  color: #5d6572;
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
</style>
