<template>
  <svg :viewBox="viewBox" :width="width" :height="size" style="overflow: visible">
    <!-- .click only, no .hover: a hover trigger races its own show/hide against the global
         "close whatever tooltip is open" click handler in launcher.ts (see that file's comment),
         which is what caused tooltips to flash-and-vanish or get left open after tapping
         elsewhere. .click is also hover-independent by construction, so it works identically on
         touch and mouse (no first-tap-swallowed quirk to guard against). -->
    <g class="lost-fleet-ship__artifact" v-b-tooltip.click :title="tooltip">
      <!-- Gold sunburst ring: a thick gold band (outer ellipse) with white radial "rays" drawn over
           it, then a white oval center on top so the rays only read on the band - an inset sunburst
           just in the border. The whole token is an oval (wider than tall) that fills its slot. -->
      <ellipse :rx="rxOut" :ry="ryOut" class="lost-fleet-ship__artifact-gold" />
      <line
        v-for="(ray, r) in rays"
        :key="'ray' + r"
        :x1="ray.x1"
        :y1="ray.y1"
        :x2="ray.x2"
        :y2="ray.y2"
        class="lost-fleet-ship__artifact-ray"
      />
      <ellipse :rx="rxIn" :ry="ryIn" class="lost-fleet-ship__artifact-center" />
      <!-- The iconography, scaled to fit the inner oval, then shifted up by `contentOffsetY` so the
           tokens whose art hangs low (a condition or planet drawn below the reward) sit centered in
           the (short) oval instead of bleeding past its bottom edge. -->
      <g :transform="`scale(${iconScale}) translate(0, ${contentOffsetY})`">
        <!-- x=-15 used to put the "+" past the artifact circle's own left edge (measured via a real
             render: text center -15 with a ~16-wide glyph spans to -23, past the circle's -21.8
             boundary in this same pre-scale coordinate system) and left a large gap before the
             reward icons at translate(9, ...) - moved to -10 (and the icons in from 9 to 8) so both
             sit with a small even gap, comfortably inside the circle on both sides. -->
        <text v-if="display.ongoingIncome" class="lost-fleet-ship__artifact-plus" x="-10" y="0">+</text>
        <Resource
          v-for="(reward, j) in display.rewards"
          :key="j"
          :kind="reward.type"
          :count="reward.count"
          :transform="
            display.ongoingIncome
              ? `translate(8, ${(j - (display.rewards.length - 1) / 2) * 20})`
              : `translate(${(j - (display.rewards.length - 1) / 2) * 20}, ${
                  display.condition || display.planet ? -7 : 0
                })`
          "
        />
        <Condition
          v-if="display.condition"
          :condition="display.condition"
          :color="trackColor"
          transform="translate(0, 10) scale(0.8)"
        />
        <!-- "3" badge for the ResearchTracks token ("3 VP for each Research Area at level 3 or
             higher") - sits on the second row, just right of the advance-research track icon. -->
        <text v-if="display.minLevel" v-text="display.minLevel" class="lost-fleet-ship__artifact-level" x="14" y="10" />
        <circle v-if="display.planet" r="6" :class="['planet-fill', display.planet]" transform="translate(0, 11)" />
      </g>
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { ArtifactToken, Condition as ConditionEnum, Planet, Reward, ResearchField } from "@gaia-project/engine";
import { artifactTokenSpec } from "@gaia-project/engine/src/tiles/artifacts";
import { artifactDisplay } from "../data/artifacts";
import Condition from "./Condition.vue";
import Resource from "./Resource.vue";

/** A single Artifact token, rendered as a self-contained icon - reused on the Twilight ship board
 * strip (LostFleetShips.vue) and as an icon-only button (RichTextView.vue's "artifactToken" case).
 *
 * It's an oval (wider than tall): the `size` prop is the height, and the width is derived from it
 * via the viewBox's aspect ratio, so a caller only ever picks one number. The border is a thick
 * gold band with white radial rays (an inset sunburst) and the center is white. */
@Component({
  components: { Condition, Resource },
})
export default class ArtifactIcon extends Vue {
  @Prop()
  artifact: ArtifactToken;

  // Height of the icon; width is derived from it (the token is an oval, wider than tall).
  @Prop({ default: 30 })
  size: number;

  // The oval's geometry, in the SVG's own (viewBox) coordinate system. The viewBox is 33 wide by
  // 25 tall, centered on the origin, so the token renders ~1.32x as wide as it is tall - a wider
  // oval than a circle, but narrow enough that two columns clear the Federation tile on the left
  // and the card's right edge on the right.
  readonly rxOut = 16;
  readonly ryOut = 12;
  readonly rxIn = 13.9;
  readonly ryIn = 10.9;
  readonly iconScale = 0.6;

  get viewBox(): string {
    return "-16.5 -12.5 33 25";
  }

  /** Rendered width (px). The token is an oval; height is `size`, width follows the 33:25 viewBox. */
  get width(): number {
    return Math.round((this.size * 33) / 25);
  }

  /** Upward shift (in pre-scale content units) that re-centers bottom-heavy tokens in the oval:
   * tokens with a condition icon below the reward hang lowest, planet tokens a little less, and
   * plain reward / ongoing-income tokens are already vertically balanced. Keeps the tallest art
   * (the deep-space condition, reaching ~y20 pre-scale) inside the oval's short vertical axis. */
  get contentOffsetY(): number {
    if (this.display.condition && !this.display.ongoingIncome) {
      return -2.5;
    }
    if (this.display.planet) {
      return -1.5;
    }
    return 0;
  }

  /** White radial rays drawn over the gold band - each runs from the white center's edge out to the
   * outer edge, so it only shows on the border. Evenly spaced around the oval for a sunburst. */
  get rays(): Array<{ x1: number; y1: number; x2: number; y2: number }> {
    const count = 22;
    const rays = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      rays.push({
        x1: +(this.rxIn * cos).toFixed(2),
        y1: +(this.ryIn * sin).toFixed(2),
        x2: +(this.rxOut * cos).toFixed(2),
        y2: +(this.ryOut * sin).toFixed(2),
      });
    }
    return rays;
  }

  get display(): { rewards: Reward[]; condition?: ConditionEnum; planet?: Planet; track?: ResearchField } {
    return artifactDisplay(this.artifact);
  }

  // Distinguishes this artifact from ArtifactToken.ResearchTracks, which shares the same reward/
  // condition icon but isn't tied to one specific track.
  get trackColor(): string | null {
    return this.display.track ? `var(--rt-${this.display.track})` : null;
  }

  get tooltip(): string {
    return artifactTokenSpec[this.artifact];
  }
}
</script>

