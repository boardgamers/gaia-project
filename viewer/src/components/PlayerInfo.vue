<template>
  <div class="player-info no-gutters" v-if="player && player.faction">
    <div class="d-flex justify-content-between align-items-center">
      <div style="display: flex; align-items: center" @click="playerClick(player)" role="button">
        <img class="player-avatar" :alt="`${name}'s avatar`" :src="avatar" />
        <span :class="['player-name', { dropped: player.dropped }]" role="button">{{ name }}</span>
      </div>
      <a
        v-if="strategyLink"
        v-b-popover.html.hover.click.left="
          `<iframe sandbox=&quot;allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox&quot; src=&quot;${strategyLink}&quot; width=&quot;640&quot; height=&quot;480&quot; allow=&quot;autoplay&quot;></iframe>`
        "
        title="Strategy Deck"
        >Strategy</a
      >
      <b-form-select
        :value="selectedMapModeType"
        :options="mapModeTypeOptions"
        @change="toggleMapMode"
        style="width: auto"
      />
    </div>
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
        <g transform="translate(4.4, 0)">
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
            v-if="isFrontiers"
            transform="translate(21, 10.7) scale(1.65)"
            :nBuildings="3"
            building="colony"
            :player="player"
            :placed="playerData.buildings.colony"
            :resource="[]"
          />
          <BuildingGroup
            v-if="isFrontiers"
            transform="translate(13.47, 20.57) scale(.6)"
            :nBuildings="5"
            building="customsPost"
            :player="player"
            :placed="playerData.buildings.customsPost"
            :resource="[]"
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
          tooltip="Terraforming Cost"
          :count="playerData.terraformCostDiscount"
          transform="translate(31.5,1) scale(0.09)"
          style="opacity: 0.7"
        />
        <Resource
          kind="r"
          tooltip="Range"
          :count="playerData.range"
          :transform="`translate(35.5,${isFrontiers ? 0.3 : 1}) scale(0.1)`"
          style="opacity: 0.7"
        />
        <Resource
          v-if="isFrontiers"
          kind="ship-range"
          tooltip="Ship Range"
          :count="playerData.shipRange"
          transform="translate(35.5,1.5) scale(0.1)"
          style="opacity: 0.7"
        />
        <g transform="translate(35.5,3.2) scale(0.1)">
          <Resource v-if="isFrontiers" kind="tradeBonus" :count="playerData.tradeBonus" style="opacity: 0.7" />
          <circle
            r="10"
            style="opacity: 0"
            v-b-modal.modal-center="'trade'"
            role="button"
            v-b-tooltip="'Trade Bonus'"
          />
        </g>
        <g transform="translate(37.3,3.2) scale(0.1)">
          <Resource
            v-if="isFrontiers"
            kind="tradeDiscount"
            :count="playerData.tradeCost().count"
            style="opacity: 0.7"
          />
          <circle
            r="10"
            style="opacity: 0"
            v-b-modal.modal-center="'trade'"
            role="button"
            v-b-tooltip="'Trading Cost in pw'"
          />
        </g>

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

        <g transform="translate(0, 18.5) scale(0.7)" v-if="isFrontiers">
          <BuildingGroup
            v-for="s in ships"
            :key="s"
            :transform="shipPositions[s]"
            :nBuildings="s === 'tradeShip' ? playerData.tradeShips : 3"
            :destroyed="playerData.destroyedShips[s]"
            :deployed="playerData.deployedShips[s]"
            :building="s"
            :player="player"
            :placed="playerData.buildings[s]"
            :resource="[]"
          />
        </g>

        <PowerBowls :transform="`translate(30,${height - 7})`" :player="player" />

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
                :style="`font-size: ${marker.fontSize}px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(
                  marker.planet
                )}`"
              >
                {{ player.ownedPlanetsCount[marker.planet] }}
              </text>
              <circle :r="marker.radius" style="cursor: pointer; opacity: 0" @click="togglePlanetHighlight(marker.planet)" />
            </g>
            <line x1="1.9" x2="1.9" y1="-2.3" y2="2.3" stroke-width="0.06" stroke="black" />
          </g>
          <g :transform="`translate(7.6, ${hasLostPlanet ? -1.4 : 0})`">
            <circle :r="1" style="stroke-width: 0.06px !important" :class="['player-token', 'planet-fill', 'g']" />
            <text style="font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: white">
              {{ player.ownedPlanetsCount["g"] }}
            </text>
            <circle :r="1" style="cursor: pointer; opacity: 0" @click="togglePlanetHighlight(planet)" />
          </g>
          <g v-if="hasLostPlanet" :transform="`translate(7.6, 1.4 )`">
            <circle :r="1" style="stroke-width: 0.06px !important" :class="['player-token', 'planet-fill', 'l']" />
            <text style="font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: white">
              {{ player.ownedPlanetsCount["l"] }}
            </text>
            <circle :r="1" style="cursor: pointer; opacity: 0" @click="togglePlanetHighlight(planet)" />
          </g>
        </g>

        <SpecialAction
          v-for="(action, i) in player.actions"
          :action="[action.rewards]"
          :player="player"
          :recent="recentAction(i)"
          :disabled="!action.enabled || passed"
          :key="action.rewards + '-' + i"
          :y="height - 4"
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
      <FederationTile
        v-for="(fed, i) in playerData.spaceshipFederations"
        class="mb-1 mr-1"
        :key="'ship-fed-' + i"
        :data-ship-federation="fed.tile"
        :rewardsOverride="shipFederationRewards(fed.tile)"
        :used="!fed.green"
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
    <Rules :id="player.faction" :type="player.faction" />
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop, Watch } from "vue-property-decorator";
import Engine, {
  Building,
  Expansion,
  factionPlanet,
  hasExpansion,
  Planet,
  Player,
  SpaceshipFederation,
} from "@gaia-project/engine";
import { spaceshipFederationDisplayRewards } from "../data/federations";
import { factionColor } from "../graphics/utils";
import TechTile from "./TechTile.vue";
import Booster from "./Booster.vue";
import SpecialAction from "./SpecialAction.vue";
import FederationTile from "./FederationTile.vue";
import BuildingGroup from "./PlayerBoard/BuildingGroup.vue";
import PlayerBoardInfo from "./PlayerBoard/Info.vue";
import PowerBowls from "./PlayerBoard/PowerBowls.vue";
import Rules from "./Rules.vue";
import { factionData, factionName, planetsWithSteps } from "../data/factions";
import { MapMode, MapModeType } from "../data/actions";
import { mapModeTypeOptions } from "../data/stats";

type TerraformingMarker = {
  planet: Planet;
  x: number;
  y: number;
  radius: number;
  fontSize: number;
};

@Component({
  components: {
    TechTile,
    Booster,
    SpecialAction,
    FederationTile,
    BuildingGroup,
    PowerBowls,
    PlayerBoardInfo,
    Rules,
  },
})
export default class PlayerInfo extends Vue {
  @Prop()
  player: Player;

  protected selectedMapModeType: MapModeType = MapModeType.default;

  get playerData() {
    return this.player?.data;
  }

  playerClick(player: Player) {
    this.$store.dispatch("playerClick", player);
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
    return this.engine;
  }

  get avatar(): string {
    return (
      this.$store.state.avatars[this.player.player] || `https://avatars.dicebear.com/api/pixel-art/${this.name}.svg`
    );
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
    const commands = this.$store.getters.recentActions.get(this.faction) ?? [];
    return commands.some((c) => c.args[0] === action.rewards);
  }

  planetFill(planet: string) {
    if (planet === Planet.Titanium || planet === Planet.Swamp) {
      return "white";
    }
    return "black";
  }

  shipFederationRewards(federation: SpaceshipFederation) {
    return spaceshipFederationDisplayRewards(federation);
  }

  planetsWithSteps(steps: number) {
    return planetsWithSteps(this.faction, steps, this.playerData?.lostFleetCost3Planets ?? []);
  }

  terraformingMarkers(steps: number): TerraformingMarker[] {
    const planets = this.planetsWithSteps(steps);
    const rowCounts = this.terraformingRowCounts(planets.length);
    const yPositions = this.terraformingRowYPositions(rowCounts.length);
    const radius = this.terraformingMarkerRadius(planets.length);
    const fontSize = this.terraformingMarkerFontSize(planets.length);
    const markers: TerraformingMarker[] = [];
    let planetIndex = 0;

    rowCounts.forEach((count, rowIndex) => {
      this.terraformingRowXPositions(count).forEach((x) => {
        const planet = planets[planetIndex++];
        if (!planet) {
          return;
        }

        markers.push({
          planet,
          x,
          y: yPositions[rowIndex],
          radius,
          fontSize,
        });
      });
    });

    return markers;
  }

  terraformingRowCounts(count: number): number[] {
    switch (count) {
      case 0:
        return [];
      case 1:
        return [1];
      case 2:
        return [1, 1];
      case 3:
        return [1, 2];
      case 4:
        return [2, 2];
      case 5:
        return [2, 3];
      case 6:
        return [3, 3];
      case 7:
        return [2, 3, 2];
      default: {
        const rows = Math.ceil(count / 3);
        const base = Math.floor(count / rows);
        const remainder = count % rows;
        return Array.from({ length: rows }, (_, index) => base + (index < remainder ? 1 : 0));
      }
    }
  }

  terraformingRowYPositions(count: number): number[] {
    switch (count) {
      case 1:
        return [0];
      case 2:
        return [-1.35, 1.35];
      default:
        return [-1.55, 0, 1.55];
    }
  }

  terraformingRowXPositions(count: number): number[] {
    switch (count) {
      case 1:
        return [0];
      case 2:
        return [-0.95, 0.95];
      default:
        return [-1.2, 0, 1.2];
    }
  }

  terraformingMarkerRadius(count: number): number {
    if (count <= 2) {
      return 1;
    }
    if (count <= 4) {
      return 0.8;
    }
    return 0.66;
  }

  terraformingMarkerFontSize(count: number): number {
    if (count <= 2) {
      return 1.4;
    }
    if (count <= 4) {
      return 1.1;
    }
    return 0.9;
  }

  get passed() {
    return (this.engine.passedPlayers || []).includes(this.player.player);
  }

  get round() {
    return this.engine.round;
  }

  get hasLostPlanet() {
    return (this.player.ownedPlanetsCount.l ?? 0) > 0;
  }

  get isFrontiers() {
    return hasExpansion(this.engine.expansions, Expansion.Frontiers);
  }

  get engine() {
    return this.$store.state.data;
  }

  get height() {
    return this.isFrontiers ? "26.2" : "21.4";
  }

  get ships(): Building[] {
    return Building.ships();
  }

  get shipPositions() {
    return {
      [Building.ColonyShip]: "translate(0, 0)",
      [Building.ConstructionShip]: "translate(8.5, 0)",
      [Building.ResearchShip]: "translate(17, 0)",
      [Building.TradeShip]: "translate(25.5, 0)",
      [Building.Scout]: "translate(0, 3)",
      [Building.Frigate]: "translate(8.5, 3)",
      [Building.BattleShip]: "translate(17, 3)",
    };
  }

  togglePlanetHighlight(planet: Planet) {
    this.$store.commit("toggleMapMode", { type: "planetType", planet } as MapMode);
  }

  get selectedMapModes(): MapMode[] {
    return this.$store.getters.mapModes;
  }

  get mapModeType(): MapModeType {
    return this.selectedMapModes.find((m) => m.player == this.player.player)?.type ?? MapModeType.default;
  }

  get mapModeTypeOptions() {
    return mapModeTypeOptions;
  }

  toggleMapMode(mode: MapModeType) {
    this.$store.commit("toggleMapMode", { type: mode, player: this.player.player } as MapMode);
  }

  @Watch("selectedMapModes")
  resetMapMode() {
    this.selectedMapModeType = this.mapModeType;
  }

  get strategyLink() {
    return factionData[this.faction].strategyLink;
  }
}
</script>

<style lang="scss">
.popover {
  max-width: 674px !important;
}

.player-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 1px solid gray;
  margin-right: 0.25rem;
}

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

.board-text {
  pointer-events: none;
  dominant-baseline: mathematical;
  font-size: 1.2px;
  text-align: center;
  stroke-width: 0.07;

  &.current-round {
    fill: white;
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
