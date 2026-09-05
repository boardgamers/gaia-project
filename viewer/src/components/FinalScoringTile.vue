<template>
  <g :class="['finalScoringTile', { highlighted }]" v-b-tooltip.nofade="tooltipTriggerConfig()" :title="tooltip">
    <!-- Accent plate + slightly offset white card, same panel language as the round scoring
         tiles. No text title: the condition icon alone heads the tile, centered and large, so the
         tile reads by its symbol (the tooltip still spells the condition out). -->
    <rect class="accent" x="1" y="1" width="75" height="70" rx="6" />
    <rect class="body" x="1" y="1" width="75" height="70" rx="6" />
    <!-- "FIN" tab top-right, same dark/bold style as the round tiles' "R1"-"R6" plates, marking
         this as the end-game scoring tile. -->
    <text class="fin-tab" x="70" y="12">FIN</text>
    <!-- The condition icon is the tile's hero, large and central in the upper area. Structures
         tiles show a cluster of buildings (mine + trading station + research lab), overlapping
         like the "planetary institute & academy" tech tile, rather than one faint building. The
         icons reference this same SVG's building defs, so they always render. -->
    <!-- The three buildings sit on a shared baseline (their bottoms line up) so the row reads as
         one structure skyline instead of a diagonal scatter. -->
    <!-- The structures skyline: mine, trading station, research lab and planetary institute on a
         shared baseline, each shifted left so they overlap leftward (each building peeks out from
         behind the previous one) and the rightmost (PI) stays inside the tile. -->
    <!-- The structures skyline: mine, trading station, research lab and planetary institute on a
         shared baseline, overlapping leftward (each peeks from behind the previous). No
         `outline-white` glow - on the white card the plain building silhouettes read cleanly. -->
    <g v-if="isBuildingCondition" class="condition-icon structures-cluster" transform="translate(38, 24)">
      <Building building="m" faction="gen" transform="translate(-22, 4) scale(2.1)" />
      <Building building="ts" faction="gen" transform="translate(-8, 4) scale(2.1)" />
      <Building building="lab" faction="gen" transform="translate(5, 4) scale(2.1)" />
      <Building building="PI" faction="gen" transform="translate(17, 4) scale(2.1)" />
      <!-- Federation-token marker on the fed-structures tile: the federation hex (same asset the
           federation tokens use) pinned at the building cluster's bottom-center marks this as
           "federation structures", distinguishing it from the plain structures tile which shows
           the skyline alone. -->
      <image
        v-if="isFedStructure"
        class="fed-marker"
        xlink:href="../assets/conditions/federation.svg"
        :height="(739 / 636) * 20"
        width="20"
        x="-12"
        y="2"
        style="color: #247b0a"
      />
    </g>
    <!-- The PI↔Academy distance tile (Lost Fleet): a planetary institute and an academy linked by
         a double-headed distance arrow, so the icon says "far-apart PI and academy" rather than
         falling back to the unrelated sector glyph. -->
    <g v-else-if="isPiAcademyDistance" class="condition-icon" transform="translate(41, 29)">
      <Building building="PI" faction="gen" transform="translate(-21, 4) scale(1.9)" />
      <Building building="ac1" faction="gen" transform="translate(15, 4) scale(1.9)" />
      <!-- The arrow linking PI and academy, grouped so the whole thing moves with one translate.
           PI is taller than the academy, so center-to-center is a touch below y=4. -->
      <g transform="translate(0, 4)">
        <line class="pi-ac-arrow" x1="-8" y1="0" x2="5" y2="0" />
        <polygon class="pi-ac-arrowhead" points="-8,0 -3.5,-2.5 -3.5,2.5" />
        <polygon class="pi-ac-arrowhead" points="5,0 0.5,-2.5 0.5,2.5" />
      </g>
    </g>
    <!-- The planet-type wheel reads slightly right of center (its bright central sphere pulls the
         eye right), so the non-building icon group gets a small left nudge for that one condition. -->
    <g v-else class="condition-icon" :transform="`translate(${iconX}, 27) scale(1.5)`">
      <component :is="conditionComponent" v-bind="conditionProps" />
    </g>
    <!-- Each player's standing is a compact square indent in a dedicated bottom strip: a
         faction-colored square with the score in it, instead of a number stamped on a disc. -->
    <g
      v-for="(player, index) in players"
      :key="player.faction"
      :transform="`translate(${tokenX(index)}, ${tokenY(index)})`"
    >
      <rect class="score-indent" x="-7" y="-7" width="14" height="14" rx="3" :style="{ fill: indentColor(player) }" />
      <text class="score" :class="player.faction" x="0" y="0.5" :style="{ fill: scoreTextColor(player) }">{{
        progress(player)
      }}</text>
    </g>
    <circle
      v-for="(mode, index) in mapModeType"
      :key="mode.player.faction + '-circle'"
      :transform="`translate(${tokenX(index)}, ${tokenY(index)})`"
      class="button"
      role="button"
      @click="toggleMapMode(mode.type, mode.player)"
      r="9"
    />
  </g>
