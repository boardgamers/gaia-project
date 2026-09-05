<template>
  <!-- This whole component is only mounted for base (non-Lost-Fleet) games - see Game.vue. For
       Lost Fleet, final scoring lives on the map itself (SpaceMap.vue's bottom-right corner) and
       the 7th adv-tech extension + round scoring tiles live in ResearchBoard.vue's 7th column.

       The board is 440 tall - the SAME height as the research board it sits beside - so its top
       aligns with the tracks' top and its bottom with the general tech tiles' bottom. The 8 tiles
       (2 final + 6 round) are distributed evenly down the column with an equal gap between each. -->
  <!-- viewBox starts at x=-2 (not 0): the accent/body cards sit up-left of each tile's origin,
       their left edge reaching x=-0.5, so a 0-origin viewBox clips the left border. Vertically the
       stack starts 2 units down (see TOP_MARGIN), which both clears the top tile's overhanging top
       edge and lands R1's bottom flush with the general tech tiles' bottom. -->
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

// The board is 446 tall: the research board's track area is 440, and its general tech tiles extend
// ~6 units past that, so the scoring column's bottom aligns with the tech tiles' true bottom edge.
// Each tile's accent/body card overhangs its origin by ~0.5 up/left, so the stack starts TOP_MARGIN
// units down to clear the top tile's top edge; the stack itself ends 1 unit short of the board
// bottom so R1's bottom card isn't flush against the frame edge.
const BOARD_HEIGHT = 446;
const FINAL_TILE_HEIGHT = 70;
const ROUND_TILE_HEIGHT = 40;
const TOP_MARGIN = 2;
// 7 gaps between the 8 tiles. The stack fills BOARD_HEIGHT - 1 (plus TOP_MARGIN), leaving a 1-unit
// margin at the bottom so R1's bottom card isn't flush against the frame edge.
const GAP = (BOARD_HEIGHT - 1 - TOP_MARGIN - 2 * FINAL_TILE_HEIGHT - 6 * ROUND_TILE_HEIGHT) / 7; // ≈ 8.1

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
