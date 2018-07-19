<template>
  <svg :class='["techTile", {highlighted}]' v-show="this.count" v-b-tooltip :title="tooltip" @click="onClick" width="58" height="37" viewBox="0 0 58 37">
    <polygon points="1,1 48,1 57,11 57,36 1,36" />
    <text class="title" x="4" y="12">{{title}}</text>
    <text class="content" x="4" y="30">{{content}}</text>
  </svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { tiles, PlayerEnum, Event, TechTilePos, AdvTechTilePos } from '@gaia-project/engine';
import { eventDesc } from '../data/event';

@Component<TechTile>({
  computed: {
    tileObject() {
      return (this.$store.state.game.data.techTiles[this.pos] || this.$store.state.game.data.advTechTiles[this.pos]);
    },

    tile() {
      return this.tileObject.tile;
    },

    count() {
      if (this.player !== undefined) {
        return 1;
      }
      return this.tileObject.numTiles;
    },

    content() {
      return (tiles.techs[this.tile] || tiles.advancedTechs[this.tile])[0];
    },

    title() {
      if (this.count > 1) {
        return `${this.pos} (${this.count})`;
      }

      return this.pos;
    },

    tooltip() {
      return eventDesc(new Event(this.content));
    },

    highlighted() {
      return this.$store.state.game.context.highlighted.techs.has(this.pos);
    }
  }
})
export default class TechTile extends Vue {
  @Prop()
  pos: TechTilePos | AdvTechTilePos;
  
  @Prop()
  player: PlayerEnum;

  onClick() {
    if (this.highlighted) {
      this.$store.dispatch("techClick", this.pos);
    }
  }
}
export default interface TechTile {
  highlighted: boolean;
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
      font-family: sans-serif;
      font-size: 10px;
      font-weight: bold;
      pointer-events: none;
    }
    .content {
      font-family: sans-serif;
      font-size: 12px;
      pointer-events: none;
    }

    &.highlighted polygon {
      stroke: #2C4;
      cursor: pointer;
    }
  }
}

</style>
