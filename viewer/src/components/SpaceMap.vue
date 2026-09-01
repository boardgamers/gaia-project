<template>
  <svg class="space-map-canvas" :viewBox="viewBox">
    <definitions />
    <g :transform="`rotate(${mapRotationDeg})`">
      <Sector
        v-for="center in this.sectors"
        :center="center"
        :key="`${center.q}x{center.r}`"
        :contentRotation="mapRotationDeg"
        :style="`transform: translate(${hexCenter(center).x * spread}px, ${hexCenter(center).y * spread}px) rotate(${
          rotation(center) * 60
        }deg);`"
      />
      <SpaceHex
        v-for="hex in looseHexes"
        :key="hex.toString()"
        :transform="`translate(${hexCenter(hex).x * spread}, ${hexCenter(hex).y * spread})`"
        :hex="hex"
        :isCenter="false"
        :contentRotation="mapRotationDeg"
      />
      <!-- Moweyds Power Rings, drawn as one layer on top of every hex rather than inside the hex
           that carries them. The ring is stroked ON the hex border, so half its width lies in the
           neighbouring cells: from inside a hex it survives only on the sides whose neighbours were
           painted earlier, and the sides painted later cut it down to half thickness (SVG has no
           z-index - paint order is document order). That is why a ring on a sector hex used to look
           lopsided while one on a loose hex - always drawn after every sector - looked right. Here
           every ring is painted last, so all six sides come out the same. -->
      <use
        v-for="ring in powerRings"
        :key="`power-ring-${ring.key}`"
        xlink:href="#space-hex"
        :class="['space-hex-power-ring', ring.planet]"
        :transform="ring.transform"
        pointer-events="none"
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
      >
        {{ label.id }}
      </text>
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
    <image
      v-if="showCharts"
      class="space-map__chart-button"
      xlink:href="../assets/other/line-chart.svg"
      :height="(155 / 211) * 22"
      width="22"
      x="-11"
      y="-8"
      v-b-modal.chart-button
      role="button"
      :transform="`translate(${bounds.right - 1.9}, ${bounds.top + 1.4}) scale(0.1)`"
    />
    <!-- Analysis mode's map-corner button (docs/lost-fleet/ANALYSIS_MODE_PLAN.md §5.4) - the
         bottom-right mirror of the chart icon above, same inset/scale convention, anchored to
         bounds.bottom instead of bounds.top. One button toggles both directions: Game.vue decides
         enter vs. exit from its own analysisMode state, so this component only ever has to say
         "the button was pressed." -->
    <g
      v-if="analysisOffered || analysisActive"
      class="space-map__analysis-button"
      :class="{ 'space-map__analysis-button--active': analysisActive }"
      role="button"
      :transform="`translate(${analysisButtonX(0)}, ${analysisButtonY}) scale(0.1)`"
      @click="$emit('analysis-toggle')"
    >
      <title>{{ analysisActive ? "Exit sandbox mode" : "Enter sandbox mode" }}</title>
      <rect class="space-map__analysis-badge" x="-11" y="-11" width="22" height="22" rx="4" />
      <use xlink:href="#analysis-calculator" transform="translate(-8.75, -8.75)" />
    </g>
    <!-- Undo / Reset for the sandbox line, in the same corner as the toggle above rather than in the
         striped header they used to live in (owner instruction) - so the three sandbox controls are
         one cluster instead of two, and editing the line no longer means leaving the board.
         Rendered AFTER the toggle deliberately: they sit to its LEFT (`analysisButtonX` counts right
         to left), but keeping the toggle first in document order means `.space-map__analysis-button`
         still resolves to it, as SpaceMap.spec.ts and anything else querying the corner expects.
         Kept on screen but inert while the line is empty, so the toggle never shifts position the
         moment the first move lands. -->
    <g
      v-for="(control, i) in analysisLineControls"
      :key="control.event"
      class="space-map__analysis-button space-map__analysis-button--active"
      :class="[control.class, { 'space-map__analysis-button--inert': !analysisCanEdit }]"
      role="button"
      :transform="`translate(${analysisButtonX(i + 1)}, ${analysisButtonY}) scale(0.1)`"
      @click="analysisCanEdit && $emit(control.event)"
    >
      <title>{{ control.title }}</title>
      <rect class="space-map__analysis-badge" x="-11" y="-11" width="22" height="22" rx="4" />
      <use :xlink:href="`#${control.icon}`" transform="translate(-8.75, -8.75)" />
    </g>
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
import Engine, {
  classifySectorId,
  Expansion,
  GaiaHex,
  hasExpansion,
  LostFleetSectorType,
  Planet,
  SpaceMap as SpaceMapData,
} from "@gaia-project/engine";
import { lostFleetTerraformingBoard } from "@gaia-project/engine/src/factions";
import { CubeCoordinates } from "hexagrid";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { MapMode, MapModeType } from "../data/actions";
import { HEX_SPREAD, hexCenter } from "../graphics/hex";
import { factionPiecePlanet } from "../graphics/utils";
import { gameSeed, isBeforeRound1 } from "../logic/utils";
import FactionWheel from "./FactionWheel.vue";
import Sector from "./Sector.vue";
import SpaceHex from "./SpaceHex.vue";
import Definitions from "./definitions/Definitions.vue";

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

