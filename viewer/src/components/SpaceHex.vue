<template>
  <g :id="`${hex}`">
    <defs>
      <linearGradient
        v-for="p in this.planetColors"
        :key="`lg-${p.planet}`"
        :id="`federation-gradient-line-${p.planet}`"
        gradientUnits="userSpaceOnUse"
        x1="-1"
        y1="-1"
        x2="1"
        y2="1"
        gradientTransform="rotate(135)"
      >
        <stop offset="40%" stop-opacity="0" />
        <stop offset="50%" stop-opacity="1" :stop-color="p.color" />
        <stop offset="60%" stop-opacity="0" />
      </linearGradient>

      <line
        v-for="p in this.planetColors"
        :key="`l-${p.planet}`"
        :id="`federation-line-${p.planet}`"
        x1="0"
        y1="0"
        x2="0"
        y2="0.9"
        :stroke="`url(#federation-gradient-line-${p.planet})`"
        stroke-width="1"
        opacity=".5"
      />

      <linearGradient
        v-for="p in this.planetColors"
        :key="`blg-${p.planet}`"
        :id="`federation-gradient-big-line-${p.planet}`"
        gradientUnits="userSpaceOnUse"
        x1="-1"
        y1="-1"
        x2="1"
        y2="1"
        gradientTransform="rotate(135)"
      >
        <stop offset="10%" stop-opacity="0" />
        <stop offset="50%" stop-opacity="1" :stop-color="p.color" />
        <stop offset="90%" stop-opacity="0" />
      </linearGradient>

      <line
        v-for="p in this.planetColors"
        :key="`bl-${p.planet}`"
        :id="`federation-big-line-${p.planet}`"
        x1="0"
        y1="0"
        x2="0"
        y2="0.9"
        :stroke="`url(#federation-gradient-big-line-${p.planet})`"
        stroke-width="1"
      />

      <radialGradient
        v-for="p in this.planetColors"
        :key="`rg-${p.planet}`"
        :id="`federation-gradient-arc-${p.planet}`"
        gradientUnits="userSpaceOnUse"
        cx="0"
        cy="0"
        r="3"
      >
        <stop offset="41%" stop-opacity="0" />
        <stop offset="50%" stop-opacity=".5" :stop-color="p.color" />
        <stop offset="59%" stop-opacity="0" />
      </radialGradient>

      <path
        v-for="p in this.planetColors"
        :key="`arc-${p.planet}`"
        :id="`federation-arc-${p.planet}`"
        d="M 1.5 0 A 1.5 1.5 0 0 0 0.7500000000000002 -1.299038105676658"
        fill="none"
        :stroke="`url(#federation-gradient-arc-${p.planet})`"
        stroke-width=".7"
        transform="translate(-1.52,.86)"
      />
    </defs>
    <title v-text="tooltip" />
    <use xlink:href="#space-hex" :class="polygonClasses(hex)" @click="hexClick(hex)" />

    <use v-for="(l, i) in federationLines" :key="`fl-${i}`" :xlink:href="l.id" :transform="`rotate(${l.rotate})`" />
    <text class="sector-name" v-if="isCenter">
      {{ hex.data.sector[0] === "s" ? parseInt(hex.data.sector.slice(1)) : parseInt(hex.data.sector) }}
    </text>
    <use v-if="powerHighlightClass" xlink:href="#space-hex" :class="['space-hex-federation', powerHighlightClass]" />
    <Planet
      v-if="showPlanet"
      :planet="hex.data.planet"
      :faction="faction(hex.data.player)"
      :classes="planetClasses(hex)"
    />
    <Building
      style="stroke-width: 10"
      v-if="hex.data.building"
      :building="hex.data.building"
      :faction="faction(hex.data.player)"
      outline
      :flat="flat"
      transform="scale(0.1)"
    />
    <Building
      style="stroke-width: 10"
      v-if="highlightBuilding"
      :building="highlightBuilding.building"
      :faction="faction(highlightBuilding.player)"
      outline
      :flat="flat"
      transform="scale(0.1)"
    />
    <Building
      style="stroke-width: 10"
      v-if="hex.data.additionalMine !== undefined"
      :faction="faction(hex.data.additionalMine)"
      building="m"
      transform="translate(0.4, 0.2) scale(0.09)"
      class="additionalMine"
      :flat="flat"
      outline
    />
    <Building
      v-for="(s, i) in ships"
      :key="`b-${i}`"
      :building="s.type"
      :ship-moved="s.moved"
      :faction="faction(s.player)"
      outline
      :flat="flat"
      :transform="shipTransform(i)"
    />
    <Building
      v-for="(p, i) in hex.customPosts"
      :key="`cp-${i}`"
      building="customsPost"
      :faction="faction(p)"
      outline
      :flat="flat"
      :transform="radiusTransform(p, 0.05)"
    />
    <g v-for="(p, i) in hex.tradeTokens" :key="`tt-${i}`">
      <Planet :planet="playerPlanet(p)" :transform="radiusTransform(p, 0.35)" />
    </g>
    <use
      v-if="mapModeHighlight !== null"
      xlink:href="#space-hex"
      :class="['space-hex-federation', 'planet', 'planet-fill', playerPlanet(mapModeHighlight)]"
    />
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, {
  Building as BuildingEnum,
  Faction,
  factionPlanet,
  GaiaHex,
  Planet as PlanetEnum,
  Player,
  PlayerEnum,
  shipsInHex,
  SpaceMap as ISpaceMap,
} from "@gaia-project/engine";
import { Direction } from "hexagrid";
import { corners, FederationLine, playerFederationLines } from "../graphics/hex";
import Planet from "./Planet.vue";
import Building from "./Building.vue";
import { buildingData, buildingName } from "../data/building";
import planets, { planetNames } from "../data/planets";
import { HexSelection, HighlightHex, HighlightHexData, WarningsPreference } from "../data";
import { isWarningEnabled } from "../data/warnings";
import { factionName } from "../data/factions";
import { leechPlanets, radiusTranslate, upgradableBuildingsOfOtherPlayers } from "../logic/utils";
import { Ship } from "@gaia-project/engine/src/enums";
import { MapMode, MapModeType } from "../data/actions";
import { isFree } from "../logic/buttons/utils";
import { max } from "lodash";

