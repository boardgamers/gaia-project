<template>
  <svg :viewBox="`0 0 ${viewWidth} 440`" class="research-board">
    <ResearchTrack
      v-for="(field, index) in [...fields].reverse()"
      :field="field"
      :x="(fields.length - 1 - index) * 60"
      :key="field"
    />
    <text y="198" x="180" style="font-size: 12px; text-anchor: middle">Charge 3 power</text>
    <!-- The Scoring Board Extension's 7th Advanced Tech tile + the round scoring tiles, in their
         own column right after the 6 tracks - aligned with the adv-tech row (same y=79 as
         ResearchTrack.vue's own adv-tech tile), with the round scoring tiles just under it. This is
         the space final scoring used to occupy in the side ScoringBoard panel before it moved onto
         the map itself (SpaceMap.vue's bottom-right corner). -->
    <g v-if="isLostFleet" :transform="`translate(${fields.length * 60}, 0)`">
      <g v-if="hasScoringExtension" v-b-tooltip.hover :title="extensionTooltip">
        <text x="30" y="40" class="extension-label">{{ gateOnShips ? "3 explorations" : "25 vp" }}</text>
        <g transform="translate(30, 79) scale(0.95)">
          <TechTile pos="adv-ext" x="-30" y="-30" />
        </g>
      </g>
      <ScoringTile v-for="i in scorings" :round="i" :transform="`translate(0, ${scoringTileY(i)})`" :key="i" />
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

// Extra width for the 7th (Scoring Board Extension + round scoring tiles) column, Lost Fleet only -
// the space final scoring used to occupy in the side ScoringBoard panel before it moved onto the
// map itself.
const EXTENSION_COLUMN_WIDTH = 90;

// Round scoring tiles' y-positions in the 7th column, reusing the SAME y-coordinates as
// ResearchTrack.vue's own level4/level3/level2/level1/level0 tiles (108/146/202/240/278) so the
// column aligns perfectly with the track grid instead of an unrelated fixed spacing - R6 (the
// first/topmost) lands exactly at "level 4", immediately below the adv-tech tile above it. A 6th
// slot (for the rare case of 6 round scoring tiles) continues the last (38-unit) gap.
const SCORING_TILE_Y = [316, 278, 240, 202, 146, 108];

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
    isLostFleet() {
      return hasExpansion(this.expansions, Expansion.LostFleet);
    },
    scorings() {
      return this.$store.state.data.tiles.scorings.round.length;
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