// Local (pre-scale) content extents of FactionWheel.vue relative to its own (0,0) origin - the same
// footprint SpaceMap.spec.ts's wheel-clearance test measures against. Lost Fleet's Asteroid/
// Protoplanet column pushes the right edge to 6.1 (ring radius 3 + margin 2.1 + circle radius 1);
// the bottom keeps a small margin below the Gaia/Transdim row. Used by `wheelScale` to grow the
// rendered wheel until it just fills the frame's reserved top-left pocket without overlapping a hex.
const WHEEL_LOCAL = { left: -4, right: 6.1, top: -4, bottom: 7.6 };
// Matches the template's `translate(bounds.left + WHEEL_ANCHOR_OFFSET * ratio, ...)` origin offset.
const WHEEL_ANCHOR_OFFSET = 2.9;

// Rendered footprint of the top-right UI, relative to `bounds.right`: the Tinkeroids/Moweyds
// terraforming swatches (visible pre-round-1) are wider than the chart-history icon (visible once
// every seat has a faction) - the two are never both meant to be the binding constraint at once,
// so `bounds` just reserves whichever is currently on screen.
const RIGHT_SWATCH_WIDTH = 7.5;
const RIGHT_ICON_WIDTH = 3;
const RIGHT_BAND_HEIGHT = 2.5;

// Analysis mode's map-corner buttons (§5.4), anchored to bounds.bottom/bounds.right instead of
// bounds.top/bounds.right like the chart icon above - same footprint class as RIGHT_ICON_WIDTH
// (small square icons, never competing with anything else for this corner). The row grows leftwards
// from `bounds.right`: the sandbox toggle is always slot 0, and Undo/Reset take slots 1 and 2 while
// the sandbox is open.
const ANALYSIS_ICON_WIDTH = 3;
const ANALYSIS_ICON_INSET = 1.9;
const ANALYSIS_ICON_STEP = 2.6;
// How far up from `bounds.bottom` the row actually reaches: its centre line sits ANALYSIS_ICON_INSET
// up, and a badge is 22 units at scale 0.1, i.e. 1.1 above that. Anything shorter leaves a sliver of
// hexes that the clearance query below never sees but the icons still overlap - which only became
// visible once Undo/Reset widened the row enough to reach them.
const ANALYSIS_BAND_HEIGHT = ANALYSIS_ICON_INSET + 1.1;

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

/** Mirror of `bandMaxX` measuring from the BOTTOM edge instead of the top - the analysis-mode
 * button anchors to `bounds.bottom`, so its clearance check needs hexes near the bottom-right
 * corner, not the top-right one `bandMaxX` already covers. */
