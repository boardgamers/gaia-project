<template>
  <svg :viewBox="`0 0 ${viewWidth} ${viewHeight}`" class="research-board">
    <ResearchTrack
      v-for="(field, index) in [...fields].reverse()"
      :field="field"
      :x="(fields.length - 1 - index) * 60"
      :key="field"
    />
    <!-- Level 3's "charge 3 power" reward as the actual charge glyph - the same power-circle icon
         the tech tiles use (e.g. the `~o,pw` tile), with the count centred inside it - instead of
         the spelled-out text. -->
    <g class="charge-note" transform="translate(180, 194)">
      <Resource kind="pw" :count="3" transform="scale(1.15)" />
    </g>
    <!-- The Scoring Board Extension's 7th Advanced Tech tile + the round scoring tiles, in their
         own column right after the 6 tracks - aligned with the adv-tech row (same y=79 as
         ResearchTrack.vue's own adv-tech tile), with the round scoring tiles just under it, and
         final scoring just under those - this whole column is the space final scoring used to
         occupy in the side ScoringBoard panel (and later the map's bottom-right corner) before it
         moved here, directly beneath the round scoring tiles it's grouped with. -->
    <g v-if="isLostFleet" :transform="`translate(${fields.length * 60}, 0)`">
      <g v-if="hasScoringExtension" v-b-tooltip.nofade="tooltipTriggerConfig()" :title="extensionTooltip">
        <g
          class="extension-gate"
          :data-gate-kind="gateOnShips ? 'ships' : 'vp'"
          transform="translate(4, 5)"
          role="img"
          :aria-label="extensionGateLabel"
        >
          <rect class="extension-gate__frame" width="52" height="38" rx="7" ry="7" />
          <g v-if="gateOnShips" class="extension-gate__ships">
            <text x="12" y="22" class="extension-gate__count">3</text>
            <text x="23" y="22" class="extension-gate__multiply">×</text>
            <g class="extension-gate__ship-icon" transform="translate(40, 19)">
              <polygon class="extension-gate__ship-hex" points="-9,0 -4.5,-8 4.5,-8 9,0 4.5,8 -4.5,8" />
              <path
                class="extension-gate__ship-body"
                d="M 0,-6.2 L 2.2,-1.7 L 6.2,0.8 L 2.1,2 L 1.2,6 L -1.2,6 L -2.1,2 L -6.2,0.8 L -2.2,-1.7 Z"
              />
              <circle class="extension-gate__ship-window" cy="-1.2" r="1.25" />
            </g>
          </g>
          <Resource v-else class="extension-gate__vp" kind="vp" :count="25" transform="translate(26, 19) scale(1.7)" />
        </g>
        <g transform="translate(30, 79) scale(0.95)">
          <TechTile pos="adv-ext" x="-30" y="-30" />
        </g>
      </g>
      <!-- Scaled to 0.82 so the scoring tiles read a touch narrower than the research columns beside
           them (owner feedback: at 0.9 they dominated the Lost Fleet 7th column). The 6-unit
           horizontal nudge keeps the 61.5-unit-wide tiles centered in the 70-unit column. Every slot
           uses the SAME 38-unit gap so all round scoring tiles sit an equal distance apart. -->
      <ScoringTile
        v-for="i in scorings"
        :round="i"
        :transform="`translate(6, ${scoringTileY(i)}) scale(0.82)`"
        :key="i"
      />
      <!-- Final scoring, directly below the round scoring tiles in the same column/scale. -->
      <g v-if="hasFinalScoring" :transform="`translate(6, ${finalScoringY}) scale(0.82)`">
        <FinalScoringTile :index="0" />
        <FinalScoringTile :index="1" v-if="finalScoringCount > 1" transform="translate(0, 74)" />
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
import { Expansion, hasExpansion, ResearchField, ScoringBoardExtensionSide } from "@gaia-project/engine";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import { tooltipTriggerConfig } from "../logic/tooltip";
import { researchBoardHeight } from "../logic/utils";
import BoardAction from "./BoardAction.vue";
import FinalScoringTile from "./FinalScoringTile.vue";
import ResearchTrack from "./ResearchTrack.vue";
import Resource from "./Resource.vue";
import ScoringTile from "./ScoringTile.vue";
import TechTile from "./TechTile.vue";

// Extra width for the 7th (Scoring Board Extension + round scoring tiles + final scoring) column,
// Lost Fleet only - the space final scoring used to occupy in the side ScoringBoard panel (and
// later the map's bottom-right corner) before it moved into this column. Sized to the column's
// actual content (the 75-unit-wide scoring/final tiles, drawn at scale 0.9 => 68 units, starting
// at the extension's own x origin) plus a small right margin that matches the tracks' own ~1.5-unit
// left inset, so the board sits centered in its panel instead of leaving a wide empty gutter on the
// right (the old 90 reserved ~22 units the content never filled). MUST stay in sync with Game.vue's
// `researchBoardContentWidth`, which reserves the same width for this component's rendered box.
const EXTENSION_COLUMN_WIDTH = 70;

// Round scoring tiles' y-positions in the 7th column, top-aligned with the adv-tech row and spaced
// by a uniform 38 units each - every tile is 40 native units tall, scaled to 0.9 (36 tall), leaving
// the same 2-unit gap between every consecutive pair. (This used to reuse ResearchTrack.vue's own
// level4-level0 y-coordinates, which are unevenly spaced on the track itself - level2-level3's
// 56-unit gap stood out as a visibly bigger break between R4 and R5 here, where alignment with the
// track no longer matters once final scoring was added below. Uniform spacing fixes that.)
// R6 (index 5, the topmost) sits at 110 so it picks up that same ~2-unit gap under the adv-tech
// tile above it (translate(30, 79) scale(0.95) => bottom edge 79 + 30*0.95 = 107.5) - the previous
// 126 left an 18.5-unit gap there, visibly bigger than the 2-unit gap between every other pair.
// Element 0 (bottommost, R1) is shared with logic/utils.ts's `researchBoardHeight` as
// BOTTOM_SCORING_TILE_Y, so Game.vue's declared render height for this whole component can never
// drift out of sync with this array again.
//
// The 6 round tiles spread evenly from R6 (topmost, fixed at 110 just under the adv-tech row) down
// to R1, and the finals stack below them so the lowest final tile's bottom lands flush with the
// power/QIC action row's bottom edge (y=492, Game.vue's actionRowBottom) - the Lost Fleet layout
// brief. The bottom final tile is 70 native units tall, scaled 0.82 (~57.4), so it starts at 492 -
// 57.4 = 434.6; the finals group holds two of them 74 native units apart, so the group (and F1)
// starts at 434.6 - 74*0.82 = 373.9. R1's bottom is that minus the 40-unit finals gap = 333.9.
const ACTION_ROW_BOTTOM = 492;
const FINAL_TILE_SCALED_HEIGHT = 70 * 0.82; // ≈ 57.4
const F1_TOP = ACTION_ROW_BOTTOM - FINAL_TILE_SCALED_HEIGHT; // ≈ 434.6
const FINAL_SCORING_GAP_BELOW_ROUND_TILES = 40;
const R1_TOP = F1_TOP - 74 * 0.82 - FINAL_SCORING_GAP_BELOW_ROUND_TILES; // ≈ 333.9
const R6_TOP = 110;
const SCORING_STEP = (R1_TOP - R6_TOP) / 5; // ≈ 44.8
const SCORING_TILE_Y = [
  R1_TOP,
  R6_TOP + 4 * SCORING_STEP,
  R6_TOP + 3 * SCORING_STEP,
  R6_TOP + 2 * SCORING_STEP,
  R6_TOP + SCORING_STEP,
  R6_TOP,
];

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
    extensionGateLabel() {
      return this.gateOnShips ? "Requires 3 explored spaceships" : "Requires 25 victory points";
    },
  },
  methods: {
    scoringTileY(i: number): number {
      return SCORING_TILE_Y[i - 1];
    },
    tooltipTriggerConfig,
  },
  components: {
    ResearchTrack,
    TechTile,
    BoardAction,
    ScoringTile,
    FinalScoringTile,
    Resource,
  },
})
export default class ResearchBoard extends Vue {}
</script>

<style lang="scss" scoped>
svg.research-board {
  overflow: visible;
}

.extension-gate__frame {
  fill: var(--ui-surface-raised);
  stroke: var(--ui-board-action-border);
  stroke-width: 1.2;
}

.extension-gate__count,
.extension-gate__multiply {
  fill: var(--ui-svg-neutral-text);
  text-anchor: middle;
  dominant-baseline: middle;
}

.extension-gate__count {
  font-size: 15px;
  font-weight: 800;
}

.extension-gate__multiply {
  font-size: 9px;
  font-weight: 700;
}

.extension-gate__ship-hex {
  fill: var(--ui-accent-soft);
  stroke: var(--ui-link);
  stroke-width: 1;
}

.extension-gate__ship-body {
  fill: var(--ui-link);
  stroke: var(--ui-surface-raised);
  stroke-width: 0.45;
  stroke-linejoin: round;
}

.extension-gate__ship-window {
  fill: var(--ui-surface-raised);
}

.extension-gate__vp {
  pointer-events: none;
}

.charge-note {
  fill: var(--ui-svg-neutral-text);
}
</style>
