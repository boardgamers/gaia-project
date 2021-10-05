<template>
  <g :id="`${hex}`">
    <title>
      Coordinates: {{ hex }}{{ hex.data.planet !== "e" ? `&#10;Planet: ${planetName(hex.data.planet)}` : ""
      }}{{ hex.data.building ? `&#10;Building: ${buildingName(hex.data.building, hex.data.player)}` : ""
      }}{{ cost(hex) ? `&#10;Cost: ${cost(hex)}` : "" }}{{ warning(hex) ? `&#10;Warning: ${warning(hex)}` : "" }}
    </title>
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
      v-if="hex.data.additionalMine !== undefined"
      :faction="faction(hex.data.additionalMine)"
      building="m"
      transform="translate(0.4, 0.2) scale(0.09)"
      class="additionalMine"
      :flat="flat"
      outline
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
import Engine, {
  Building as BuildingEnum,
  factionPlanet,
  GaiaHex,
  Planet as PlanetEnum,
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

  get hexCorners() {
    return corners();
  }

  get flat() {
    return this.$store.state.preferences.flatBuildings;
  }

  get map(): ISpaceMap {
    return this.$store.state.data.map;
  }

  warning(hex: GaiaHex): string {
    const warnings = this.highlightedHexes?.get(hex)?.warnings;
    return warnings?.length > 0 ? warnings?.map((w) => moveWarnings[w].text).join(", ") : null;
  }

  polygonClasses(hex: GaiaHex): string[] {
    const ret = ["space-hex"];

    const selection = this.selection;
    if (selection) {
      if (selection.hexes.has(hex)) {
        ret.push("highlighted");

        if (this.warning(hex)) {
          ret.push("warn");
        } else if (this.cost(hex).includes("q")) {
          ret.push("qic");
        } else if (selection.selectedLight) {
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

  faction(player) {
    if (player === undefined || player === "wild") {
      return player; // Wild will get recognized as purple, for trade tokens. A bit of a hack
    }
    return this.$store.state.data.players[player].faction;
  }

  planet(player) {
    return factionPlanet(this.faction(player));
  }

  buildingName(building: BuildingEnum, player) {
    const name = factionName(this.faction(player));
    return `${buildingName(building, this.faction(player))} (${name})`;
  }

  planetName(planet: PlanetEnum) {
    return planetNames[planet];
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

  get gameData(): Engine {
    return this.$store.state.data;
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
}
</script>

<style lang="scss">
svg {
  .space-hex {
    fill: #172e62;
    stroke: #666;
    stroke-width: 0.01;

    &.highlighted {
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
