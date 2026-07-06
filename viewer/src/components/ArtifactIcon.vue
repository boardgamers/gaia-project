<template>
  <svg viewBox="-13 -13 26 26" :width="size" :height="size" style="overflow: visible">
    <!-- .click alongside .hover: on real touch devices, a first tap doesn't always synthesize the
         mouseenter that .hover-only tooltips rely on (a well-known WebKit/mobile quirk - see
         launcher.ts's touchstart-arm workaround for the general case), and this artifact icon is
         commonly the very first thing a player taps in a session, before that workaround has a
         chance to help. A real click/tap always fires, so it's a hover-independent guarantee. -->
    <g class="lost-fleet-ship__artifact" v-b-tooltip.hover.click :title="tooltip">
      <circle r="12" class="lost-fleet-ship__artifact-bg" />
      <g transform="scale(0.55)">
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
 * strip (LostFleetShips.vue) and as an icon-only button (RichTextView.vue's "artifactToken" case). */
@Component({
  components: { Condition, Resource },
})
export default class ArtifactIcon extends Vue {
  @Prop()
  artifact: ArtifactToken;

  @Prop({ default: 30 })
  size: number;

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
  .lost-fleet-ship__artifact-bg {
    fill: #efe6c4;
    stroke: #d8c57c;
    stroke-width: 1;
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
