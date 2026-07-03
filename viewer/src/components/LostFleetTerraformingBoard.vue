<template>
  <div v-if="visible" class="lost-fleet-terraforming-board">
    <div class="lost-fleet-terraforming-board__header">
      <h6>Lost Fleet Terraforming Board</h6>
      <p>
        The left-to-right 7-color row is fixed by the seed. Tinkeroids and Moweyds take opponent home colors first,
        then fill any remaining 3-step slots from this row from left to right.
      </p>
    </div>

    <section class="lost-fleet-terraforming-board__card" data-row="board">
      <div class="lost-fleet-terraforming-board__eyebrow">Shared row</div>
      <div class="lost-fleet-terraforming-board__row">
        <div
          v-for="(planet, index) in boardPlanets"
          :key="`board-${planet}`"
          :data-slot="index + 1"
          :data-planet="planet"
          class="lost-fleet-terraforming-board__slot"
        >
          <svg viewBox="-1.1 -1.1 2.2 2.2" class="lost-fleet-terraforming-board__planet">
            <Planet :planet="planet" :classes="[]" />
          </svg>
          <div class="lost-fleet-terraforming-board__planet-name">{{ planetName(planet) }}</div>
          <div class="lost-fleet-terraforming-board__index">{{ index + 1 }}</div>
        </div>
      </div>
    </section>

    <section
      v-if="showMandatoryRow"
      class="lost-fleet-terraforming-board__card lost-fleet-terraforming-board__card--mandatory"
      data-row="mandatory"
    >
      <div class="lost-fleet-terraforming-board__eyebrow">Mandatory so far</div>
      <div class="lost-fleet-terraforming-board__subtext">
        Chosen base-game opponents already lock these colors as 3-step planets.
      </div>
      <div class="lost-fleet-terraforming-board__row">
        <div
          v-for="(planet, index) in boardPlanets"
          :key="`mandatory-${planet}`"
          :data-slot="index + 1"
          :data-planet="planet"
          :data-selected="mandatoryPlanets.includes(planet) ? 'true' : 'false'"
          :class="[
            'lost-fleet-terraforming-board__slot',
            { 'lost-fleet-terraforming-board__slot--selected': mandatoryPlanets.includes(planet) },
          ]"
        >
          <svg viewBox="-1.1 -1.1 2.2 2.2" class="lost-fleet-terraforming-board__planet">
            <Planet :planet="planet" :classes="[]" />
          </svg>
          <div class="lost-fleet-terraforming-board__planet-name">{{ planetName(planet) }}</div>
          <div class="lost-fleet-terraforming-board__index">{{ index + 1 }}</div>
        </div>
      </div>
    </section>

    <section
      v-for="player in terraformingPlayers"
      :key="player.player"
      :data-player="player.faction"
      class="lost-fleet-terraforming-board__card"
    >
      <div class="lost-fleet-terraforming-board__eyebrow">{{ playerTitle(player) }}</div>
      <template v-if="resolvedCost3Planets(player).length > 0">
        <div class="lost-fleet-terraforming-board__subtext">
          Exact 3-step planets for this player in this game.
        </div>
        <div class="lost-fleet-terraforming-board__row">
          <div
            v-for="(planet, index) in boardPlanets"
            :key="`${player.player}-${planet}`"
            :data-slot="index + 1"
            :data-planet="planet"
            :data-selected="resolvedCost3Planets(player).includes(planet) ? 'true' : 'false'"
            :class="[
              'lost-fleet-terraforming-board__slot',
              { 'lost-fleet-terraforming-board__slot--selected': resolvedCost3Planets(player).includes(planet) },
            ]"
          >
            <svg viewBox="-1.1 -1.1 2.2 2.2" class="lost-fleet-terraforming-board__planet">
              <Planet :planet="planet" :classes="[]" />
            </svg>
            <div class="lost-fleet-terraforming-board__planet-name">{{ planetName(planet) }}</div>
            <div class="lost-fleet-terraforming-board__index">{{ index + 1 }}</div>
          </div>
        </div>
      </template>
      <div v-else class="lost-fleet-terraforming-board__subtext">
        Final 3-step colors resolve after all factions are chosen.
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component } from "vue-property-decorator";
import Engine, { Expansion, hasExpansion, Planet, Player } from "@gaia-project/engine";
import {
  factionPlanet,
  isBaseGameFaction,
  isTerraformingBoardFaction,
  lostFleetTerraformingBoard,
} from "@gaia-project/engine/src/factions";
import { planetNames } from "../data/planets";
import { factionName } from "../data/factions";
import { gameSeed, phaseBeforeSetupBuilding } from "../logic/utils";
import PlanetView from "./Planet.vue";

