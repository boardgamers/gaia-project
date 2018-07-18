<template>
  <g class='techTile' v-if="$store.state.game.data.techTiles">
    <polygon points="2,1 48,1 58,11 58,36 2,36" />
    <text class="title" x="5" y="12">{{title}}</text>
    <text class="content" x="5" y="30">{{content}}</text>
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { tiles, PlayerEnum } from '@gaia-project/engine';

@Component<TechTile>({
  computed: {
    tile(this: TechTile) {
      return (this.$store.state.game.data.techTiles[this.pos] || this.$store.state.game.data.advTechTiles[this.pos]).tile;
    },

    count() {
      if (this.player !== undefined) {
        return 1;
      }
      return (this.$store.state.game.data.techTiles[this.pos] || this.$store.state.game.data.advTechTiles[this.pos]).numTiles;
    },

    content() {
      return (tiles.techs[this.tile] || tiles.advancedTechs[this.tile])[0];
    },

    title() {
      if (this.count > 1) {
        return `${this.pos} (${this.count})`;
      }

      return this.pos;
    }
  }
})
export default class TechTile extends Vue {
  @Prop()
  pos: ResearchPos;
  
  @Prop()
  player: PlayerEnum
}

</script>

<style lang="scss" scoped>

svg {
  .techTile {
    polygon {
      stroke: #333;
      stroke-width: 1px;
      fill: white;
    }
    .title {
      font-family: sans-serif;
      font-size: 10px;
      font-weight: bold;
    }
    .content {
      font-family: sans-serif;
      font-size: 12px;
    }
  }
}

</style>
