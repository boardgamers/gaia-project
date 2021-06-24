<template>
  <g :id="`${hex}`">
    <title>
      Coordinates: {{ hex }}{{ hex.data.planet !== "e" ? `&#10;Planet: ${planetName(hex.data.planet)}` : ""
      }}{{ hex.data.building ? `&#10;Building: ${buildingName(hex.data.building, hex.data.player)}` : ""
      }}{{ cost(hex) ? `&#10;Cost: ${cost(hex)}` : "" }}{{ warning(hex) ? `&#10;Warning: ${warning(hex)}` : "" }}
    </title>
    <use
      xlink:href="#space-hex"
      :class="[
        'space-hex',
        {
          'to-select': toSelect,
          highlighted: highlightedHexes.has(hex),
          recent: recent(hex),
          'current-round': currentRound(hex),
          qic: cost(hex).includes('q'),
          power: cost(hex).includes('pw'),
          warn: warning(hex) != null,
        },
      ]"
      @click="hexClick(hex)"
    />
    <text class="sector-name" v-if="isCenter">
      {{ hex.data.sector[0] === "s" ? parseInt(hex.data.sector.slice(1)) : parseInt(hex.data.sector) }}
    </text>
    <Planet v-if="hex.data.planet !== 'e'" :planet="hex.data.planet" :faction="faction(hex.data.player)" />
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
import { HighlightHexData } from "../data";
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
    return this.$store.state.gaiaViewer.preferences.flatBuildings;
  }

  get map(): ISpaceMap {
    return this.$store.state.gaiaViewer.data.map;
  }

  warning(hex: GaiaHex): string {
    const warnings = this.highlightedHexes.get(hex)?.warnings;
    return warnings?.length > 0 ? warnings?.map((w) => moveWarnings[w].text).join(", ") : null;
  }

  cost(hex: GaiaHex) {
    const data = this.highlightedHexes.get(hex);

    return data && data.cost && data.cost !== "~" ? data.cost.replace(/,/g, ", ") : "";
  }

  hexClick(hex: GaiaHex) {
    const h = this.highlightedHexes.get(hex);
    if (h != null || this.toSelect) {
      this.$store.dispatch("gaiaViewer/hexClick", { hex: hex, highlight: h });
    }
  }

  faction(player) {
    if (player === undefined || player === "wild") {
      return player; // Wild will get recognized as purple, for trade tokens. A bit of a hack
    }
    return this.$store.state.gaiaViewer.data.players[player].faction;
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

  get highlightedHexes(): HighlightHexData {
    return this.$store.state.gaiaViewer.context.highlighted.hexes;
  }

  recent(hex: GaiaHex): boolean {
    return this.$store.getters["gaiaViewer/recentHexes"].has(hex);
  }

  currentRound(hex: GaiaHex): boolean {
    return this.$store.getters["gaiaViewer/currentRoundHexes"].has(hex);
  }

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get toSelect() {
    return !!this.context().hexSelection;
  }

  private context() {
    return this.$store.state.gaiaViewer.context;
  }
}
</script>

<style lang="scss">
svg {
  .space-hex {
    fill: #172e62;
    stroke: #666;
    stroke-width: 0.01;

    &:hover {
      fill-opacity: 0.5;
    }

    &.highlighted {
      fill: white;
      cursor: pointer;

      &.warn {
        fill: red !important;
      }

      &.qic {
        fill: lightGreen;
      }

      &.power {
        fill: #d378d3;
      }
    }

    &.current-round:not(.highlighted):not(.to-select) {
      fill: var(--current-round);
    }

    &.recent:not(.highlighted):not(.to-select) {
      fill: var(--recent);
    }

    &.to-select {
      cursor: pointer;
      opacity: 0.7;
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
