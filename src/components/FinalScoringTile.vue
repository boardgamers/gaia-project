<template>
  <g :class='["finalScoringTile", {highlighted}]' v-b-tooltip :title="tooltip">
    <rect x="1" y="1" width="75" height="55" />
    <text class="title" x="5" y="12">{{content}}</text>
    <Token v-for="(player, index) in players" :faction="player.faction" :transform="`translate(${tokenX(player)}, ${tokenY(index)})`" :key="player.faction" :scale="3" />
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { tiles, Event, factions, FinalTile } from '@gaia-project/engine';
import { AugmentedPlayer } from "../data";
import Token from "./Token.vue";

@Component<FinalScoringTile>({
  computed: {
    tile() {
      return this.$store.state.game.data.finalScoringTiles[this.index];
    },

    content() {
      return this.tile;
    },

    players() {
      return this.$store.state.game.data.players.filter(player => !!player && player.faction);
    },

    tooltip() {
      const tile = this.tile;
      const players = this.players;

      return players.map(pl => `- ${factions[pl.faction].name}: ${pl.progress[tile]}`).join('\n');
    },

    highlighted() {
      return this.$store.state.game.data.round > 6;
    }
  },

  components: {
    Token
  }
})
export default class FinalScoringTile extends Vue {
  @Prop()
  index: number;

  tokenX(player: AugmentedPlayer) {
    return 10 + Math.min(player.progress[this.tile], 10) * 5.5;
  }

  tokenY(index: number) {
    const nPlayers = this.players.length;

    const yCenter = 34;

    switch (nPlayers) {
      case 1: return yCenter;
      case 2: return yCenter + (index*2-1) * 7.5;
      case 3: return yCenter + (index - 1) * 9;
      case 4: return yCenter + (index - 1.5) * 9;
      default: return 19 + index * 7.5;
    }
  }
}
export default interface FinalScoringTile {
  tile: FinalTile;
  players: AugmentedPlayer[];
}

</script>

<style lang="scss" scoped>

g {
  &.finalScoringTile {
    rect {
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

    &.highlighted rect {
      stroke: #2C4;
    }
  }
}

</style>
