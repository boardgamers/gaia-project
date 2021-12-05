<template>
  <g :id="`${hex}`">
    <title v-text="tooltip" />
    <use xlink:href="#space-hex" :class="polygonClasses(hex)" @click="hexClick(hex)" />
    <text class="sector-name" v-if="isCenter">
      {{ hex.data.sector[0] === "s" ? parseInt(hex.data.sector.slice(1)) : parseInt(hex.data.sector) }}
    </text>
    <Planet
      v-if="hex.data.planet !== 'e'"
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
      :key="i"
      :building="s.type"
      :ship-moved="s.moved"
      :faction="faction(s.player)"
      outline
      :flat="flat"
      :transform="shipTransform(i)"
    />
    <polygon
      v-for="(player, index) in hex.data.federations || []"
      :points="hexCorners.map((p) => `${p.x * (1 - (index + 0.5) / 8)},${p.y * (1 - (index + 0.5) / 8)}`).join(' ')"
      :class="{
        'space-hex-federation': true,
        planet: true,
        'planet-fill': federationHighlight(player),
        [playerPlanet(player)]: true,
      }"
      :key="`${player}-${index}`"
    />
    <use
      v-if="sectorHighlight !== null"
      xlink:href="#space-hex"
      :class="['space-hex-federation', 'planet', 'planet-fill', playerPlanet(sectorHighlight)]"
    />
    <use v-if="leechHighlightClass" xlink:href="#space-hex" :class="['space-hex-federation', leechHighlightClass]" />
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import {
  Building as BuildingEnum,
  Faction,
  factionPlanet,
  GaiaHex,
  Planet as PlanetEnum,
  Player,
  PlayerEnum,
  SpaceMap as ISpaceMap,
} from "@gaia-project/engine";
import { corners } from "../graphics/hex";
import Planet from "./Planet.vue";
import Building from "./Building.vue";
import { buildingName } from "../data/building";
import { planetNames } from "../data/planets";
import { HexSelection, HighlightHex, HighlightHexData } from "../data";
import { moveWarnings } from "../data/warnings";
import { factionName } from "../data/factions";
import { leechPlanets, radiusTranslate, upgradableBuildingsOfOtherPlayers } from "../logic/utils";
import { Ship } from "@gaia-project/engine/src/enums";
import { shipsInHex } from "@gaia-project/engine/src/available-command";
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

  private get engine() {
    return this.$store.state.data;
  }

  warning(hex: GaiaHex): string {
    const warnings = this.highlightedHexes?.get(hex)?.warnings;
    return warnings?.length > 0 ? warnings?.map((w) => moveWarnings[w].text).join(", ") : null;
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
    const modes = this.mapModes.filter(m => m.planet);
    if (modes.length > 0) {
      if (modes.filter(m => m.planet === this.planet).length > 0) {
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
        } else if (this.warning(hex)) {
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
    if (highlightHex?.warnings?.length > 0) {
      ret.push("warn");
    }
    if (highlightHex) {
      ret.push("highlighted");
    }
    return ret;
  }

  cost(hex: GaiaHex) {
    const data = this.highlightedHexes?.get(hex);

    return data && !isFree(data) ? data.cost.replace(/,/g, ", ") : "";
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
    return this.engine.players[player];
  }

  get mapModes(): MapMode[] {
    return this.$store.getters.mapModes;
  }

  private playerMapMode(type: MapModeType): MapMode | null {
    return this.mapModes.find(mode => mode.type === type);
  }

  federationHighlight(player: PlayerEnum): boolean {
    return this.planet === "e" && this.playerMapMode("federations")?.player == player ? this.hex.data.federations?.some(f => f === player) : false;
  }

  get planet() {
    return this.hex.data.planet;
  }

  get sectorHighlight(): PlayerEnum | null {
    const mode = this.playerMapMode("sectors");
    return mode
    && this.planet === "e"
    && this.player(mode.player).data.occupied.some((hex) => hex.colonizedBy(mode.player) && hex.data.sector === this.hex.data.sector)
      ? mode.player
      : null;
  }

  get leechHighlightClass(): string | null {
    const mode = this.playerMapMode("leech");

    if (mode) {
      const hex = this.hex;
      const p = mode.player;
      const maxLeech = max(leechPlanets(this.map, p, hex).map(h => this.player(p).buildingValue(h)));
      if (maxLeech) {
        const otherPlayers = upgradableBuildingsOfOtherPlayers(this.engine, hex, p);
        if (otherPlayers) {
          return `leech power${maxLeech} planet`;
        } else {
          return "leech empty";
        }
      }
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
    const cost = c ? `Cost: ${c}` : null;

    const buildingLabel = (player: Player) => {
      const value = player.buildingValue(hex);
      const fedValue = player.buildingValue(hex, { federation: true });
      let powerValue = `Power Value: ${value}`;
      if (value != fedValue) {
        powerValue += ` (For Federations: ${fedValue})`;
      }

      const faction = player.faction;
      return `Building: ${buildingName(hex.buildingOf(player.player), faction)} (${factionName(faction)}, ${powerValue})`;
    };

    let building = null;
    let guestBuilding = null;
    let ships: string[] = [];
    if (data.building) {
      building = buildingLabel(this.player(data.player));
      if (data.additionalMine != null) {
        guestBuilding = buildingLabel(this.player(data.additionalMine));
      }
    } else if (this.ships) {
      ships = this.ships.map(s => {
        const faction = this.player(s.player).faction;
        return (`${buildingName(s.type, faction)} (${factionName(faction)})`);
      });
    }
    const w = this.warning(hex);
    const warning = w ? `Warning: ${w}` : null;
    const coord = `Coordinates: ${hex}`;
    return [
      coord, planet, building, guestBuilding, cost, warning,
    ].filter(s => s).concat(ships).join(" ");
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

    &.leech {
      &.empty {
        fill: white;
        opacity: 0.3;
      }

      &.power1 {
        fill: var(--ice);
      }

      &.power2 {
        fill: var(--desert);
      }

      &.power3 {
        fill: var(--volcanic);
      }

      &.power4 {
        fill: var(--swamp);
      }

      &.power5 {
        fill: var(--current-round);
      }
    }
  }

  .sector-name {
    text-anchor: middle;
    dominant-baseline: central;
    font-size: 1px;
    fill: white;
    opacity: 0.35;
    pointer-events: none;
  }
}
</style>