type BuildingOverride = { building: BuildingEnum; player: PlayerEnum };
@Component<SpaceHex>({
  components: {
    Planet,
    Building,
  },
})
export default class SpaceHex extends Vue {
  @Prop()
  hex: GaiaHex;

  @Prop()
  isCenter: boolean;

  planetColors = Object.entries(planets).map(e => ({ planet: e[0], color: e[1].color }));

  shipTransform(index: number): string {
    switch (this.ships.length) {
      case 1:
        return "scale(0.1)";
      case 2:
        return `scale(0.07) ${radiusTranslate(5.8, 2 * index + 1, 4)}`;
      default:
        return `scale(0.06) ${radiusTranslate(7.5, index, this.ships.length)}`;
    }
  }

  radiusTransform(index: number, scale: number): string {
    return `scale(${scale}) ${radiusTranslate(.63 / scale, index, 7)}`;
  }

  get hexCorners() {
    return corners();
  }

  get flat() {
    return this.$store.state.preferences.flatBuildings;
  }

  get map(): ISpaceMap {
    return this.engine.map;
  }

  get ships(): Ship[] {
    let firstHidden = false;
    return shipsInHex(this.hex.toString(), this.engine).filter(s => {
      if (firstHidden) {
        return true;
      }
      const b = this.hideBuilding;
      const hide = b && b.building == s.type && b.player == s.player;
      if (hide) {
        firstHidden = true;
      }
      return !hide;
    });
  }

  private get engine(): Engine {
    return this.$store.state.data;
  }

  get warningPreference(): WarningsPreference {
    return this.$store.state.preferences.warnings;
  }

  warning(hex: GaiaHex, tooltip: boolean): string | null {
    if (this.warningPreference === WarningsPreference.Tooltip && !tooltip) {
      return null;
    }

    return this.highlightedHexes?.get(hex)?.warnings
      ?.filter(w => tooltip || isWarningEnabled(w.disableKey, this.$store.state.preferences))
      ?.map((w) => w.message)
      ?.join(", ");
  }

  get highlightBuilding(): BuildingOverride | null {
    return this.buildingOverride(this.hex, h => h.building);
  }

  get hideBuilding(): BuildingOverride | null {
    return this.buildingOverride(this.hex, h => h.hideBuilding);
  }

  buildingOverride(hex: GaiaHex, prop: (h: HighlightHex) => BuildingEnum | null): BuildingOverride | null {
    const h = this.highlightedHexes?.get(hex);
    const building = h ? prop(h) : null;

    return building ? { building, player: this.engine.currentPlayer } : null;
  }