<style lang="scss">
g.lost-fleet-ship__artifact {
  // The thick gold border band. A radial gradient (light gold in, deeper gold out) gives it depth;
  // the white rays and white center oval are drawn on top of it.
  .lost-fleet-ship__artifact-gold {
    fill: #e8b73a;
    stroke: #a9781a;
    stroke-width: 0.8;
  }

  // White "sun ray" stripes across the gold band.
  .lost-fleet-ship__artifact-ray {
    stroke: #fffdf3;
    stroke-width: 1.3;
    stroke-linecap: round;
    opacity: 0.9;
  }

  // The white oval center the iconography sits on.
  .lost-fleet-ship__artifact-center {
    fill: #ffffff;
    stroke: #d8c57c;
    stroke-width: 0.6;
  }

  // The "3" level badge (ResearchTracks token), sitting beside the track icon on the lower row.
  .lost-fleet-ship__artifact-level {
    font-size: 11px;
    font-weight: 800;
    fill: #17161a;
    stroke: #fff;
    stroke-width: 1.4px;
    paint-order: stroke;
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
  }

  // Same "+" income marker as TechContent.vue's ongoing-income tech tiles (e.g. Tech6's "+k,c"),
  // scaled down to this icon's own coordinate system.
  .lost-fleet-ship__artifact-plus {
    font-size: 20px;
    font-weight: bold;
    fill: white;
    stroke: black;
    stroke-width: 0.7px;
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
  }
}
</style>
