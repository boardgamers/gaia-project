<template>
  <svg :class='["techTile", {highlighted, covered}]' v-show="this.count" v-b-tooltip :title="tooltip" @click="onClick" width="58" height="37" viewBox="0 0 58 37">
    <polygon points="1,1 48,1 57,11 57,36 1,36" />
    <text class="title" x="4" y="12">{{title}}</text>
    <text :class="['content', {smaller: content.length >= 10}]" x="4" y="30">{{content}}</text>
  </svg>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { tiles, PlayerEnum, Event, TechTilePos, AdvTechTilePos } from '@gaia-project/engine';
import { eventDesc } from '../data/event';

@Component<TechTile>({
  computed: {
    tileObject () {
      return this.$store.state.gaiaViewer.data.tiles.techs[this.pos];
    },

    tile () {
      return this.tileObject.tile;
    },

    count () {
      if (this.player !== undefined) {
        return 1;
      }
      return this.tileObject.count;
    },

    rawContent () {
      return tiles.techs[this.tile][0];
    },

    content () {
      const val = this.rawContent;

      return val.length > 10 && val[0] !== '=' ? val.replace(/ /g, '') : val;
    },

    title () {
      // Only show count if there are more players than tech tiles available
      if (this.count > 1 && this.$store.state.gaiaViewer.data.players.length > 4) {
        return `${this.pos} (${this.count})`;
      }

      return this.pos;
    },

    tooltip () {
      return eventDesc(new Event(this.rawContent));
    }
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
}

</script>

<style lang="scss" scoped>

svg {
  &.techTile {
    polygon {
      stroke: #333;
      stroke-width: 1px;
      fill: white;
    }
    .title {
      font-size: 10px;
      font-weight: bold;
      pointer-events: none;
    }
    .content {
      font-size: 11px;
      pointer-events: none;

      &.smaller {
        font-size: 9px;
      }
    }

    &.highlighted polygon {
      stroke: #2C4;
      cursor: pointer;
    }

    &.covered {
      stroke-opacity: 0.5;
      fill-opacity: 0.7;
    }
  }
}

</style>
