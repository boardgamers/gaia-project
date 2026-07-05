<template>
  <svg :viewBox="viewBox">
    <definitions />
    <g :transform="`rotate(${mapRotationDeg})`">
      <Sector
        v-for="center in this.sectors"
        :center="center"
        :key="`${center.q}x{center.r}`"
        :contentRotation="mapRotationDeg"
        :style="`transform: translate(${hexCenter(center).x * 1.01}px, ${hexCenter(center).y * 1.01}px) rotate(${
          rotation(center) * 60
        }deg);`"
      />
      <SpaceHex
        v-for="hex in looseHexes"
        :key="hex.toString()"
        :transform="`translate(${hexCenter(hex).x * 1.01}, ${hexCenter(hex).y * 1.01})`"
        :hex="hex"
        :isCenter="false"
        :contentRotation="mapRotationDeg"
      />
      <text
        v-for="label in deepSpaceLabels"
        :key="`ds-${label.id}`"
        class="sector-name"
        data-sector-type="deep-space"
        :transform="`translate(${label.x}, ${label.y}) rotate(${-mapRotationDeg})`"
        x="0"
        y="0"
        dy="0.35"
      >{{ label.id }}</text>
      <circle
        v-for="(s, i) in highlightedSectors"
        :key="i"
        r="1"
        :style="`fill: ${i === 0 ? 'red' : 'back'}; transform: translate(${hexCenter(s).x * 1.01}px, ${
          hexCenter(s).y * 1.01
        }px)`"
      />
    </g>
    <FactionWheel
      class="faction-wheel"
      :transform="`translate(${bounds.left + 2.9 * wheelScaleRatio}, ${
        bounds.top + 2.9 * wheelScaleRatio
      }) scale(${wheelScale})`"
    />
    <image v-if="showCharts" xlink:href="../assets/other/line-chart.svg" :height=155/211*22 width="22" x="-11" y="-8"
    v-b-modal.chart-button role="button" :transform="`translate(${bounds.right - 1.9}, ${bounds.top + 1.4}) scale(0.1)`"
    />
    <rect
      v-for="(planet, i) in terraformingColors"
      :key="planet"
      :class="['lost-fleet-terraform-swatch', 'planet-fill', planet]"
      width="0.9"
      height="0.9"
      :x="bounds.right - 7.5 + i * 1.05"
      :y="bounds.top + 0.3"
      v-b-tooltip.hover
      :title="`Terraforming board color ${i + 1}`"
      stroke="#1a1a1a"
      stroke-width="0.07"
    />
    <g
      v-for="(color, i) in colorLegend"
      :key="i"
      :transform="`translate(${bounds.left + 0.6}, ${bounds.top + 8 + 2 * i}) scale(.8)`"
    >
      <rect width="2" height="2" class="color-legend leech" :class="color.class" />
      <text class="color-legend" transform="translate(1, 1.55)">{{ color.text }}</text>
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component } from "vue-property-decorator";
import Engine, {
  Expansion,
  classifySectorId,
  GaiaHex,
  LostFleetSectorType,
  hasExpansion,
  Planet,
  SpaceMap as SpaceMapData,
} from "@gaia-project/engine";
import { lostFleetTerraformingBoard } from "@gaia-project/engine/src/factions";
import { hexCenter } from "../graphics/hex";
import { gameSeed, isBeforeRound1 } from "../logic/utils";
import Sector from "./Sector.vue";
import { CubeCoordinates } from "hexagrid";
import FactionWheel from "./FactionWheel.vue";
import Definitions from "./definitions/Definitions.vue";
import { MapMode, MapModeType } from "../data/actions";
import SpaceHex from "./SpaceHex.vue";

type Point = { x: number; y: number };

// Rendered (post scale(0.65)) footprint of FactionWheel.vue's content, relative to its own
// translate anchor: the 7-planet ring is the dominant width contributor in the base game (local x
// in [-2.93, 2.93], +1 for the planet circles' own radius) and drives WHEEL_WIDTH_BASE. In Lost
// Fleet, Asteroid/Protoplanet sit in their own column to the right of the ring instead of a 3rd/4th
// slot below it (FactionWheel.vue's extraPlanetSlots): that column reaches local x = ring radius
// (3) + margin (2.1) + its own circle radius (1) = 6.1, wider than the base ring, so Lost Fleet
// needs its own, larger WHEEL_WIDTH_LOST_FLEET. Height is still ring-vs-below-wheel-row dominated
// either way. See SpaceMap.spec.ts's "keeps the wheel ... in the left sidebar" test for the
// derivation. Both scale linearly with `wheelScale` below (measured at the reference scale 0.65).
const WHEEL_SCALE_REFERENCE = 0.65;
const WHEEL_WIDTH_BASE = 5.5;
const WHEEL_WIDTH_LOST_FLEET = 7;
const WHEEL_HEIGHT = 7.9;

// Rendered footprint of the top-right UI, relative to `bounds.right`: the Tinkeroids/Moweyds
// terraforming swatches (visible pre-round-1) are wider than the chart-history icon (visible once
// every seat has a faction) - the two are never both meant to be the binding constraint at once,
// so `bounds` just reserves whichever is currently on screen.
const RIGHT_SWATCH_WIDTH = 7.5;
const RIGHT_ICON_WIDTH = 3;
const RIGHT_BAND_HEIGHT = 2.5;

// Small safety gap kept between a hex's own edge (radius 1) and the nearest UI content edge, on
// top of the content's own measured footprint.
const CLEARANCE = 0.3;

// translate() offset used by the color-legend template loop, plus its own per-item rendered size
// (a 2x2 rect at scale(.8)).
const LEGEND_TOP_OFFSET = 8;
const LEGEND_ITEM_HEIGHT = 2;
const LEGEND_ITEM_SIZE = 1.6;

/** The largest x among points whose y falls within [top, top + height], i.e. how far right hexes
 * reach into the given top band - the constraint on how much left-side room is actually free. */
function bandMinX(points: Point[], top: number, height: number): number {
  let min = Infinity;
  for (const p of points) {
    if (p.y <= top + height) {
      min = Math.min(min, p.x);
    }
  }
  return min;
}

/** Mirror of `bandMinX` for the right side. */
function bandMaxX(points: Point[], top: number, height: number): number {
  let max = -Infinity;
  for (const p of points) {
    if (p.y <= top + height) {
      max = Math.max(max, p.x);
    }
  }
  return max;
}

@Component<SpaceMap>({
  components: {
    FactionWheel,
    Definitions,
    Sector,
    SpaceHex,
  },
})
export default class SpaceMap extends Vue {
  hexCenter(hex: CubeCoordinates) {
    return hexCenter(hex);
  }

  get highlightedSectors(): CubeCoordinates[] {
    return this.$store.state.context.highlighted.sectors;
  }

  get sectors(): CubeCoordinates[] {
    return this.map.configuration().centers;
  }

  get looseHexes(): GaiaHex[] {
    return [...this.map.grid.values()]
      .filter((hex) => classifySectorId(hex.data.sector) !== LostFleetSectorType.Space)
      .sort((a, b) => a.q - b.q || a.r - b.r || a.s - b.s);
  }

  /**
   * One label per physical Deep Space tile (3 mutually-adjacent hexes sharing a `DS<id>_<0-2>`
   * sector id), centered on the centroid of its 3 hexes rather than pinned to one of them - a
   * single hex within the tile can hold a planet, and the old per-hex badge (anchored to hex 0)
   * sat right on top of it. Styled via the same `.sector-name` class as the big Space-sector
   * numbers (task: "match sector label styling"), not the small badge font.
   */
  get deepSpaceLabels(): { id: string; x: number; y: number }[] {
    const groups = new Map<string, GaiaHex[]>();
    for (const hex of this.looseHexes) {
      if (classifySectorId(hex.data.sector) === LostFleetSectorType.DeepSpace) {
        const id = hex.data.sector.split("_")[0].replace(/^DS/, "");
        const list = groups.get(id);
        if (list) {
          list.push(hex);
        } else {
          groups.set(id, [hex]);
        }
      }
    }
    return [...groups.entries()].map(([id, hexes]) => {
      const centers = hexes.map((h) => hexCenter(h));
      const x = (centers.reduce((sum, c) => sum + c.x, 0) / centers.length) * 1.01;
      const y = (centers.reduce((sum, c) => sum + c.y, 0) / centers.length) * 1.01;
      return { id, x, y };
    });
  }

  rotation(center: CubeCoordinates) {
    return this.$store.state.context.rotation.get(`${center.q}x${center.r}`) || 0;
  }

  get engine(): Engine {
    return this.$store.state.data;
  }

  get showCharts(): boolean {
    return !this.engine.players.some((p) => !p.faction);
  }

  get map(): SpaceMapData {
    return this.engine.map;
  }

  get isLostFleet(): boolean {
    return hasExpansion(this.engine.expansions, Expansion.LostFleet);
  }

  /**
   * The Tinkeroids/Moweyds shared terraforming-color row (RULES_CLARIFICATIONS.md §B5), shown as 7
   * plain bordered squares in the map's top-right corner, visible only through round-1 setup
   * (initial mine/ship placement) - once round 1 actually begins, the terraforming board has done
   * its job (every relevant player's cost-3 colors are locked onto their own faction board) and
   * these squares would just be redundant map clutter for the rest of the game. The setup-preview
   * screen's own scratch engine never advances past round 0 (see `isBeforeRound1`'s doc comment),
   * so the squares stay visible there unconditionally.
   */
  get terraformingColors(): Planet[] {
    if (!this.isLostFleet || !isBeforeRound1(this.engine)) {
      return [];
    }
    const seed = gameSeed(this.engine);
    return seed ? lostFleetTerraformingBoard(seed) : [];
  }

  /**
   * Whole-board rotation (hex-grid-aligned, i.e. a multiple of 60deg so every hex/sector still
   * looks "upright" like a physically-rotated tile - same visual language as the existing
   * per-sector rotation), chosen per player count so the board's longest diagonal runs from the
   * bottom-left to the top-right of the rendered viewBox, instead of minimizing raw bounding-box
   * width (the previous approach, which actually made the reserved wheel gutter WORSE - see
   * below). Measured once against the fixed (seed-independent) Lost Fleet sector-center + loose-hex
   * layout for each player count (`engine/map-geom-tmp.ts`-style brute-force diagonal + per-rotation
   * bbox check, not guessed): 3p's longest diagonal is closest to that 45deg orientation at 0deg
   * (was wrongly rotated 120deg before, which is ~38deg further off); 4p's is closest at 60deg (was
   * 0deg before, ~53deg further off). 2p's board is exactly 6-fold symmetric (identical bbox at
   * every rotation), so 60deg is a free improvement in diagonal alignment with no width/height cost
   * either way.
   *
   * This pays off beyond just the diagonal look: `bounds()` below only widens the viewBox past the
   * tight hex bbox when the wheel doesn't already fit in the naturally-empty top-left corner. Under
   * the old rotations, 3p/4p had NO such corner (diagonal ran closer to vertical), so the wheel
   * forced a full extra ~5.5-unit gutter down the entire left edge - which read as a permanent
   * reserved column since the wheel itself only occupies the top few units of that band. Under these
   * rotations, the diagonal orientation opens up a real top-left pocket that's already
   * wheel-sized, so that gutter drops to 0 and the final viewBox is smaller in BOTH dimensions than
   * before, despite the raw (unpadded) hex bounding box being nominally wider. 2p has no such corner
   * at any rotation (it's the compact, fully-symmetric board) and keeps the same fixed gutter as
   * before - not a regression, just nothing to exploit there.
   */
  get mapRotationDeg(): number {
    if (!this.isLostFleet) {
      return 0;
    }
    return this.engine.players.length === 3 ? 0 : 60;
  }

  /**
   * FactionWheel's render scale, relative to `WHEEL_SCALE_REFERENCE` (the scale the WHEEL_WIDTH/
   * WHEEL_HEIGHT footprint constants were measured at). 2p Lost Fleet has no rotation that opens a
   * natural top-left pocket (see `mapRotationDeg`'s doc comment - its board is fully 6-fold
   * symmetric, identical bbox at every 60deg rotation), so at the reference scale it always pays
   * the wheel's full ~5.5-unit gutter. Shrinking the wheel to 0.45 there (measured: `engine`-side
   * brute-force search over candidate scales, see the map-rotation investigation) cuts that gutter
   * to ~0.8 units - a 69%-size wheel in exchange for eliminating the vast majority of the reserved
   * column - without needing a rotation change 3p/4p already get for free. 3p/4p keep the reference
   * scale since their diagonal rotation already opens a wheel-sized pocket at full size.
   */
  get wheelScale(): number {
    if (this.isLostFleet && this.engine.players.length === 2) {
      return 0.45;
    }
    return WHEEL_SCALE_REFERENCE;
  }

  get wheelScaleRatio(): number {
    return this.wheelScale / WHEEL_SCALE_REFERENCE;
  }

  /**
   * Bounding box of every hex on the board (in rendered units, i.e. hexCenter * 1.01 like the
   * template's transforms, rotated by mapRotationDeg to match what's actually rendered), padded by
   * one hex radius, plus just enough extra room on the left (faction wheel + color legend) and
   * right (terraforming swatches / chart icon) for that UI to avoid overlapping hexes.
   *
   * This replaces a flat, always-on 5.6-unit left sidebar that reserved the same width for the
   * map's entire height, even though the wheel only occupies the top corner - on the taller Lost
   * Fleet 3p/4p layouts that wasted real width the map could otherwise fill (task: "map has too
   * much reserved white space"). Combined with `mapRotationDeg`'s diagonal-alignment rotation
   * (which opens a wheel-sized natural pocket for 3p/4p) and `wheelScale`'s smaller wheel for 2p
   * (which has no such pocket at any rotation), this band-limited reservation now sits close to 0
   * for every player count instead of a flat ~5.5 units.
   */
  /** Every hex center, rotated by `mapRotationDeg` to match what's actually rendered - used by
   * `bounds` so hex positions agree with what's actually on screen. */
  get rotatedPoints(): Point[] {
    const rad = (this.mapRotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const points: Point[] = [];
    for (const hex of this.map.grid.values()) {
      const c = hexCenter(hex);
      points.push({ x: (c.x * cos - c.y * sin) * 1.01, y: (c.x * sin + c.y * cos) * 1.01 });
    }
    return points;
  }

  get bounds(): { left: number; top: number; right: number; bottom: number } {
    const points = this.rotatedPoints;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    if (minX > maxX) {
      // no hexes (e.g. map not generated yet) - keep the old base-game frame
      return { left: -13, top: -11.5, right: 13, bottom: 12.5 };
    }
    const hexPad = 1.3;
    const tightLeft = minX - hexPad;
    const tightRight = maxX + hexPad;
    const top = minY - hexPad;
    const bottom = maxY + hexPad;

    // A hex's own edge sits `hexRadius` (1 unit) away from its center in every direction, so (a)
    // a hex just below a band's cutoff can still poke its top edge up into that band - query the
    // band with its height extended by hexRadius to catch those - and (b) once a band-relevant
    // hex's x is found, the content's near edge must clear that hex's OWN edge (bandX -+ radius),
    // plus a small extra CLEARANCE margin, not just clear the hex's bare center.
    const hexRadius = 1;

    const wheelWidth = (this.isLostFleet ? WHEEL_WIDTH_LOST_FLEET : WHEEL_WIDTH_BASE) * this.wheelScaleRatio;
    const wheelHeight = WHEEL_HEIGHT * this.wheelScaleRatio;
    const legendCount = this.colorLegend.length;
    const legendBottom = legendCount > 0 ? LEGEND_TOP_OFFSET + (legendCount - 1) * LEGEND_ITEM_HEIGHT + LEGEND_ITEM_SIZE : 0;
    const leftBandHeight = Math.max(wheelHeight, legendBottom);
    const leftLimit = bandMinX(points, top, leftBandHeight + hexRadius) - hexRadius - CLEARANCE - wheelWidth;
    const left = Math.min(tightLeft, leftLimit);

    const rightWidth = this.terraformingColors.length > 0 ? RIGHT_SWATCH_WIDTH : this.showCharts ? RIGHT_ICON_WIDTH : 0;
    const rightLimitTop = bandMaxX(points, top, RIGHT_BAND_HEIGHT + hexRadius) + hexRadius + CLEARANCE + rightWidth;
    const right = rightWidth > 0 ? Math.max(tightRight, rightLimitTop) : tightRight;

    return { left, top, right, bottom };
  }

  get viewBox(): string {
    const b = this.bounds;
    return `${b.left} ${b.top} ${b.right - b.left} ${b.bottom - b.top}`;
  }

  get mapModes(): MapMode[] {
    return this.$store.getters.mapModes;
  }

  get colorLegend(): { class: string; text: string }[] {
    if (this.mapModes.find((m) => m.type === MapModeType.leech || m.type == MapModeType.federations)) {
      return [...Array(5).keys()].map((i) => ({ class: `power${i + 1}`, text: String(i + 1) }));
    }
    return [];
  }
}
</script>

<style lang="scss">
.color-legend {
  stroke: black;
  stroke-width: 0.1px;
  font-size: 1.5px;
  text-anchor: middle;
}
text.color-legend {
  fill: white;
  stroke: white;
}
</style>