  polygonClasses(hex: GaiaHex): string[] {
    const ret = ["space-hex"];

    const selection = this.selection;
    if (this.mapModes.length > 0) {
      if (this.planetMapMode) {
        ret.push("bold");
      }
    } else if (selection) {
      if (selection.hexes.has(hex)) {
        const h = selection.hexes?.get(hex);
        if (!h.preventClick) {
          ret.push("pointer");
        }

        if (h.class) {
          ret.push(h.class);
        } else if (this.warning(hex, false)) {
          ret.push("warn");
        } else if (this.cost(hex).includes("q")) {
          ret.push("qic");
        } else if (selection.selectedLight || h.hideBuilding) {
          ret.push("light");
        } else {
          ret.push("bold");
        }
      } else if (selection.backgroundLight) {
        ret.push("light");
      }
    } else {
      if (this.recent(hex)) {
        ret.push("recent");
      } else if (this.currentRound(hex)) {
        ret.push("current-round");
      }
    }

    return ret;
  }

  planetClasses(hex: GaiaHex): string[] {
    const ret = [];
    const highlightHex = this.highlightedHexes?.get(hex);
    if (this.warning(hex, false)) {
      ret.push("warn");
    }
    if (highlightHex) {
      ret.push("highlighted");
    }
    return ret;
  }

  cost(hex: GaiaHex) {
    const data = this.highlightedHexes?.get(hex);

    return data && !isFree(data.cost) ? data.cost.replace(/,/g, ", ") : "";
  }

  hexClick(hex: GaiaHex) {
    const h = this.highlightedHexes?.get(hex);
    if (h != null || this.selectAnyHex) {
      this.$store.dispatch("hexClick", { hex: hex, highlight: h });
    }
  }

  faction(player: PlayerEnum): Faction {
    return player != null ? this.player(player).faction : null;
  }

  player(player: PlayerEnum): Player {
    return this.engine.player(player);
  }

  get mapModes(): MapMode[] {
    return this.$store.getters.mapModes;
  }

  get planetMapMode(): boolean {
    return this.mapModes.filter(m => m.planet === this.planet).length > 0;
  }

  private playerMapMode(type: MapModeType): MapMode | null {
    return this.mapModes.find(mode => mode.type === type);
  }

  get federationLines(): FederationLine[] {
    return this.powerHighlightClass ? [] :
      this.hex.federations.flatMap(player => playerFederationLines(this.map.grid, this.hex, this.player(player)));
  }

  get showPlanet(): boolean {
    if (this.hex.data.planet === "e") {
      return false;
    }
    const c = this.powerHighlightClass;
    return c === null || !c.includes("planet");
  }

  get planet() {
    return this.hex.data.planet;
  }

  get mapModeHighlight(): PlayerEnum | null {
    if (this.planet === "e") {
      const sec = this.playerMapMode(MapModeType.sectors);
      if (sec && this.player(sec.player).data.occupied.some((hex) => hex.colonizedBy(sec.player) && hex.data.sector === this.hex.data.sector)) {
        return sec.player;
      }

      const fed = this.playerMapMode(MapModeType.federations);
      if (fed && this.hex.federations.some(f => f === fed.player)) {
        return fed.player;
      }
    }
    return null;
  }

  get powerHighlightClass(): string | null {
    if (this.planetMapMode) {
      return null;
    }
    const leech = this.playerMapMode(MapModeType.leech);
    const federations = this.playerMapMode(MapModeType.federations);
    if (leech) {
      return this.leechHighlightClass(leech);
    } else if (federations) {
      return this.federationPlanetClass(federations);
    } else {
      return null;
    }
  }

  private leechHighlightClass(mode: MapMode) {
    const hex = this.hex;
    const p = mode.player;
    const maxLeech = max(leechPlanets(this.map, p, hex).map(lp => this.player(p).buildingValue(lp.hex, { building: lp.building })));
    if (maxLeech) {
      const otherPlayers = upgradableBuildingsOfOtherPlayers(this.engine, hex, p);
      if (otherPlayers) {
        return this.powerValueClass(maxLeech);
      } else if (hex.colonizedBy(mode.player)) {
        return null;
      } else {
        return "leech empty";
      }
    }
    return null;
  }

  private powerValueClass(powerValue) {
    return `leech power${powerValue} planet`;
  }