</template>

<script lang="ts">
import { Faction, finalScorings, FinalTile, Phase, Player } from "@gaia-project/engine";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import type { MapMode } from "../data/actions";
import { MapModeType } from "../data/actions";
import { factionName } from "../data/factions";
import { factionColor, factionLogTextColors } from "../graphics/utils";
import { tooltipTriggerConfig } from "../logic/tooltip";
import Building from "./Building.vue";
import Condition from "./Condition.vue";
import Token from "./Token.vue";

@Component<FinalScoringTile>({
  computed: {
    tooltip() {
      const players = this.players;

      // The tile shows no text title (the icon carries it), so lead the tooltip with the
      // spelled-out condition.
      const lines = players.map((pl) => {
        const name = pl.faction === "automa" ? "Automa" : factionName(pl.faction);
        const points = this.progress(pl);
        return `- ${name}: ${points}`;
      });
      return `${this.content}\n${lines.join("\n")}`;
    },

    highlighted() {
      return this.$store.state.data.phase === Phase.EndGame;
    },
  },

  components: {
    Token,
    Building,
    Condition,
  },
})
export default class FinalScoringTile extends Vue {
  @Prop()
  index: number;

  progress(player: Player) {
    return (player.faction as Faction | "automa") === "automa"
      ? finalScorings[this.tile].neutralPlayer
      : player.progress(this.tile);
  }

  /** The indent square's fill: the player's faction color (the automa neutral player reads as
   * the generic grey). */
  indentColor(player: Player): string {
    return (player.faction as Faction | "automa") === "automa" ? factionColor("gen") : factionColor(player.faction);
  }

  /** Score text color: black on the light faction colors (Gleens' yellow etc.) for legibility,
   * white on the dark ones - the same per-faction split the log uses. Automa (grey) reads white. */
  scoreTextColor(player: Player): string {
    if ((player.faction as Faction | "automa") === "automa") {
      return "#fff";
    }
    return factionLogTextColors[player.faction];
  }

  get tile(): FinalTile {
    return this.$store.state.data.tiles.scorings.final[this.index];
  }

  get mapModeType(): { type: MapModeType; player: Player }[] {
    const m = (type: MapModeType) =>
      this.players.filter((p) => p.faction != "automa").map((player) => ({ type, player }));
    switch (this.tile) {
      case FinalTile.Sector:
        return m(MapModeType.sectors);
      case FinalTile.StructureFed:
      case FinalTile.Satellite:
        return m(MapModeType.federations);
    }
    return [];
  }

  toggleMapMode(mode: MapModeType, player: Player) {
    this.$store.commit("toggleMapMode", { type: mode, player: player.player } as MapMode);
  }

  get content() {
    switch (this.tile) {
      case FinalTile.Structure:
        return "Structures";
      case FinalTile.StructureFed:
        return "Fed Structures";
      case FinalTile.PlanetType:
        return "Planet Types";
      case FinalTile.Gaia:
        return "Gaia";
      case FinalTile.Sector:
        return "Sectors";
      case FinalTile.Satellite:
        return "Satellites";
      case FinalTile.Asteroid:
        return "Asteroids";
      case FinalTile.PlanetaryInstituteAcademyDistance:
        return "PI→Academy distance";
      case FinalTile.DeepSpaceSector:
        return "Deep Space";
      default:
        // All FinalTile values are handled above; an unmapped tile is a bug.
        throw new Error(`No tooltip label defined for final scoring tile "${this.tile}"`);
    }
  }

  /** Which icon represents this scoring condition, reusing the round-scoring `Condition` glyph for
   * most (sector, planet type, gaia planet, asteroid, deep space) and a `Building` mine for the
   * "structures" tiles - all icons already used elsewhere in the UI, so the tile reads the same
   * language as the rest of the board. `fed`-based conditions (fed structures) show the federation
   * glyph; satellites show the satellite silhouette via a dedicated case in Condition. */
  /** Everything renders through `Condition` so the glyph uses the same, locally-defined icons as
   * the round scoring tiles. The "structures" tiles use the 'PA' condition - the overlapping
   * planetary-institute + academy cluster already used for the "big buildings" tech - which reads
   * as "buildings" far better than a single faint mine (and that icon's defs live in the same
   * SVG, so it always renders). */
  get conditionComponent(): any {
    return Condition;
  }

