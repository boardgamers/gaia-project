<template>
  <div class="player-info no-gutters" v-if="player && player.faction">
    <span @click="playerClick(player)" :class="['player-name', { dropped: player.dropped }]" role="button">{{
      name
    }}</span>
    <div class="board mt-2">
      <svg viewBox="-0.2 -0.5 38.5 21.4" class="player-board" :style="`background-color: ${factionColor}`">
        <rect x="-1" y="-1" width="50" height="50" fill="#ffffff44"></rect>
        <PlayerBoardInfo
          transform="translate(0.5, 0.5)"
          :player="player"
          :faction="player.faction"
          :data="playerData"
        />
        <g transform="translate(4, 0)">
          <BuildingGroup
            :transform="player.faction !== 'bescods' ? 'translate(2.2, 10)' : 'translate(12, 10)'"
            :nBuildings="1"
            building="PI"
            :player="player"
            :placed="playerData.buildings.PI"
            :resource="['pw', 't']"
          />
          <BuildingGroup
            :transform="player.faction === 'bescods' ? 'translate(2.2, 10)' : 'translate(12, 10)'"
            :nBuildings="2"
            building="ac1"
            :player="player"
            :placed="0"
            :ac1="playerData.buildings.ac1"
            :ac2="playerData.buildings.ac2"
            :resource="['q']"
          />
          <BuildingGroup
            transform="translate(0, 13)"
            :nBuildings="4"
            building="ts"
            :player="player"
            :placed="playerData.buildings.ts"
            :resource="['c']"
          />
          <BuildingGroup
            transform="translate(11, 13)"
            :nBuildings="3"
            building="lab"
            :player="player"
            :placed="playerData.buildings.lab"
            :resource="['k']"
          />
          <BuildingGroup
            transform="translate(0, 16)"
            :nBuildings="8"
            building="m"
            :player="player"
            :placed="playerData.buildings.m"
            :resource="['o']"
          />
          <!-- M to TS -->
          <line x1="5.7" x2="5.7" y1="14.2" y2="14.8" stroke="black" stroke-width="0.06" />
          <!-- TS to PI -->
          <line
            x1="5.7"
            x2="5.7"
            y1="11.2"
            y2="11.8"
            stroke="black"
            stroke-width="0.06"
            v-if="player.faction !== 'ivits'"
          />
          <!-- LAB to AC -->
          <line x1="15.3" x2="15.3" y1="11.2" y2="11.8" stroke="black" stroke-width="0.06" />
          <!-- TS to LAB -->
          <line x1="10.4" x2="11" y1="13.0" y2="13.0" stroke="black" stroke-width="0.06" />
        </g>

        <Resource
          kind="d"
          :count="1 + playerData.terraformCostDiscount"
          transform="translate(31.5,1) scale(0.09)"
          style="opacity: 0.7"
        />
        <Resource kind="r" :count="playerData.range" transform="translate(35.5,1) scale(0.1)" style="opacity: 0.7" />

        <BuildingGroup
          transform="translate(21, 1.2)"
          :nBuildings="playerData.gaiaformers"
          building="gf"
          :gaia="playerData.gaiaformersInGaia"
          :player="player"
          :placed="playerData.buildings.gf"
          :resource="[]"
          :discount="playerData ? playerData.gaiaFormingDiscount() : 0"
        />

        <g transform="translate(1.8, 13.4) scale(0.06)">
          <Booster
            v-if="playerData.tiles.booster"
            x="-30"
            y="-60"
            height="120"
            :booster="playerData.tiles.booster"
            :disabled="passed"
          />
        </g>
        <PowerBowls transform="translate(30,14.5)" :player="player" />

        <g transform="translate(29.3, 4.7) scale(0.9) translate(0, 1)">
          <g v-for="i in [0, 1, 2, 3]" :key="i" :transform="`translate(${(i - 2) * 3.8}, 0)`">
            <g
              v-for="(planet, index) in planetsWithSteps(i)"
              :key="planet"
              :transform="`translate(0, ${(i > 0 ? (index > 0 ? 1 : -1) : 0) * 1.4})`"
            >
              <circle :r="1" style="stroke-width: 0.06px !important" :class="['player-token', 'planet-fill', planet]" />
              <text
                :style="`font-size: 1.4px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(
                  planet
                )}`"
              >
                {{ player.ownedPlanetsCount[planet] }}
              </text>
            </g>
            <line x1="1.9" x2="1.9" y1="-2.3" y2="2.3" stroke-width="0.06" stroke="black" />
          </g>
          <g :transform="`translate(7.6, ${hasLostPlanet ? -1.4 : 0})`">
            <circle :r="1" style="stroke-width: 0.06px !important" :class="['player-token', 'planet-fill', 'g']" />
            <text style="font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: white">
              {{ player.ownedPlanetsCount["g"] }}
            </text>
          </g>
          <g v-if="hasLostPlanet" :transform="`translate(7.6, 1.4 )`">
            <circle :r="1" style="stroke-width: 0.06px !important" :class="['player-token', 'planet-fill', 'l']" />
            <text style="font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: white">
              {{ player.ownedPlanetsCount["l"] }}
            </text>
          </g>
        </g>

        <SpecialAction
          v-for="(action, i) in player.actions"
          :action="[action.rewards]"
          :player="player"
          :recent="recentAction(i)"
          :disabled="!action.enabled || passed"
          :key="action.rewards + '-' + i"
          y="17.5"
          width="3.1"
          height="3.1"
          :x="3.3 * i"
        />
      </svg>
    </div>

    <div class="tiles row no-gutters mt-1">
      <FederationTile
        v-for="(fed, i) in playerData.tiles.federations"
        class="mb-1 mr-1"
        :key="i"
        :federation="fed.tile"
        :used="!fed.green"
        :player="player.player"
        :numTiles="1"
        filter="url(#shadow-1)"
      />
      <TechTile
        v-for="tech in playerData.tiles.techs"
        :covered="!tech.enabled"
        class="mb-1 mr-1"
        :key="tech.pos"
        :pos="tech.pos"
        :player="player.player"
      />
    </div>
    <b-modal :id="player.faction" :title="factionName" size="lg" dialog-class="gaia-viewer-modal">
      <div v-html="tooltip"></div>
    </b-modal>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, { factionPlanet, Planet, Player } from "@gaia-project/engine";
import { factionColor } from "../graphics/utils";
import TechTile from "./TechTile.vue";
import Booster from "./Booster.vue";
import SpecialAction from "./SpecialAction.vue";
import FederationTile from "./FederationTile.vue";
import BuildingGroup from "./PlayerBoard/BuildingGroup.vue";
import PlayerBoardInfo from "./PlayerBoard/Info.vue";
import PowerBowls from "./PlayerBoard/PowerBowls.vue";
import { factionDesc, factionName, planetsWithSteps } from "../data/factions";

@Component({
  components: {
    TechTile,
    Booster,
    SpecialAction,
    FederationTile,
    BuildingGroup,
    PowerBowls,
    PlayerBoardInfo,
  },
})
export default class PlayerInfo extends Vue {
  @Prop()
  player: Player;

  get playerData() {
    return this.player?.data;
  }

  playerClick(player: Player) {
    this.$store.dispatch("gaiaViewer/playerClick", player);
  }

  get factionColor() {
    return factionColor(this.faction);
  }

  get name() {
    if (this.player.name) {
      return this.player.name;
    }
    return "Player " + (this.player.player + 1);
  }

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get tooltip() {
    return factionDesc(this.faction, this.player.factionVariant);
  }

  get planet() {
    return factionPlanet(this.faction);
  }

  get faction() {
    return this.player.faction;
  }

  get factionName(): string {
    return factionName(this.faction);
  }

  recentAction(i: number): boolean {
    const action = this.player.actions[i];
    const commands = this.$store.getters["gaiaViewer/recentActions"].get(this.faction) ?? [];
    return commands.some((c) => c.args[0] === action.rewards);
  }

  planetFill(planet: string) {
    if (planet === Planet.Titanium || planet === Planet.Swamp) {
      return "white";
    }
    return "black";
  }

  planetsWithSteps(steps: number) {
    return planetsWithSteps(this.planet, steps);
  }

  get passed() {
    return (this.$store.state.gaiaViewer.data.passedPlayers || []).includes(this.player.player);
  }

  get round() {
    return this.$store.state.gaiaViewer.data.round;
  }

  get hasLostPlanet() {
    return (this.player.ownedPlanetsCount.l ?? 0) > 0;
  }
}
</script>

<style lang="scss">
.player-token {
  stroke: #111;
  pointer-events: none;
  stroke-width: 1;
}

.content {
  font-size: 1rem;
  color: #212529;
  pointer-events: none;
}

.player-board {
  border: 1px solid black;
  max-width: 700px;
  display: block;
  // margin-left: auto;
  margin-right: auto;

  .board-text {
    pointer-events: none;
    dominant-baseline: mathematical;
    font-size: 1.2px;

    &.current-round,
    &.int,
    &.terra,
    &.nav,
    &.gaia {
      fill: white;
    }
  }

  // &::after {
  //   position: absolute;
  //   content: " ";
  //   background: rgba(white, 0.4);
  //   top: 0; bottom: 0; left: 0; right: 0;
  // }

  &.bescods::after,
  &.firaks::after {
    background: rgba(white, 0.7);
  }
}

.player-info {
  padding-top: 0.5em;
  padding-bottom: 0.5em;

  border-radius: 5px;

  position: relative;

  .player-name {
    cursor: pointer;
    font-weight: bold;

    &.dropped {
      text-decoration: line-through;
    }
  }

  flex-wrap: nowrap !important;

  @media (max-width: 600px) {
    flex-wrap: wrap !important;
  }

  .tiles {
    align-content: baseline;
    align-items: center;
    // justify-content: center;
  }

  .tiles,
  .board {
    z-index: 1;
    position: relative;
  }

  .faction-name {
    font-size: 1.2px;
    dominant-baseline: mathematical;
    cursor: pointer;
    outline: 0;
  }

  .max-resource {
    color: red;
  }
}
</style>