  private federationPlanetClass(mode: MapMode) {
    const value = this.player(mode.player).buildingValue(this.hex, { federation: true });

    if (value > 0) {
      return this.powerValueClass(value);
    }
    return null;
  }

  playerPlanet(player: PlayerEnum): PlanetEnum {
    return factionPlanet(this.faction(player));
  }

  get highlightedHexes(): HighlightHexData | null {
    return this.selection?.hexes;
  }

  recent(hex: GaiaHex): boolean {
    return this.$store.getters.recentHexes.has(hex);
  }

  currentRound(hex: GaiaHex): boolean {
    return this.$store.getters.currentRoundHexes.has(hex);
  }

  get selection(): HexSelection | null {
    return this.context().highlighted.hexes;
  }

  get selectAnyHex() {
    return !!this.selection?.selectAnyHex;
  }

  private context() {
    return this.$store.state.context;
  }

  get tooltip(): string {
    const hex = this.hex;
    const data = hex.data;
    const planet = data.planet !== "e" ? `Planet: ${planetNames[data.planet]}` : null;
    const c = this.cost(hex);
    const messages: string[] = [];
    const highlightHex = this.highlightedHexes?.get(hex);
    if (c) {
      messages.push(highlightHex?.building
        ? `Build ${buildingData[highlightHex.building].name} for ${c}`
        : `Cost: ${c}`);
    }
    if (highlightHex?.tradeCost) {
      messages.push(`Trade Cost: ${highlightHex.tradeCost}`);
    }
    if (highlightHex?.rewards) {
      messages.push(`Reward: ${highlightHex.rewards}`);
    }

    const buildingLabel = (player: Player, building: BuildingEnum) => {
      const value = player.buildingValue(hex, { building });
      const fedValue = player.buildingValue(hex, { federation: true, building });
      let powerValue = `Power Value: ${value}`;
      if (value != fedValue) {
        powerValue += ` (For Federations: ${fedValue})`;
      }

      const faction = player.faction;
      return `Building: ${buildingName(building, faction)} (${factionName(faction)}, ${powerValue})`;
    };

    const buildings: string[] = [];
    let ships: string[] = [];
    if (data.building) {
      buildings.push(buildingLabel(this.player(data.player), data.building));
      if (data.additionalMine != null) {
        buildings.push(buildingLabel(this.player(data.additionalMine), BuildingEnum.Mine));
      }
    } else if (this.ships) {
      ships = this.ships.map(s => {
        const faction = this.player(s.player).faction;
        return (`${buildingName(s.type, faction)} (${factionName(faction)})`);
      });
    }
    buildings.push(...hex.customPosts.map(p => buildingLabel(this.player(p), BuildingEnum.CustomsPost)));
    buildings.push(...hex.tradeTokens.map(p => `Traded: ${factionName(this.player(p).faction)}`));
    const w = this.warning(hex, true);
    if (w) {
      messages.push(`Warning: ${w}`);
    }
    const coord = `Coordinates: ${hex}`;
    return [coord, planet]
      .concat(buildings)
      .concat(ships)
      .concat(messages)
      .join(" ");
  }
}
</script>

<style lang="scss">
svg {
  .space-hex {
    fill: #172e62;
    stroke: #666;
    stroke-width: 0.01;

    &.pointer {
      cursor: pointer;
    }

    &.bold {
      fill: white;
    }

    &.light {
      opacity: 0.7;
    }

    &.range {
      opacity: 0.8;
    }

    &.warn {
      fill: red;
    }

    &.qic {
      fill: lightGreen;

      &.range {
        fill: var(--gaia);
        opacity: 0.6;
      }
    }

    &.current-round {
      fill: var(--current-round);
    }

    &.recent {
      fill: var(--recent);
    }
  }

  .space-hex-federation {
    stroke-width: 0.1;
    fill: none;
    pointer-events: none;
  }

  .leech {
    &.empty {
      fill: white;
      opacity: 0.3;
    }

    &.power1 {
      fill: var(--res-power);
    }

    &.power2 {
      fill: var(--rt-eco);
    }

    &.power3 {
      fill: var(--specialAction);
    }

    &.power4 {
      fill: var(--rt-terra);
    }

    &.power5 {
      fill: var(--current-round);
    }
  }

  .sector-name {
    text-anchor: middle;
    dominant-baseline: central;
    font-size: 1px;
    fill: white;
    opacity: 0.75;
    pointer-events: none;
  }
}
</style>