  /** Whether this tile's icon is a building cluster (structures tiles). Buildings are drawn larger
   * internally (Condition scales them up ~2.2×), so they need a smaller wrapper scale. */
  get isBuildingCondition(): boolean {
    return this.tile === FinalTile.Structure || this.tile === FinalTile.StructureFed;
  }

  /** The structureFed tile shares the building skyline with the plain structures tile but adds a
   * federation-token marker so it reads as "federation structures", not just "structures". */
  get isFedStructure(): boolean {
    return this.tile === FinalTile.StructureFed;
  }

  /** The non-building icon group's x-center: the planet-type wheel reads a touch right of center,
   * so it's nudged left; every other condition sits at the tile's horizontal center (38). */
  get iconX(): number {
    return this.tile === FinalTile.PlanetType ? 35 : 38;
  }

  get conditionProps(): Record<string, unknown> {
    switch (this.tile) {
      case FinalTile.Structure:
        return { condition: "PA" };
      case FinalTile.StructureFed:
        return { condition: "PA" };
      case FinalTile.PlanetType:
        return { condition: "pt" };
      case FinalTile.Gaia:
        return { condition: "g" };
      case FinalTile.Sector:
        return { condition: "s" };
      case FinalTile.Satellite:
        return { condition: "sat" };
      case FinalTile.Asteroid:
        return { condition: "ast" };
      case FinalTile.DeepSpaceSector:
        return { condition: "ds" };
      default:
        // All FinalTile values are handled above; an unmapped tile is a bug, not a sector.
        throw new Error(`No condition icon defined for final scoring tile "${this.tile}"`);
    }
  }

  /** Whether this tile shows the dedicated PI↔Academy distance icon (a planetary institute and an
   * academy linked by a distance arrow) rather than a generic condition glyph or the building
   * skyline. */
  get isPiAcademyDistance(): boolean {
    return this.tile === FinalTile.PlanetaryInstituteAcademyDistance;
  }

  get players() {
    const pls = this.$store.state.data.players.filter((player) => !!player && player.faction);

    if (this.$store.state.data.players.length === 2) {
      pls.push({ faction: "automa" });
    }

    return pls;
  }

  // Player indents run in a single row along the bottom of the (now taller) tile, under the
  // central icon.
  tokenX(index: number) {
    const n = this.players.length;
    const spacing = 17;
    const startX = 38 - ((n - 1) * spacing) / 2;
    return startX + index * spacing;
  }

  tokenY() {
    return 58;
  }

  tooltipTriggerConfig = tooltipTriggerConfig;

  // Exposed for the template's icon-scale ternary.
  Building = Building;
}
</script>

<style lang="scss">
g {
  &.finalScoringTile {
    .accent {
      fill: #3f4753;
      stroke: none;
    }

    // The white card sits up-left on the accent plate, leaving the plate visible as the tile's
    // bottom-right edge - the same panel language as the round scoring tiles.
    .body {
      fill: white;
      stroke: #333;
      stroke-width: 1px;
      transform: translate(-1.5px, -1.5px);
    }

    // The top-right "FIN" tab, matching the round tiles' "R#" plate (`.title` on ScoringTile).
    .fin-tab {
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 0.02em;
      text-anchor: end;
      pointer-events: none;
      fill: #212529;
    }

    // The condition glyph - kept monochrome-ish and small so it reads as an icon, not a second tile.
    .condition-icon {
      pointer-events: none;
    }

    // The structures cluster: the flat grey buildings get a dark edge so they read as solid
    // structures on the white card, not pale blobs.
    .structures-cluster .planet-fill {
      stroke: #333;
      stroke-width: 2;
    }

    // The PI↔Academy distance icon's double-headed arrow linking the two buildings.
    .pi-ac-arrow {
      stroke: #333;
      stroke-width: 1.4;
    }
    .pi-ac-arrowhead {
      fill: #333;
    }

    // The score sits in a small soft chip overlapping the bottom-right of the faction disc, so the
    // number is legible on any faction color without being stamped across the whole circle. A
    // translucent dark fill (no border) keeps it light on both light and dark boards.
    .score-pill {
      fill: rgba(33, 37, 41, 0.82);
      stroke: none;
      pointer-events: none;
    }

    .score {
      font-size: 8.5px;
      font-weight: bold;
      pointer-events: none;
      fill: #fff;
      text-anchor: middle;
      dominant-baseline: central;
    }

    line {
      stroke-width: 0.2;
      stroke: #111;
    }

    &.highlighted .body {
      stroke: var(--highlighted);
    }

    .player-token {
      stroke: #111;
      stroke-width: 1;
    }

    .button {
      opacity: 0;
    }
  }
}
</style>
