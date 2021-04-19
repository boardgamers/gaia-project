<template>
  <svg
    :class="['techTile', pos, { highlighted, covered, advanced: isAdvanced }]"
    v-show="this.count"
    v-b-tooltip
    :title="tooltip"
    @click="onClick"
    width="60"
    height="60"
    viewBox="-32 -32 64 64"
  >
    <g :transform="`scale(${isAdvanced ? 0.9 : 1})`">
      <rect
        x="-30"
        y="-30"
        width="60"
        height="60"
        rx="3"
        ry="3"
        stroke="black"
        stroke-width="1"
        class="tech-border"
        filter="url(#shadow-1)"
      />
      <!--<text class="title" x="-25" y="-18">{{title}}</text>-->
      <TechContent :content="rawContent" style="pointer-events: none" />
    </g>

    <g v-if="isBorrowed" :transform="`scale(15) translate(1.15,1.15)`">
      <PlayerCircle :index="originalOwner" :player="originalOwnerObject" style="opacity: 0.7" />
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import {
  tiles,
  PlayerEnum,
  Event,
  TechTilePos,
  AdvTechTilePos,
  Operator as OperatorEnum,
  Condition as ConditionEnum,
  Building as BuildingEnum,
} from "@gaia-project/engine";
import { eventDesc } from "../data/event";
import TechContent from "./TechContent.vue";
import { ButtonData } from "../data";
import PlayerCircle from "./PlayerCircle.vue";

@Component({
  components: {
    TechContent,
    PlayerCircle,
  },
})
export default class TechTile extends Vue {
  @Prop()
  pos: TechTilePos | AdvTechTilePos;

  @Prop()
  player: PlayerEnum;

  @Prop()
  originalOwner?: PlayerEnum;

  get originalOwnerObject() {
    return this.$store.state.gaiaViewer.data.player(this.originalOwner);
  }

  @Prop()
  countOverride?: number;

  @Prop()
  covered: boolean;

  onClick() {
    if (this.highlighted) {
      const payload = this.originalOwner ? `${this.originalOwnerObject.faction} ${this.pos}` : this.pos;
      this.$store.dispatch("gaiaViewer/techClick", { command: this.pos } as ButtonData);
    }
  }

  get highlighted() {
    return this.$store.state.gaiaViewer.context.highlighted.techs.has(this.pos);
  }

  get tileObject() {
    return this.$store.state.gaiaViewer.data.tiles.techs[this.pos];
  }

  get tile() {
    return this.tileObject.tile;
  }

  get event() {
    return new Event(this.rawContent);
  }

  get count() {
    if (this.countOverride !== undefined) {
      return this.countOverride;
    }
    if (this.player !== undefined) {
      return 1;
    }
    return this.tileObject.count;
  }

  get rawContent() {
    return tiles.techs[this.tile][0];
  }

  get title() {
    // Only show count if there are more players than tech tiles available
    if (this.count > 1 && this.$store.state.gaiaViewer.data.players.length > 4) {
      return `${this.pos} (${this.count})`;
    }

    return this.pos;
  }

  get isAdvanced() {
    return this.pos.startsWith("adv-");
  }

  get isBorrowed() {
    return !!this.originalOwner;
  }

  get tooltip() {
    return eventDesc(this.event);
  }
}
</script>

<style lang="scss">
svg {
  &.techTile {
    overflow: visible;
    .title {
      font-size: 10px;
      font-weight: bold;
      pointer-events: none;
      fill: white;
    }
    .content {
      font-size: 11px;
      pointer-events: none;
      fill: white;

      &.smaller {
        font-size: 9px;
      }
    }

    .tech-border {
      fill: var(--tech-tile);
    }

    &.advanced .tech-border {
      fill: var(--adv-tech-tile);
    }

    &.eco .tech-border {
      fill: var(--rt-eco);
    }
    &.sci .tech-border {
      fill: var(--rt-sci);
    }
    &.terra .tech-border {
      fill: var(--rt-terra);
    }
    &.nav .tech-border {
      fill: var(--rt-nav);
    }
    &.gaia .tech-border {
      fill: var(--rt-gaia);
    }
    &.int .tech-border {
      fill: var(--rt-int);
    }

    &.highlighted .tech-border {
      stroke: var(--highlighted);
      cursor: pointer;
      stroke-width: 2px;
    }

    &.covered {
      opacity: 0.5;
    }
  }
}
</style>
