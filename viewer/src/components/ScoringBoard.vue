<template>
  <!-- This whole component is only mounted for base (non-Lost-Fleet) games - see Game.vue. For
       Lost Fleet, final scoring lives on the map itself (SpaceMap.vue's bottom-right corner) and
       the 7th adv-tech extension + round scoring tiles live in ResearchBoard.vue's 7th column.

       The 8 tiles (2 final + 6 round) are top-aligned in a tight uniform stack. -->
  <!-- viewBox starts at x=-2 (not 0): the accent/body cards sit up-left of each tile's origin,
       their left edge reaching x=-0.5, so a 0-origin viewBox clips the left border. The stack is
       TOP-ALIGNED (starts TOP_MARGIN units down, clearing the top tile's overhanging edge) with a
       tight uniform gap between tiles - NOT stretched to fill the research board's height. -->
  <svg
    viewBox="-2 0 80 446"
    :x="x"
    y="0"
    :width="width"
    height="446"
    v-if="$store.state.data.tiles && $store.state.data.tiles.scorings.final"
  >
    <FinalScoringTile :index="0" v-if="final > 0" :transform="`translate(0, ${finalY(0)})`" />
    <FinalScoringTile :index="1" v-if="final > 1" :transform="`translate(0, ${finalY(1)})`" />
    <ScoringTile v-for="i in scorings" :round="i" :transform="`translate(0, ${roundY(i)})`" :key="i" />
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import FinalScoringTile from "./FinalScoringTile.vue";
import ScoringTile from "./ScoringTile.vue";

// The stack is TOP-ALIGNED with a tight, uniform gap between tiles - it no longer stretches to fill
// the research board's height (owner feedback, 2026-09: the even fill-the-height distribution read
// as "spaced out"). Each tile's accent/body card overhangs its origin by ~0.5 up/left, so the stack
// starts TOP_MARGIN units down to clear the top tile's top edge.
const FINAL_TILE_HEIGHT = 70;
const ROUND_TILE_HEIGHT = 40;
const TOP_MARGIN = 2;
// Fixed 4-unit gap between consecutive tiles - a touch of air (owner asked for slightly more than
// the tight 2-unit minimum) without going back to the fill-the-height spread.
const GAP = 4;

@Component({
  components: {
    ScoringTile,
    FinalScoringTile,
  },
})
export default class ScoringBoard extends Vue {
  @Prop({ default: 0 })
  x: number;

  @Prop({ default: 90 })
  width: number;

  get scorings() {
    return this.$store.state.data.tiles.scorings.round.length;
  }

  get final() {
    return this.$store.state.data.tiles.scorings.final.length;
  }

  /** Final tiles head the column: index 0 just below TOP_MARGIN, index 1 below it. */
  finalY(index: number): number {
    return TOP_MARGIN + index * (FINAL_TILE_HEIGHT + GAP);
  }

  /** Round tiles follow the finals, R6 first; the stack ends with R1 flush at the board bottom. */
  roundY(round: number): number {
    const finalsBottom = TOP_MARGIN + this.final * FINAL_TILE_HEIGHT + (this.final - 1) * GAP;
    const firstRoundTop = finalsBottom + GAP;
    // `round` runs 1..6 but R6 is topmost, so flip: R6 -> offset 0, R1 -> offset 5.
    return firstRoundTop + (this.scorings - round) * (ROUND_TILE_HEIGHT + GAP);
  }
}
</script>
