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
      :class="['space-hex-federation', 'planet', planet(player)]"
      :key="`${player}-${index}`"
    />
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
  HighlightHex,
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
import { HexSelection, HighlightHexData } from "../data";
import { moveWarnings } from "../data/warnings";
import { factionName } from "../data/factions";
import { radiusTranslate } from "../logic/utils";
import { Ship } from "@gaia-project/engine/src/enums";
import { shipsInHex } from "@gaia-project/engine/src/available-command";

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
    if (selection) {
      if (selection.hexes.has(hex)) {
        const h = selection.hexes?.get(hex);
        if (!h.preventClick) {
          ret.push("pointer");
        }

        if (this.warning(hex)) {
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

    return data && data.cost && data.cost !== "~" ? data.cost.replace(/,/g, ", ") : "";
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

  planet(player: PlayerEnum): PlanetEnum {
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
