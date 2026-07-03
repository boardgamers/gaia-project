<template>
  <svg viewBox="-13 -13 26 26" width="30" height="30" style="overflow: visible">
    <g class="lost-fleet-ship__artifact" v-b-tooltip :title="tooltip">
      <circle r="12" class="lost-fleet-ship__artifact-bg" />
      <g transform="scale(0.55)">
        <Resource
          v-for="(reward, j) in display.rewards"
          :key="j"
          :kind="reward.type"
          :count="reward.count"
          :transform="`translate(${(j - (display.rewards.length - 1) / 2) * 20}, ${
            display.condition || display.planet ? -7 : 0
          })`"
        />
        <Condition v-if="display.condition" :condition="display.condition" transform="translate(0, 10) scale(0.8)" />
        <circle v-if="display.planet" r="6" :class="['planet-fill', display.planet]" transform="translate(0, 11)" />
      </g>
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { ArtifactToken, Condition as ConditionEnum, Planet, Reward } from "@gaia-project/engine";
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

  get display(): { rewards: Reward[]; condition?: ConditionEnum; planet?: Planet } {
    return artifactDisplay(this.artifact);
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
}
</style>
