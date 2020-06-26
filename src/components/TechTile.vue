<template>
  <svg :class='["techTile", {highlighted, covered}]' v-show="this.count" v-b-tooltip :title="tooltip" @click="onClick" width="60" height="60" viewBox="-32 -32 64 64">
    <rect x=-30 y=-30 width=60 height=60 rx=3 ry=3 stroke="black" stroke-width=1 class="tech-border" :fill="isAdvanced ? '#515FF8' : '#444'" />
    <!--<text class="title" x="-25" y="-18">{{title}}</text>-->
    <TechContent :content=rawContent style="pointer-events:none" />
  </svg>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { tiles, PlayerEnum, Event, TechTilePos, AdvTechTilePos, Operator as OperatorEnum, Condition as ConditionEnum, Building as BuildingEnum } from '@gaia-project/engine';
import { eventDesc } from '../data/event';
import TechContent from './TechContent.vue';

@Component({
  components: {
    TechContent
  }
})
export default class TechTile extends Vue {
  @Prop()
  pos: TechTilePos | AdvTechTilePos;

  @Prop()
  player: PlayerEnum;

  @Prop()
  covered: boolean;

  onClick () {
    if (this.highlighted) {
      this.$store.dispatch("gaiaViewer/techClick", this.pos);
    }
  }

  get highlighted () {
    return this.$store.state.gaiaViewer.context.highlighted.techs.has(this.pos);
  }

  get tileObject () {
    return this.$store.state.gaiaViewer.data.tiles.techs[this.pos];
  }

  get tile () {
    return this.tileObject.tile;
  }

  get event () {
    return new Event(this.rawContent);
  }

  get count () {
    if (this.player !== undefined) {
      return 1;
    }
    return this.tileObject.count;
  }

  get rawContent () {
    return tiles.techs[this.tile][0];
  }

  get title () {
    // Only show count if there are more players than tech tiles available
    if (this.count > 1 && this.$store.state.gaiaViewer.data.players.length > 4) {
      return `${this.pos} (${this.count})`;
    }

    return this.pos;
  }

  get isAdvanced () {
    return this.pos.startsWith("adv-");
  }

  get tooltip () {
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

    &.highlighted .tech-border {
      stroke: #2C4;
      cursor: pointer;
      stroke-width: 2px;
    }

    &.covered {
      stroke-opacity: 0.5;
      fill-opacity: 0.7;
    }
  }
}

</style>
