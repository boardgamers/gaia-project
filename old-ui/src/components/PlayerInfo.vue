<template>
  <div class="player-info no-gutters" v-if="player && player.faction">
    <span @click="playerClick(player)" :class="['player-name', { dropped: player.dropped }]" role="button">{{
      name
    }}</span>
    <div class="board mt-2">
      <svg :viewBox="`-0.2 -0.5 38.5 ${height}`" class="player-board" :style="`background-color: ${factionColor}`">
        <rect x="-1" y="-1" width="50" height="50" fill="#ffffff44"></rect>
        <PlayerBoardInfo
          transform="translate(0.5, 0.5)"
          :player="player"
          :faction="player.faction"
          :data="playerData"
          :height="height"
        />
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
        <line x1="5.7" x2="5.7" y1="11.2" y2="11.8" stroke="black" stroke-width="0.06" />
        <!-- LAB to AC -->
        <line x1="15.3" x2="15.3" y1="11.2" y2="11.8" stroke="black" stroke-width="0.06" />
        <!-- TS to LAB -->
        <line x1="10.4" x2="11" y1="13.0" y2="13.0" stroke="black" stroke-width="0.06" />
        <BuildingGroup
          transform="translate(21,1.2)"
          :nBuildings="playerData.gaiaformers"
          building="gf"
          :gaia="playerData.gaiaformersInGaia"
          :player="player"
          :placed="playerData.buildings.gf"
          :asteroid-consumed="playerData.gaiaformersUsedForAsteroid"
          :resource="[]"
        />
        <PowerBowls
          :transform="`translate(29,${height - 7})`"
          :faction="player.faction"
          :data="playerData"
          :player="player"
        />

        <g transform="translate(29.3, 4.7) scale(0.9) translate(0, 1)">
          <g v-for="i in [0, 1, 2, 3]" :key="i" :transform="`translate(${(i - 2) * 3.8}, 0)`">
            <g
              v-for="marker in terraformingMarkers(i)"
              :key="marker.planet"
              :data-terraforming-step="i"
              :data-planet="marker.planet"
              :data-radius="marker.radius"
              :transform="`translate(${marker.x}, ${marker.y})`"
            >
              <circle
                :r="marker.radius"
                style="stroke-width: 0.06px !important"
                :class="['player-token', 'planet-fill', marker.planet]"
              />
              <text
                :style="`font-size: ${
                  marker.fontSize
                }px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(marker.planet)}`"
              >
                {{ player.ownedPlanetsCount[marker.planet] }}
              </text>
              <circle
                :r="marker.radius"
                style="cursor: pointer; opacity: 0"
                @click="togglePlanetHighlight(marker.planet)"
              />
            </g>
            <line x1="1.9" x2="1.9" y1="-2.3" y2="2.3" stroke-width="0.06" stroke="black" />
          </g>
          <g v-for="entry in planetCounters" :key="entry.planet" :transform="`translate(7.6, ${entry.y})`">
            <circle
              :r="planetCounterRadius"
              style="stroke-width: 0.06px !important"
              :class="['player-token', 'planet-fill', entry.planet]"
            />
            <text
              :style="`font-size: ${planetCounterFontSize}px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(
                entry.planet
              )}`"
            >
              {{ player.ownedPlanetsCount[entry.planet] }}
            </text>
            <circle
              :r="planetCounterRadius"
              style="cursor: pointer; opacity: 0"
              @click="togglePlanetHighlight(entry.planet)"
            />
          </g>
        </g>

        <SpecialAction
          v-for="(action, i) in player.actionsWithoutTile"
          :action="[action.rewards]"
          :player="player"
          :disabled="!action.enabled || passed"
          :key="'action-' + i"
          :y="height - 4"
          width="3.1"
          height="3.1"
          :x="3.3 * i"
        />
      </svg>
      <span v-if="player.faction === 'ivits'">
        Value of structures in federation: {{ player.fedValue }}<br />
        Value of other structures: {{ player.structureValue - player.fedValue }}
      </span>
    </div>

    <div class="tiles row no-gutters mt-1">
      <Booster
        v-if="playerData.tiles.booster"
        class="mb-1 mr-1"
        :booster="playerData.tiles.booster"
        :disabled="passed"
      />
      <FederationTile
        v-for="(fed, i) in playerData.tiles.federations"
        class="mb-1 mr-1"
        :key="i"
        :federation="fed.tile"
        :used="!fed.green"
        :player="player.player"
        :numTiles="1"
      />
      <FederationTile
        v-for="(fed, i) in playerData.spaceshipFederations"
        class="mb-1 mr-1"
        :key="'ship-fed-' + i"
        :data-ship-federation="fed.tile"
        :spaceship-federation="fed.tile"
        :rewardsOverride="shipFederationRewards(fed.tile)"
        :used="!fed.green"
        :player="player.player"
        :numTiles="1"
        filter="url(#shadow-1)"
      />
      <span
        v-for="(artifact, i) in playerData.artifacts"
        class="mb-1 mr-1 d-inline-flex player-artifact"
        :class="{ 'last-move': recentArtifact(artifact) }"
        :key="'artifact-' + i"
        :data-artifact="artifact"
      >
        <ArtifactIcon :artifact="artifact" />
      </span>
      <TechTile
        v-for="tech in playerData.tiles.techs"
        :covered="!tech.enabled"
        class="mb-1 mr-1"
        :key="tech.pos"
        :pos="tech.pos"
        :player="player.player"
      />
    </div>
    <Rules :id="player.faction" :type="player.faction" />
  </div>
</template>

<script lang="ts">
import { Component } from "vue-property-decorator";
import CurrentPlayerInfo from "../../../viewer/src/components/PlayerInfo.vue";
import ArtifactIcon from "./ArtifactIcon.vue";
import Booster from "./Booster.vue";
import FederationTile from "./FederationTile.vue";
import BuildingGroup from "./PlayerBoard/BuildingGroup.vue";
import SpecialAction from "./SpecialAction.vue";
import TechTile from "./TechTile.vue";
@Component({ components: { SpecialAction, Booster, TechTile, FederationTile, ArtifactIcon, BuildingGroup } })
export default class PlayerInfo extends CurrentPlayerInfo {}
</script>
<style scoped>
.player-board {
  width: 100%;
  height: auto;
  border: 1px solid black;
}
</style>
