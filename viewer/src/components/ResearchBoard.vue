<template>
  <svg :viewBox="`0 0 ${viewWidth} ${viewHeight}`" class="research-board">
    <ResearchTrack
      v-for="(field, index) in [...fields].reverse()"
      :field="field"
      :x="(fields.length - 1 - index) * 60"
      :key="field"
    />
    <text y="198" x="180" style="font-size: 12px; text-anchor: middle">Charge 3 power</text>
    <!-- The Scoring Board Extension's 7th Advanced Tech tile + the round scoring tiles, in their
         own column right after the 6 tracks - aligned with the adv-tech row (same y=79 as
         ResearchTrack.vue's own adv-tech tile), with the round scoring tiles just under it, and
         final scoring just under those - this whole column is the space final scoring used to
         occupy in the side ScoringBoard panel (and later the map's bottom-right corner) before it
         moved here, directly beneath the round scoring tiles it's grouped with. -->
    <g v-if="isLostFleet" :transform="`translate(${fields.length * 60}, 0)`">
      <g v-if="hasScoringExtension" v-b-tooltip.hover :title="extensionTooltip">
        <text x="30" y="40" class="extension-label">{{ gateOnShips ? "3 explorations" : "25 vp" }}</text>
        <g transform="translate(30, 79) scale(0.95)">
          <TechTile pos="adv-ext" x="-30" y="-30" />
        </g>
      </g>
      <!-- Scaled to 0.9 (40 units tall -> 36) so consecutive tiles fit the track's own 38-unit
           level slots without overlapping - matches ResearchTile's own 36-unit height in the same
           38-unit slots (see ResearchTile.vue's `height` getter), same top-aligned anchor. Every
           slot uses the SAME 38-unit gap (unlike the track's own uneven level spacing this column
           used to borrow) so all round scoring tiles sit an equal distance apart. -->
      <ScoringTile
        v-for="i in scorings"
        :round="i"
        :transform="`translate(0, ${scoringTileY(i)}) scale(0.9)`"
        :key="i"
      />
      <!-- Final scoring, directly below the round scoring tiles in the same column/scale. -->
      <g v-if="hasFinalScoring" :transform="`translate(0, ${finalScoringY}) scale(0.9)`">
        <FinalScoringTile :index="0" />
        <FinalScoringTile :index="1" v-if="finalScoringCount > 1" transform="translate(0, 60)" />
      </g>
    </g>
    <g v-if="$store.state.data.tiles && $store.state.data.tiles.techs['gaia']">
      <g transform="translate(30, 410) scale(0.95)">
        <TechTile pos="free1" x="-30" y="-30" />
      </g>
      <g transform="translate(90, 410) scale(0.95)">
        <TechTile pos="free2" x="-30" y="-30" />
      </g>
      <g transform="translate(150, 410) scale(0.95)">
        <TechTile pos="free3" x="-30" y="-30" />
      </g>
      <!--      resource conversion-->
      <g transform="translate(247, 412) scale(0.95)">
        <Resource kind="pay-pw" :count="4" transform="translate(-45, -15)" />
        <Resource kind="pay-pw" :count="1" transform="translate(-15, -15)" />
        <Resource kind="pay-pw" :count="3" transform="translate(15, -15)" />
        <Resource kind="pay-pw" :count="4" transform="translate(57, -15)" />

        <use xlink:href="#arrow" x="-6" y="45" transform="rotate(90)" />
        <use xlink:href="#arrow" x="-6" y="15" transform="rotate(90)" />
        <use xlink:href="#arrow" x="-6" y="-15" transform="rotate(90)" />
        <use xlink:href="#arrow" x="50" y="0" transform="rotate(90 57 0)" />

        <use xlink:href="#arrow" x="14" y="18" transform="rotate(-30)" />
        <Resource kind="t" :count="1" transform="translate(38, 0)" />
        <use xlink:href="#arrow" x="66" y="15" transform="rotate(-32 57 15)" />
        <Resource kind="range" :count="2" transform="translate(88, -2) scale(1)" />

        <Resource kind="k" :count="1" transform="translate(-45, 15)" />
        <use xlink:href="#arrow" x="-37" y="15" />
        <Resource kind="c" :count="1" transform="translate(-15, 15)" />
        <use xlink:href="#arrow" x="-6" y="-15" transform="rotate(180)" />
        <Resource kind="o" :count="1" transform="translate(15, 15)" />
        <use xlink:href="#arrow" x="32" y="15" transform="rotate(180 38 15)" />
        <Resource kind="q" :count="1" transform="translate(57, 15)" />
      </g>
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Expansion, hasExpansion, ResearchField, ScoringBoardExtensionSide, BoardAction as BoardActionEnum } from "@gaia-project/engine";
import ResearchTrack from "./ResearchTrack.vue";
import TechTile from "./TechTile.vue";
import BoardAction from "./BoardAction.vue";
import ScoringTile from "./ScoringTile.vue";
import FinalScoringTile from "./FinalScoringTile.vue";
import { BOTTOM_SCORING_TILE_Y, researchBoardHeight } from "../logic/utils";

// Extra width for the 7th (Scoring Board Extension + round scoring tiles + final scoring) column,
// Lost Fleet only - the space final scoring used to occupy in the side ScoringBoard panel (and
// later the map's bottom-right corner) before it moved into this column.
const EXTENSION_COLUMN_WIDTH = 90;

// Round scoring tiles' y-positions in the 7th column, top-aligned with the adv-tech row (R6, the
// topmost, sits immediately below the adv-tech tile above it) and spaced by a uniform 38 units
// each - every tile is 40 native units tall, scaled to 0.9 (36 tall), leaving the same 2-unit gap
// between every consecutive pair. (This used to reuse ResearchTrack.vue's own level4-level0
// y-coordinates, which are unevenly spaced on the track itself - level2-level3's 56-unit gap stood
// out as a visibly bigger break between R4 and R5 here, where alignment with the track no longer
// matters once final scoring was added below. Uniform spacing fixes that.) Element 0
// (bottommost, R1) is shared with logic/utils.ts's `researchBoardHeight` as BOTTOM_SCORING_TILE_Y,
// so Game.vue's declared render height for this whole component can never drift out of sync with
// this array again.
const SCORING_TILE_Y = [BOTTOM_SCORING_TILE_Y, 278, 240, 202, 164, 126];

// Final scoring sits directly below the last (bottommost, R1) round scoring tile, in the same
// column/scale, separated by the same 2-unit gap convention (36-tall tile + 2 = 38, plus this
// tile's own 4-unit breathing room since it's a visually distinct block). The matching native
// height/gap/scale constants used to size the actual block live in logic/utils.ts's
// `researchBoardHeight`, which this component's `viewHeight` now delegates to.
const FINAL_SCORING_GAP_BELOW_ROUND_TILES = 40;

@Component({
  computed: {
    fields(): ResearchField[] {
      return ResearchField.values(this.expansions);
    },
    expansions() {
      return this.$store.state.data.expansions;
    },
    viewWidth() {
      return this.fields.length * 60 + (this.isLostFleet ? EXTENSION_COLUMN_WIDTH : 0);
    },
    viewHeight() {
      return researchBoardHeight(this.$store.state.data);
    },
    isLostFleet() {
      return hasExpansion(this.expansions, Expansion.LostFleet);
    },
    scorings() {
      return this.$store.state.data.tiles.scorings.round.length;
    },
    hasFinalScoring() {
      return this.isLostFleet && !!this.$store.state.data.tiles?.scorings?.final?.length;
    },
    finalScoringCount() {
      return this.$store.state.data.tiles?.scorings?.final?.length ?? 0;
    },
    finalScoringY() {
      return SCORING_TILE_Y[0] + FINAL_SCORING_GAP_BELOW_ROUND_TILES;
    },
    hasScoringExtension() {
      return !!this.$store.state.data.tiles?.techs?.["adv-ext"];
    },
    gateOnShips() {
      return this.$store.state.data.scoringExtensionSide === ScoringBoardExtensionSide.ExploredShips;
    },
    extensionTooltip() {
      return this.gateOnShips
        ? "Scoring Board Extension: this Advanced Tech tile requires 3 explored spaceships (plus the usual federation token and coverable tech tile)"
        : "Scoring Board Extension: this Advanced Tech tile requires 25 VP (plus the usual federation token and coverable tech tile)";
    },
  },
  methods: {
    scoringTileY(i: number): number {
      return SCORING_TILE_Y[i - 1];
    },
  },
  components: {
    ResearchTrack,
    TechTile,
    BoardAction,
    ScoringTile,
    FinalScoringTile,
  },
})
export default class ResearchBoard extends Vue {}
</script>

<style lang="scss" scoped>
svg.research-board {
  overflow: visible;
}

.extension-label {
  font-size: 9px;
  font-weight: 700;
  text-anchor: middle;
}
</style>