@Component({
  components: {
    Planet: PlanetView,
  },
})
export default class LostFleetTerraformingBoard extends Vue {
  get engine(): Engine {
    return this.$store.state.data;
  }

  get isLostFleet(): boolean {
    return hasExpansion(this.engine.expansions, Expansion.LostFleet);
  }

  get boardPlanets(): Planet[] {
    // Not this.engine.map?.seed - only set on a freshly-generated SpaceMap, lost on any
    // serialize/deserialize round-trip (see logic/utils.ts's gameSeed doc comment).
    const seed = gameSeed(this.engine);
    return seed ? lostFleetTerraformingBoard(seed) : [];
  }

  get chosenPlayers(): Player[] {
    return this.engine.players.filter((player) => !!player.faction);
  }

  get terraformingPlayers(): Player[] {
    return this.chosenPlayers.filter((player) => isTerraformingBoardFaction(player.faction));
  }

  get mandatoryPlanets(): Planet[] {
    const chosen = new Set(
      this.chosenPlayers.filter((player) => isBaseGameFaction(player.faction)).map((player) => factionPlanet(player.faction))
    );

    return this.boardPlanets.filter((planet) => chosen.has(planet));
  }

  get showMandatoryRow(): boolean {
    return phaseBeforeSetupBuilding(this.engine) && this.mandatoryPlanets.length > 0;
  }

  get visible(): boolean {
    return this.isLostFleet && this.boardPlanets.length > 0 && (phaseBeforeSetupBuilding(this.engine) || this.terraformingPlayers.length > 0);
  }

  planetName(planet: Planet): string {
    return planetNames[planet];
  }

  playerTitle(player: Player): string {
    return factionName(player.faction);
  }

  resolvedCost3Planets(player: Player): Planet[] {
    return player.data?.lostFleetCost3Planets ?? [];
  }
}
</script>

<style lang="scss" scoped>
.lost-fleet-terraforming-board {
  margin-top: 0.25rem;
}

.lost-fleet-terraforming-board__header {
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

.lost-fleet-terraforming-board__card {
  margin-bottom: 0.7rem;
  padding: 0.8rem 0.95rem 0.9rem;
  border: 1px solid #dce3ef;
  border-radius: 10px;
  background: linear-gradient(180deg, #fbfcfe, #f3f7fc);
  box-shadow: 0 3px 12px rgb(23 46 98 / 8%);
}

.lost-fleet-terraforming-board__card--mandatory {
  background: linear-gradient(180deg, #f7fbff, #eef5fd);
}

.lost-fleet-terraforming-board__eyebrow {
  margin-bottom: 0.15rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #172e62;
}

.lost-fleet-terraforming-board__subtext {
  margin-bottom: 0.55rem;
  font-size: 0.82rem;
  color: #5f6773;
}

.lost-fleet-terraforming-board__row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.45rem;
}

.lost-fleet-terraforming-board__slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  padding: 0.45rem 0.35rem;
  border: 1px solid #dce3ef;
  border-radius: 8px;
  background: rgb(255 255 255 / 82%);
  transition: border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
}

.lost-fleet-terraforming-board__slot--selected {
  border-color: #d0b259;
  background: #fff8de;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 45%);
}

.lost-fleet-terraforming-board__planet {
  width: 1.7rem;
  height: 1.7rem;
  margin-bottom: 0.1rem;
}

.lost-fleet-terraforming-board__planet-name {
  min-width: 0;
  font-size: 0.73rem;
  font-weight: 700;
  color: #172e62;
  text-align: center;
  line-height: 1.15;
}

.lost-fleet-terraforming-board__index {
  margin-top: 0.15rem;
  font-size: 0.7rem;
  color: #5f6773;
}

@media (max-width: 767px) {
  .lost-fleet-terraforming-board__row {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