function bandMaxXFromBottom(points: Point[], bottom: number, height: number): number {
  let max = -Infinity;
  for (const p of points) {
    if (p.y >= bottom - height) {
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
  /** Analysis mode's map-corner button (§5.4) - both props default false so a caller that never
   * passes them (there is none left in this codebase, but the props aren't required) renders the
   * map exactly as it did before this button existed. `analysisOffered`/`analysisMode` are Game.vue's
   * own single source of truth (the latter's sealed-bid-round handling in particular) - deliberately
   * NOT re-derived here, to avoid a second copy of that logic drifting out of sync with the first. */
  @Prop({ default: false }) analysisOffered: boolean;
  @Prop({ default: false }) analysisActive: boolean;
  /** Whether the sandbox line currently holds anything to undo or clear - Game.vue's
   * `analysisEntries.length > 0`, i.e. exactly what gated the header buttons these replaced. */
  @Prop({ default: false }) analysisCanEdit: boolean;

  /** The sandbox line controls, in the order they occupy slots to the left of the toggle. Empty
   * unless the sandbox is actually open: they act on a line that does not exist otherwise, and the
   * corner would then reserve map width for two icons nobody can press. */
  get analysisLineControls(): { event: string; icon: string; title: string; class: string }[] {
    if (!this.analysisActive) {
      return [];
    }
    return [
      {
        event: "analysis-reset",
        icon: "analysis-reset",
        title: "Clear the whole sandbox line",
        class: "space-map__analysis-button--reset",
      },
      {
        event: "analysis-undo",
        icon: "analysis-undo",
        title: "Undo the last move in the sandbox line",
        class: "space-map__analysis-button--undo",
      },
    ];
  }

  /** x of the corner control in `slot`, counting right to left from the map's right edge - so the
   * toggle keeps the exact position it had before Undo/Reset joined it. */
  analysisButtonX(slot: number): number {
    return this.bounds.right - ANALYSIS_ICON_INSET - slot * ANALYSIS_ICON_STEP;
  }

  /** Shared y for the whole row, so it can never drift from the clearance ANALYSIS_BAND_HEIGHT
   * reserves for it. */
  get analysisButtonY(): number {
    return this.bounds.bottom - ANALYSIS_ICON_INSET;
  }

  hexCenter(hex: CubeCoordinates) {
    return hexCenter(hex);
  }

  /** Exposed for the template, which places sectors and loose hexes at the same 1% spread. */
  get spread(): number {
    return HEX_SPREAD;
  }

  /**
   * One entry per hex carrying a Moweyds Power Ring, positioned exactly the way the hex itself is:
   * a loose hex through the plain spread translate the template gives it, a sector hex through its
   * sector's `translate ... rotate ... translate` chain (the <Sector> placement above, then
   * Sector.vue's own per-hex `centerOffset`). A sector holds every hex within 2 of its center - the
   * radius-2 hexagon Sector.vue lists - so that is how a hex finds the sector drawing it.
   */
  get powerRings(): { key: string; transform: string; planet: Planet }[] {
    const rings: { key: string; transform: string; planet: Planet }[] = [];
    for (const hex of this.map.grid.values()) {
      const player = hex.data.powerRing;
      if (player === undefined || player === null) {
        continue;
      }
      rings.push({
        key: hex.toString(),
        transform: this.hexTransform(hex),
        planet: factionPiecePlanet(this.engine.player(player).faction),
      });
    }
    return rings;
  }

  /** Where `hex` ends up on screen, as an SVG transform in the rotated board's own coordinates. */
  private hexTransform(hex: GaiaHex): string {
    const spread = (point: Point) => `translate(${point.x * HEX_SPREAD}, ${point.y * HEX_SPREAD})`;
    if (classifySectorId(hex.data.sector) !== LostFleetSectorType.Space) {
      return spread(hexCenter(hex));
    }
    const center = this.sectors.find((sector) => this.map.distance(sector, hex) <= 2);
    if (!center) {
      return spread(hexCenter(hex));
    }
    const offset = hexCenter({ q: hex.q - center.q, r: hex.r - center.r });
    return `${spread(hexCenter(center))} rotate(${this.rotation(center) * 60}) translate(${offset.x}, ${offset.y})`;
  }

  get highlightedSectors(): CubeCoordinates[] {
    return this.$store.state.context.highlighted.sectors;
  }

  get sectors(): CubeCoordinates[] {
    return this.map.configuration().centers;
  }

  get looseHexes(): GaiaHex[] {
    return Array.from(this.map.grid.values())
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
    return Array.from(groups.entries()).map(([id, hexes]) => {
      const centers = hexes.map((h) => hexCenter(h));
      const x = (centers.reduce((sum, c) => sum + c.x, 0) / centers.length) * HEX_SPREAD;
      const y = (centers.reduce((sum, c) => sum + c.y, 0) / centers.length) * HEX_SPREAD;
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
    if (!this.isLostFleet || !isBeforeRound1(this.engine) || this.engine.players.every((player) => !!player.faction)) {
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
   * The left-gutter width the *frame* reserves for the wheel, expressed as a scale relative to
   * `WHEEL_SCALE_REFERENCE`. This is fixed per player count on purpose: it - not the rendered wheel
   * size - is what `bounds` uses to size (and, for 2p, symmetrically center) the map, so growing the
   * rendered wheel to fill its pocket (see `wheelScale`) never shifts or shrinks the map. 2p Lost
   * Fleet reserves a smaller gutter (0.4) because its board is fully 6-fold symmetric (see
   * `mapRotationDeg`) - any left gutter is mirrored to the right, so an oversized reserve would eat
   * into the whole board's scale. 3p/4p's diagonal rotation opens a natural wheel-sized pocket at the
   * reference scale, so they reserve the full reference gutter.
   */
  get wheelReserveScale(): number {
    return this.isLostFleet && this.engine.players.length === 2 ? 0.4 : WHEEL_SCALE_REFERENCE;
  }

  get wheelReserveRatio(): number {
    return this.wheelReserveScale / WHEEL_SCALE_REFERENCE;
  }

  /**
   * The wheel's actual render scale: the largest scale whose rendered footprint (WHEEL_LOCAL,
   * anchored exactly as the template places it) still fits inside the frame's reserved top-left
   * pocket without overlapping any hex (each inflated by its own 1-unit radius) or spilling past the
   * frame. This keeps the color wheel "as big as possible" for every board while leaving the
   * centered, same-size map (driven by `wheelReserveScale`, not this) completely untouched - the
   * wheel just fills whatever slack the fixed reservation left over. Never returns less than
   * `wheelReserveScale`, which fits by construction.
   */
  get wheelScale(): number {
    if (!this.isLostFleet) {
      return WHEEL_SCALE_REFERENCE;
    }
    const b = this.bounds;
    const points = this.rotatedPoints;
    const reserve = this.wheelReserveScale;
    if (points.length === 0) {
      return reserve;
    }
    const fits = (s: number): boolean => {
      const anchor = WHEEL_ANCHOR_OFFSET * (s / WHEEL_SCALE_REFERENCE);
      const left = b.left + anchor + WHEEL_LOCAL.left * s;
      const right = b.left + anchor + WHEEL_LOCAL.right * s;
      const top = b.top + anchor + WHEEL_LOCAL.top * s;
      const bottom = b.top + anchor + WHEEL_LOCAL.bottom * s;
      if (right > b.right || bottom > b.bottom) {
        return false;
      }
      for (const p of points) {
        if (p.x + 1 > left && p.x - 1 < right && p.y + 1 > top && p.y - 1 < bottom) {
          return false;
        }
      }
      return true;
    };
    if (!fits(reserve)) {
      return reserve;
    }
    let lo = reserve;
    let hi = 1.2;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return lo;
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
    // The compact 2p Lost Fleet board can safely use a slimmer horizontal frame. Together with its
    // slightly smaller wheel, this recovers enough scale for the map to stay at least as large after
    // adding the requested mobile page gutter.
    const horizontalHexPad = this.isLostFleet && this.engine.players.length === 2 ? 1.15 : 1.3;
    const verticalHexPad = 1.3;
    const tightLeft = minX - horizontalHexPad;
    const tightRight = maxX + horizontalHexPad;
    const top = minY - verticalHexPad;
    const bottom = maxY + verticalHexPad;

    // A hex's own edge sits `hexRadius` (1 unit) away from its center in every direction, so (a)
    // a hex just below a band's cutoff can still poke its top edge up into that band - query the
    // band with its height extended by hexRadius to catch those - and (b) once a band-relevant
    // hex's x is found, the content's near edge must clear that hex's OWN edge (bandX -+ radius),
    // plus a small extra CLEARANCE margin, not just clear the hex's bare center.
    const hexRadius = 1;

    const wheelWidth = (this.isLostFleet ? WHEEL_WIDTH_LOST_FLEET : WHEEL_WIDTH_BASE) * this.wheelReserveRatio;
    const wheelHeight = WHEEL_HEIGHT * this.wheelReserveRatio;
    const legendCount = this.colorLegend.length;
    const legendBottom =
      legendCount > 0 ? LEGEND_TOP_OFFSET + (legendCount - 1) * LEGEND_ITEM_HEIGHT + LEGEND_ITEM_SIZE : 0;
    const leftBandHeight = Math.max(wheelHeight, legendBottom);
    const leftLimit = bandMinX(points, top, leftBandHeight + hexRadius) - hexRadius - CLEARANCE - wheelWidth;
    const left = Math.min(tightLeft, leftLimit);

    const rightWidth = this.terraformingColors.length > 0 ? RIGHT_SWATCH_WIDTH : this.showCharts ? RIGHT_ICON_WIDTH : 0;
    const rightLimitTop = bandMaxX(points, top, RIGHT_BAND_HEIGHT + hexRadius) + hexRadius + CLEARANCE + rightWidth;

    // Analysis mode's map-corner button (§5.4) - a second, independent right-edge constraint from
    // the BOTTOM band, since it sits in the opposite corner from the chart icon/swatches above and
    // the two bands never overlap for any board shape this game has.
    const showAnalysisButton = this.analysisOffered || this.analysisActive;
    const rightLimitBottom = showAnalysisButton
      ? bandMaxXFromBottom(points, bottom, ANALYSIS_BAND_HEIGHT + hexRadius) +
        hexRadius +
        CLEARANCE +
        ANALYSIS_ICON_WIDTH +
        this.analysisLineControls.length * ANALYSIS_ICON_STEP
      : -Infinity;

    const right = Math.max(tightRight, rightWidth > 0 ? rightLimitTop : tightRight, rightLimitBottom);

    if (this.isLostFleet && this.engine.players.length === 2) {
      // The 2p hex field is symmetric around x=0. Frame the wheel/UI constraints symmetrically too,
      // so the board stays visually centered instead of carrying a one-sided wheel gutter.
      const halfWidth = Math.max(Math.abs(left), Math.abs(right));
      return { left: -halfWidth, top, right: halfWidth, bottom };
    }

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
      return Array.from({ length: 5 }, (_, i) => ({ class: `power${i + 1}`, text: String(i + 1) }));
    }
    return [];
  }
}
</script>

<style lang="scss">
.line-chart-icon {
  fill: currentColor;
  stroke: none;
}

// The Power Ring overlay (see the template) - styled here rather than in SpaceHex.vue because that
// is where the elements now live. Stroked on the hex border itself, so it reads as the hex's own
// glowing rim instead of a second, smaller hexagon inside a planet.
.space-hex-power-ring {
  fill: none;
  stroke-width: 0.2;
  pointer-events: none;
  opacity: 0.98;
  filter: drop-shadow(0 0 0.18px rgba(255, 255, 255, 0.55));

  &.a {
    stroke: var(--asteroid);
  }

  &.p {
    stroke: var(--protoplanet);
  }

  &:not(.a):not(.p) {
    stroke: #f7d35c;
  }
}

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
